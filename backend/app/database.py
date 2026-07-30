import json
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import get_settings

settings = get_settings()

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def seed_knowledge_base():
    from app import models
    db = SessionLocal()
    try:
        kb_path = os.path.join(os.path.dirname(__file__), "nutrition_kb.json")
        if not os.path.exists(kb_path):
            return

        with open(kb_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        existing_names = {name for (name,) in db.query(models.NutritionKnowledge.food_name).all()}
        for item in data:
            if item["food_name"] in existing_names:
                continue
            entry = models.NutritionKnowledge(
                food_name=item["food_name"],
                serving_size=item["serving_size"],
                unit=item["unit"],
                calories=item["calories"],
                protein_g=item.get("protein_g", 0.0),
                carbs_g=item.get("carbs_g", 0.0),
                fat_g=item.get("fat_g", 0.0),
                preparation_method=item.get("preparation_method"),
                source_citation=item.get("source_citation")
            )
            db.add(entry)
        
        # Also seed a default profile if none exists
        if db.query(models.UserProfile).first() is None:
            default_profile = models.UserProfile(
                id="default",
                name="Default User",
                calorie_target=2000,
                dietary_preferences=[],
                allergies=[],
                foods_to_avoid=[]
            )
            db.add(default_profile)

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()
