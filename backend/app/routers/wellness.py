from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(tags=["wellness"])


def _profile(db: Session):
    profile = db.get(models.UserProfile, "default")
    if not profile:
        raise HTTPException(404, "Profile not found")
    return profile


@router.get("/wellness/settings", response_model=schemas.NutritionSettingsOut)
def get_settings(db: Session = Depends(get_db)):
    profile = _profile(db)
    settings = db.get(models.NutritionSettings, profile.id)
    if not settings:
        settings = models.NutritionSettings(user_id=profile.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.put("/wellness/settings", response_model=schemas.NutritionSettingsOut)
def update_settings(payload: schemas.NutritionSettingsIn, db: Session = Depends(get_db)):
    profile = _profile(db)
    settings = db.get(models.NutritionSettings, profile.id) or models.NutritionSettings(user_id=profile.id)
    settings.goal = payload.goal
    settings.protein_target_g = payload.protein_target_g
    settings.carbs_target_g = payload.carbs_target_g
    settings.fat_target_g = payload.fat_target_g
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


@router.get("/wellness/daily", response_model=schemas.DailyWellnessLogOut)
def get_daily_wellness(db: Session = Depends(get_db)):
    profile = _profile(db)
    entry = db.query(models.DailyWellnessLog).filter_by(user_id=profile.id, log_date=date.today()).first()
    if not entry:
        return schemas.DailyWellnessLogOut(log_date=date.today())
    return entry


@router.put("/wellness/daily", response_model=schemas.DailyWellnessLogOut)
def save_daily_wellness(payload: schemas.DailyWellnessLogIn, db: Session = Depends(get_db)):
    profile = _profile(db)
    entry = db.query(models.DailyWellnessLog).filter_by(user_id=profile.id, log_date=date.today()).first()
    if not entry:
        entry = models.DailyWellnessLog(user_id=profile.id, log_date=date.today())
    for field, value in payload.model_dump().items():
        setattr(entry, field, value)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/wellness/trends")
def weekly_trends(db: Session = Depends(get_db)):
    profile = _profile(db)
    days, logged_dates = [], set()
    for offset in range(6, -1, -1):
        day = date.today() - timedelta(days=offset)
        meals = db.query(models.Meal).filter_by(user_id=profile.id, date=day, is_finalized=True).all()
        total = sum(meal.total_calories for meal in meals)
        protein = sum(meal.total_protein for meal in meals)
        if meals:
            logged_dates.add(day)
        days.append({"date": day.isoformat(), "calories": round(total, 1), "protein": round(protein, 1), "meal_count": len(meals)})
    streak, cursor = 0, date.today()
    while cursor in logged_dates:
        streak += 1
        cursor -= timedelta(days=1)
    active = [entry for entry in days if entry["meal_count"]]
    return {"days": days, "streak": streak, "average_calories": round(sum(x["calories"] for x in active) / len(active), 1) if active else 0, "average_protein": round(sum(x["protein"] for x in active) / len(active), 1) if active else 0}


@router.get("/favorites", response_model=list[schemas.FavoriteMealOut])
def list_favorites(db: Session = Depends(get_db)):
    profile = _profile(db)
    return db.query(models.FavoriteMeal).filter_by(user_id=profile.id).order_by(models.FavoriteMeal.created_at.desc()).all()


@router.post("/favorites", response_model=schemas.FavoriteMealOut)
def create_favorite(payload: schemas.FavoriteMealIn, db: Session = Depends(get_db)):
    profile = _profile(db)
    favorite = models.FavoriteMeal(user_id=profile.id, **payload.model_dump())
    db.add(favorite)
    db.commit()
    db.refresh(favorite)
    return favorite


@router.delete("/favorites/{favorite_id}", status_code=204)
def delete_favorite(favorite_id: str, db: Session = Depends(get_db)):
    profile = _profile(db)
    favorite = db.get(models.FavoriteMeal, favorite_id)
    if not favorite or favorite.user_id != profile.id:
        raise HTTPException(404, "Favorite not found")
    db.delete(favorite)
    db.commit()


@router.get("/privacy/export")
def export_data(db: Session = Depends(get_db)):
    profile = _profile(db)
    meals = db.query(models.Meal).filter_by(user_id=profile.id, is_finalized=True).all()
    return {"profile": {"name": profile.name, "calorie_target": profile.calorie_target}, "meals": [{"date": meal.date.isoformat(), "meal_type": meal.meal_type, "description": meal.raw_text, "calories": meal.total_calories, "protein_g": meal.total_protein, "carbs_g": meal.total_carbs, "fat_g": meal.total_fat} for meal in meals]}


@router.delete("/privacy/data", status_code=204)
def delete_personal_data(db: Session = Depends(get_db)):
    """Remove the default user's meal, favorite, and wellness records; retain the profile."""
    profile = _profile(db)
    db.query(models.FavoriteMeal).filter_by(user_id=profile.id).delete()
    db.query(models.DailyWellnessLog).filter_by(user_id=profile.id).delete()
    db.query(models.Meal).filter_by(user_id=profile.id).delete()
    db.query(models.MealPlan).filter_by(user_id=profile.id).delete()
    db.commit()
