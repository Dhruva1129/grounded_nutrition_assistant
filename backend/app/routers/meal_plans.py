from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, agent

router = APIRouter(prefix="/meal-plans", tags=["meal-plans"])


@router.post("/generate", response_model=schemas.MealPlanOut)
def generate_meal_plan_endpoint(payload: schemas.MealPlanGenerateRequest, db: Session = Depends(get_db)):
    profile = db.get(models.UserProfile, "default")
    if not profile:
        profile = models.UserProfile(id="default")
        db.add(profile)
        db.commit()
        db.refresh(profile)

    target_date = date.today() + timedelta(days=1)
    if payload.plan_date:
        try:
            target_date = date.fromisoformat(payload.plan_date)
        except ValueError:
            pass

    # Delete any existing draft/rejected meal plans for that date to avoid duplication
    existing = db.query(models.MealPlan).filter(
        models.MealPlan.user_id == profile.id,
        models.MealPlan.plan_date == target_date,
        models.MealPlan.status.in_(["draft", "rejected"])
    ).all()
    for ex in existing:
        db.delete(ex)
    db.flush()

    # Get KB items
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

    # Generate plan
    plan_data = agent.generate_meal_plan({
        "calorie_target": profile.calorie_target,
        "dietary_preferences": profile.dietary_preferences,
        "allergies": profile.allergies,
        "foods_to_avoid": profile.foods_to_avoid
    }, kb_dicts)

    plan = models.MealPlan(
        user_id=profile.id,
        plan_date=target_date,
        status="draft",
        total_calories=plan_data.get("total_calories", 0.0),
        total_protein=plan_data.get("total_protein", 0.0),
        total_carbs=plan_data.get("total_carbs", 0.0),
        total_fat=plan_data.get("total_fat", 0.0),
        ai_rationale=plan_data.get("ai_rationale")
    )
    db.add(plan)
    db.flush()

    items_saved = []
    for item in plan_data.get("items", []):
        plan_item = models.MealPlanItem(
            plan_id=plan.id,
            meal_type=item.get("meal_type", "breakfast"),
            food_name=item.get("food_name"),
            quantity=item.get("quantity", 1.0),
            unit=item.get("unit", "serving"),
            preparation_method=item.get("preparation_method"),
            calories=item.get("calories", 0.0),
            protein_g=item.get("protein_g", 0.0),
            carbs_g=item.get("carbs_g", 0.0),
            fat_g=item.get("fat_g", 0.0),
            source_citation=item.get("source_citation")
        )
        db.add(plan_item)
        items_saved.append(plan_item)

    db.commit()
    db.refresh(plan)
    return plan


@router.post("/{plan_id}/approve", response_model=schemas.MealPlanOut)
def approve_meal_plan(plan_id: str, db: Session = Depends(get_db)):
    plan = db.get(models.MealPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Meal plan not found")
    
    plan.status = "approved"
    plan.decided_at = datetime.utcnow()
    db.commit()
    db.refresh(plan)
    return plan


@router.post("/{plan_id}/reject", response_model=schemas.MealPlanOut)
def reject_meal_plan(plan_id: str, db: Session = Depends(get_db)):
    plan = db.get(models.MealPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Meal plan not found")
    
    plan.status = "rejected"
    plan.decided_at = datetime.utcnow()
    db.commit()
    db.refresh(plan)
    return plan


@router.patch("/{plan_id}", response_model=schemas.MealPlanOut)
def edit_meal_plan(plan_id: str, payload: schemas.MealPlanEditRequest, db: Session = Depends(get_db)):
    plan = db.get(models.MealPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Meal plan not found")

    # Delete existing items
    db.query(models.MealPlanItem).filter(models.MealPlanItem.plan_id == plan.id).delete()

    # Add new items
    total_cal = 0.0
    total_p = 0.0
    total_c = 0.0
    total_f = 0.0

    for item in payload.items:
        plan_item = models.MealPlanItem(
            plan_id=plan.id,
            meal_type=item.get("meal_type", "breakfast"),
            food_name=item.get("food_name"),
            quantity=item.get("quantity", 1.0),
            unit=item.get("unit", "serving"),
            preparation_method=item.get("preparation_method"),
            calories=item.get("calories", 0.0),
            protein_g=item.get("protein_g", 0.0),
            carbs_g=item.get("carbs_g", 0.0),
            fat_g=item.get("fat_g", 0.0),
            source_citation=item.get("source_citation")
        )
        db.add(plan_item)
        total_cal += plan_item.calories
        total_p += plan_item.protein_g
        total_c += plan_item.carbs_g
        total_f += plan_item.fat_g

    plan.total_calories = round(total_cal, 1)
    plan.total_protein = round(total_p, 1)
    plan.total_carbs = round(total_c, 1)
    plan.total_fat = round(total_f, 1)
    plan.status = "edited"
    plan.decided_at = datetime.utcnow()

    db.commit()
    db.refresh(plan)
    return plan


@router.get("", response_model=list[schemas.MealPlanOut])
def get_meal_plans(db: Session = Depends(get_db)):
    return db.query(models.MealPlan).filter(
        models.MealPlan.user_id == "default"
    ).order_by(models.MealPlan.plan_date.desc(), models.MealPlan.created_at.desc()).all()


@router.get("/{plan_id}", response_model=schemas.MealPlanOut)
def get_meal_plan(plan_id: str, db: Session = Depends(get_db)):
    plan = db.get(models.MealPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Meal plan not found")
    return plan


@router.get("/{plan_id}/grocery-list")
def get_grocery_list(plan_id: str, db: Session = Depends(get_db)):
    plan = db.get(models.MealPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Meal plan not found")
    grouped = {}
    for item in plan.items:
        key = (item.food_name, item.unit)
        grouped[key] = grouped.get(key, 0) + item.quantity
    return {"plan_id": plan.id, "items": [
        {"food_name": name, "quantity": round(quantity, 1), "unit": unit}
        for (name, unit), quantity in sorted(grouped.items())
    ]}
