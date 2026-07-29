from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=schemas.ProfileOut)
def get_profile(db: Session = Depends(get_db)):
    profile = db.get(models.UserProfile, "default")
    if not profile:
        profile = models.UserProfile(
            id="default",
            name="Default User",
            calorie_target=2000,
            dietary_preferences=[],
            allergies=[],
            foods_to_avoid=[]
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.post("", response_model=schemas.ProfileOut)
def update_profile(payload: schemas.ProfileCreate, db: Session = Depends(get_db)):
    profile = db.get(models.UserProfile, "default")
    if not profile:
        profile = models.UserProfile(id="default")
        db.add(profile)

    profile.name = payload.name
    profile.calorie_target = payload.calorie_target
    profile.dietary_preferences = payload.dietary_preferences
    profile.allergies = payload.allergies
    profile.foods_to_avoid = payload.foods_to_avoid

    db.commit()
    db.refresh(profile)
    return profile
