from datetime import date, datetime, timedelta
import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, agent

router = APIRouter(prefix="/meals", tags=["meals"])


@router.post("/parse", response_model=schemas.MealParseResponse)
def parse_meal_endpoint(payload: schemas.MealParseRequest, db: Session = Depends(get_db)):
    profile = db.get(models.UserProfile, "default")
    if not profile:
        profile = models.UserProfile(id="default")
        db.add(profile)
        db.commit()
        db.refresh(profile)

    # 1. Create a transient meal
    meal_date = date.today()
    if payload.date:
        try:
            meal_date = date.fromisoformat(payload.date)
        except ValueError:
            pass

    meal = models.Meal(
        user_id=profile.id,
        date=meal_date,
        meal_type=payload.meal_type,
        raw_text=payload.raw_text,
        is_finalized=False
    )
    db.add(meal)
    db.flush()

    # 2. Get KB items
    kb_items = db.query(models.NutritionKnowledge).all()
    kb_dicts = [
        {
            "food_name": k.food_name,
            "serving_size": k.serving_size,
            "unit": k.unit,
            "calories": k.calories,
            "protein_g": k.protein_g,
            "carbs_g": k.carbs_g,
            "fat_g": k.fat_g,
            "preparation_method": k.preparation_method,
            "source_citation": k.source_citation
        } for k in kb_items
    ]

    # 3. Call AI agent
    parsed = agent.parse_meal(payload.raw_text, {
        "calorie_target": profile.calorie_target,
        "dietary_preferences": profile.dietary_preferences,
        "allergies": profile.allergies,
        "foods_to_avoid": profile.foods_to_avoid
    }, kb_dicts)

    # 4. Save items
    total_cal = 0.0
    total_p = 0.0
    total_c = 0.0
    total_f = 0.0

    items_saved = []
    for item in parsed.get("items", []):
        kb_match = next((k for k in kb_items if k.food_name == item.get("kb_entry_name")), None)
        
        meal_item = models.MealItem(
            meal_id=meal.id,
            food_name=item.get("food_name"),
            quantity=item.get("quantity", 1.0),
            unit=item.get("unit", "serving"),
            preparation_method=item.get("preparation_method"),
            calories=item.get("calories", 0.0),
            protein_g=item.get("protein_g", 0.0),
            carbs_g=item.get("carbs_g", 0.0),
            fat_g=item.get("fat_g", 0.0),
            source=item.get("source", "ai_estimate"),
            confidence=item.get("confidence", "low"),
            kb_entry_name=item.get("kb_entry_name"),
            source_citation=kb_match.source_citation if kb_match else item.get("source_citation"),
            user_corrected=False
        )
        db.add(meal_item)
        items_saved.append(meal_item)
        
        total_cal += meal_item.calories
        total_p += meal_item.protein_g
        total_c += meal_item.carbs_g
        total_f += meal_item.fat_g

    # 5. Save clarifications
    clarifications_saved = []
    for i, clar in enumerate(parsed.get("clarifications", [])):
        q = models.ClarificationQuestion(
            meal_id=meal.id,
            question_text=clar.get("question_text"),
            options=clar.get("options", []),
            item_index=clar.get("item_index", i),
            status="pending"
        )
        db.add(q)
        clarifications_saved.append(q)

    # 6. Save assumptions
    meal.ai_assumptions = parsed.get("ai_assumptions", [])
    meal.total_calories = round(total_cal, 1)
    meal.total_protein = round(total_p, 1)
    meal.total_carbs = round(total_c, 1)
    meal.total_fat = round(total_f, 1)

    db.commit()
    db.refresh(meal)

    return schemas.MealParseResponse(
        meal_id=meal.id,
        items=[schemas.MealItemOut.model_validate(it) for it in items_saved],
        clarifications=[schemas.ClarificationOut.model_validate(cl) for cl in clarifications_saved],
        ai_assumptions=meal.ai_assumptions,
        total_calories=meal.total_calories,
        total_protein=meal.total_protein,
        total_carbs=meal.total_carbs,
        total_fat=meal.total_fat
    )


@router.post("/{meal_id}/clarify/{clarification_id}", response_model=schemas.MealParseResponse)
def answer_clarification(
    meal_id: str,
    clarification_id: str,
    payload: schemas.ClarificationAnswer,
    db: Session = Depends(get_db)
):
    meal = db.get(models.Meal, meal_id)
    if not meal:
        raise HTTPException(404, "Meal not found")

    q = db.get(models.ClarificationQuestion, clarification_id)
    if not q or q.meal_id != meal.id:
        raise HTTPException(404, "Clarification question not found")

    q.answer_text = payload.answer_text
    q.status = "answered"

    # Find the related item to update its calories / quantity based on the answer
    items = db.query(models.MealItem).filter(models.MealItem.meal_id == meal.id).all()
    
    # Try parsing the answer for a quantity
    # If the user selected e.g. "2 servings" or "200g" or "1 cup (150g)"
    ans = payload.answer_text.lower()
    
    # Extract any number
    nums = re.findall(r"(\d+(?:\.\d+)?)", ans)
    qty = 1.0
    if nums:
        qty = float(nums[0])

    if q.item_index is not None and q.item_index < len(items):
        item = items[q.item_index]
        kb_item = None
        if item.kb_entry_name:
            kb_item = db.query(models.NutritionKnowledge).filter(models.NutritionKnowledge.food_name == item.kb_entry_name).first()

        if kb_item:
            # Re-scale based on the new answer
            scale = qty
            # If the answer specifies grams and the KB unit is grams
            if "g" in ans and kb_item.unit == "g" and kb_item.serving_size > 0:
                scale = qty / kb_item.serving_size
            elif "ml" in ans and kb_item.unit == "ml" and kb_item.serving_size > 0:
                scale = qty / kb_item.serving_size
            
            # Simple keyword check for portion size options like "half"
            if "half" in ans or "0.5" in ans:
                scale = 0.5
            elif "double" in ans or "2 servings" in ans:
                scale = 2.0

            item.quantity = qty
            item.calories = round(kb_item.calories * scale, 1)
            item.protein_g = round(kb_item.protein_g * scale, 1)
            item.carbs_g = round(kb_item.carbs_g * scale, 1)
            item.fat_g = round(kb_item.fat_g * scale, 1)
            item.confidence = "high"

        else:
            # If not in KB, make a simple estimate adjustment
            item.quantity = qty
            item.calories = round(item.calories * qty, 1)

    # Recalculate totals
    total_cal = sum(it.calories for it in items)
    total_p = sum(it.protein_g for it in items)
    total_c = sum(it.carbs_g for it in items)
    total_f = sum(it.fat_g for it in items)

    meal.total_calories = round(total_cal, 1)
    meal.total_protein = round(total_p, 1)
    meal.total_carbs = round(total_c, 1)
    meal.total_fat = round(total_f, 1)

    db.commit()
    db.refresh(meal)

    # Return the updated meal state
    active_clarifications = db.query(models.ClarificationQuestion).filter(
        models.ClarificationQuestion.meal_id == meal.id,
        models.ClarificationQuestion.status == "pending"
    ).all()

    return schemas.MealParseResponse(
        meal_id=meal.id,
        items=[schemas.MealItemOut.model_validate(it) for it in items],
        clarifications=[schemas.ClarificationOut.model_validate(cl) for cl in active_clarifications],
        ai_assumptions=meal.ai_assumptions,
        total_calories=meal.total_calories,
        total_protein=meal.total_protein,
        total_carbs=meal.total_carbs,
        total_fat=meal.total_fat
    )


@router.post("/save", response_model=schemas.MealOut)
def save_meal(payload: schemas.MealSaveRequest, db: Session = Depends(get_db)):
    meal = db.get(models.Meal, payload.meal_id)
    if not meal:
        raise HTTPException(404, "Meal not found")

    items = db.query(models.MealItem).filter(models.MealItem.meal_id == meal.id).all()

    # Apply corrections if sent
    if payload.items:
        for idx, corr in enumerate(payload.items):
            if idx < len(items):
                item = items[idx]
                
                # Check if values actually changed to mark as corrected
                is_changed = False
                if corr.calories is not None and corr.calories != item.calories:
                    item.original_calories = item.calories
                    item.calories = corr.calories
                    is_changed = True
                if corr.protein_g is not None and corr.protein_g != item.protein_g:
                    item.original_protein = item.protein_g
                    item.protein_g = corr.protein_g
                    is_changed = True
                if corr.carbs_g is not None and corr.carbs_g != item.carbs_g:
                    item.original_carbs = item.carbs_g
                    item.carbs_g = corr.carbs_g
                    is_changed = True
                if corr.fat_g is not None and corr.fat_g != item.fat_g:
                    item.original_fat = item.fat_g
                    item.fat_g = corr.fat_g
                    is_changed = True
                
                if corr.food_name is not None and corr.food_name != item.food_name:
                    item.food_name = corr.food_name
                    is_changed = True
                if corr.quantity is not None and corr.quantity != item.quantity:
                    item.quantity = corr.quantity
                    is_changed = True
                if corr.unit is not None and corr.unit != item.unit:
                    item.unit = corr.unit
                    is_changed = True
                if corr.preparation_method is not None and corr.preparation_method != item.preparation_method:
                    item.preparation_method = corr.preparation_method
                    is_changed = True

                if is_changed:
                    item.user_corrected = True

    # Finalize
    meal.is_finalized = True
    
    # Recalculate totals
    meal.total_calories = round(sum(it.calories for it in items), 1)
    meal.total_protein = round(sum(it.protein_g for it in items), 1)
    meal.total_carbs = round(sum(it.carbs_g for it in items), 1)
    meal.total_fat = round(sum(it.fat_g for it in items), 1)

    db.commit()
    db.refresh(meal)
    return meal


@router.get("/daily-summary", response_model=schemas.DailySummary)
def get_daily_summary(date_str: Optional[str] = Query(None, alias="date"), db: Session = Depends(get_db)):
    profile = db.get(models.UserProfile, "default")
    if not profile:
        profile = models.UserProfile(id="default")
        db.add(profile)
        db.commit()
        db.refresh(profile)

    target_date = date.today()
    if date_str:
        try:
            target_date = date.fromisoformat(date_str)
        except ValueError:
            pass

    meals = db.query(models.Meal).filter(
        models.Meal.user_id == profile.id,
        models.Meal.date == target_date,
        models.Meal.is_finalized == True
    ).all()

    total_cal = sum(m.total_calories for m in meals)
    total_p = sum(m.total_protein for m in meals)
    total_c = sum(m.total_carbs for m in meals)
    total_f = sum(m.total_fat for m in meals)

    remaining = float(profile.calorie_target - total_cal)
    pct = round((total_cal / profile.calorie_target) * 100, 1) if profile.calorie_target > 0 else 0.0

    return schemas.DailySummary(
        date=target_date,
        calorie_target=profile.calorie_target,
        total_calories=round(total_cal, 1),
        total_protein=round(total_p, 1),
        total_carbs=round(total_c, 1),
        total_fat=round(total_f, 1),
        meals=meals,
        remaining_calories=round(remaining, 1),
        pct_consumed=pct
    )


@router.get("/history", response_model=list[schemas.MealOut])
def get_meal_history(db: Session = Depends(get_db)):
    return db.query(models.Meal).filter(
        models.Meal.user_id == "default",
        models.Meal.is_finalized == True
    ).order_by(models.Meal.date.desc(), models.Meal.created_at.desc()).all()


@router.get("/insights", response_model=list[schemas.InsightOut])
def get_nutrition_insights(db: Session = Depends(get_db)):
    profile = db.get(models.UserProfile, "default")
    if not profile:
        return []

    # Get last 7 days of daily summaries for insights
    history_items = []
    for i in range(7):
        d = date.today() - timedelta(days=i)
        meals = db.query(models.Meal).filter(
            models.Meal.user_id == profile.id,
            models.Meal.date == d,
            models.Meal.is_finalized == True
        ).all()

        total_cal = sum(m.total_calories for m in meals)
        total_p = sum(m.total_protein for m in meals)
        total_c = sum(m.total_carbs for m in meals)
        total_f = sum(m.total_fat for m in meals)

        # Structure to match what insights prompt expects
        history_items.append({
            "date": d,
            "total_calories": total_cal,
            "total_protein": total_p,
            "total_carbs": total_c,
            "total_fat": total_f,
            "meals": [
                {
                    "meal_type": m.meal_type,
                    "raw_text": m.raw_text,
                    "items": [{"food_name": it.food_name, "calories": it.calories} for it in m.items]
                } for m in meals
            ]
        })

    raw_insights = agent.analyze_insights(profile.calorie_target, history_items)
    
    return [
        schemas.InsightOut(
            type=ins.get("type", "observation"),
            message=ins.get("message", ""),
            supporting_data=ins.get("supporting_data")
        ) for ins in raw_insights
    ]


@router.post("/insights/chat", response_model=schemas.NutritionChatResponse)
def nutrition_chat(payload: schemas.NutritionChatRequest, db: Session = Depends(get_db)):
    """Answer a nutrition question using the profile and the last seven days of logs."""
    question = payload.question.strip()
    if not question:
        raise HTTPException(400, "Please enter a nutrition question.")

    profile = db.get(models.UserProfile, "default")
    if not profile:
        raise HTTPException(404, "Profile not found")

    history = []
    for i in range(7):
        day = date.today() - timedelta(days=i)
        meals = db.query(models.Meal).filter(
            models.Meal.user_id == profile.id,
            models.Meal.date == day,
            models.Meal.is_finalized == True,
        ).all()
        history.append({
            "date": day,
            "total_calories": sum(meal.total_calories for meal in meals),
            "total_protein": sum(meal.total_protein for meal in meals),
            "total_carbs": sum(meal.total_carbs for meal in meals),
            "total_fat": sum(meal.total_fat for meal in meals),
            "meals": [
                {
                    "meal_type": meal.meal_type,
                    "raw_text": meal.raw_text,
                    "items": [{"food_name": item.food_name, "calories": item.calories} for item in meal.items],
                }
                for meal in meals
            ],
        })

    answer = agent.answer_nutrition_question(question, {
        "calorie_target": profile.calorie_target,
        "dietary_preferences": profile.dietary_preferences,
        "allergies": profile.allergies,
        "foods_to_avoid": profile.foods_to_avoid,
    }, history)
    return schemas.NutritionChatResponse(answer=answer)
