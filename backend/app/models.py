import uuid
from datetime import datetime, date

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Date, ForeignKey, JSON, Text
)
from sqlalchemy.orm import relationship

from app.database import Base


def gen_id() -> str:
    return uuid.uuid4().hex


class UserProfile(Base):
    """User profile with nutrition targets and preferences."""
    __tablename__ = "user_profiles"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False, default="User")
    calorie_target = Column(Integer, nullable=False, default=2000)
    dietary_preferences = Column(JSON, default=list)   # ["vegetarian", "keto", ...]
    allergies = Column(JSON, default=list)              # ["peanuts", "shellfish", ...]
    foods_to_avoid = Column(JSON, default=list)         # ["broccoli", "tofu", ...]
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    meals = relationship("Meal", back_populates="user", cascade="all, delete-orphan")
    meal_plans = relationship("MealPlan", back_populates="user", cascade="all, delete-orphan")


class Meal(Base):
    """A recorded meal with parsed food items."""
    __tablename__ = "meals"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("user_profiles.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, default=date.today)
    meal_type = Column(String, nullable=False)  # breakfast | lunch | dinner | snack
    raw_text = Column(Text, nullable=False)      # original user input
    total_calories = Column(Float, default=0)
    total_protein = Column(Float, default=0)
    total_carbs = Column(Float, default=0)
    total_fat = Column(Float, default=0)
    ai_assumptions = Column(JSON, default=list)  # list of assumption strings
    is_finalized = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("UserProfile", back_populates="meals")
    items = relationship("MealItem", back_populates="meal", cascade="all, delete-orphan")
    clarifications = relationship("ClarificationQuestion", back_populates="meal", cascade="all, delete-orphan")


class MealItem(Base):
    """A single food item within a meal."""
    __tablename__ = "meal_items"

    id = Column(String, primary_key=True, default=gen_id)
    meal_id = Column(String, ForeignKey("meals.id"), nullable=False, index=True)
    food_name = Column(String, nullable=False)
    quantity = Column(Float, nullable=False, default=1)
    unit = Column(String, default="serving")
    preparation_method = Column(String, nullable=True)
    calories = Column(Float, default=0)
    protein_g = Column(Float, default=0)
    carbs_g = Column(Float, default=0)
    fat_g = Column(Float, default=0)
    source = Column(String, default="knowledge_base")  # knowledge_base | ai_estimate
    confidence = Column(String, default="high")          # high | medium | low
    user_corrected = Column(Boolean, default=False)
    original_calories = Column(Float, nullable=True)     # saved when user corrects
    original_protein = Column(Float, nullable=True)
    original_carbs = Column(Float, nullable=True)
    original_fat = Column(Float, nullable=True)
    kb_entry_name = Column(String, nullable=True)        # which KB entry was matched
    source_citation = Column(String, nullable=True)

    meal = relationship("Meal", back_populates="items")


class ClarificationQuestion(Base):
    """AI-generated clarification question for ambiguous meal input."""
    __tablename__ = "clarification_questions"

    id = Column(String, primary_key=True, default=gen_id)
    meal_id = Column(String, ForeignKey("meals.id"), nullable=False, index=True)
    question_text = Column(Text, nullable=False)
    options = Column(JSON, default=list)        # suggested answers
    answer_text = Column(Text, nullable=True)
    item_index = Column(Integer, nullable=True)  # which item this relates to
    status = Column(String, default="pending")   # pending | answered
    created_at = Column(DateTime, default=datetime.utcnow)

    meal = relationship("Meal", back_populates="clarifications")


class MealPlan(Base):
    """AI-generated meal plan for a target day."""
    __tablename__ = "meal_plans"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("user_profiles.id"), nullable=False, index=True)
    plan_date = Column(Date, nullable=False)
    status = Column(String, default="draft")  # draft | approved | rejected | edited
    total_calories = Column(Float, default=0)
    total_protein = Column(Float, default=0)
    total_carbs = Column(Float, default=0)
    total_fat = Column(Float, default=0)
    ai_rationale = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    decided_at = Column(DateTime, nullable=True)

    user = relationship("UserProfile", back_populates="meal_plans")
    items = relationship("MealPlanItem", back_populates="plan", cascade="all, delete-orphan")


class MealPlanItem(Base):
    """A single food item in a meal plan."""
    __tablename__ = "meal_plan_items"

    id = Column(String, primary_key=True, default=gen_id)
    plan_id = Column(String, ForeignKey("meal_plans.id"), nullable=False, index=True)
    meal_type = Column(String, nullable=False)  # breakfast | lunch | dinner | snack
    food_name = Column(String, nullable=False)
    quantity = Column(Float, default=1)
    unit = Column(String, default="serving")
    preparation_method = Column(String, nullable=True)
    calories = Column(Float, default=0)
    protein_g = Column(Float, default=0)
    carbs_g = Column(Float, default=0)
    fat_g = Column(Float, default=0)
    source_citation = Column(String, nullable=True)

    plan = relationship("MealPlan", back_populates="items")


class NutritionKnowledge(Base):
    """Knowledge base entry for a food item."""
    __tablename__ = "nutrition_knowledge"

    id = Column(String, primary_key=True, default=gen_id)
    food_name = Column(String, nullable=False, index=True)
    serving_size = Column(Float, nullable=False)
    unit = Column(String, nullable=False)
    calories = Column(Float, nullable=False)
    protein_g = Column(Float, default=0)
    carbs_g = Column(Float, default=0)
    fat_g = Column(Float, default=0)
    preparation_method = Column(String, nullable=True)
    source_citation = Column(String, nullable=True)
