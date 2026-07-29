from datetime import datetime, date
from typing import Any, Optional

from pydantic import BaseModel


# ---------- Profile ----------
class ProfileCreate(BaseModel):
    name: str = "User"
    calorie_target: int = 2000
    dietary_preferences: list[str] = []
    allergies: list[str] = []
    foods_to_avoid: list[str] = []


class ProfileOut(BaseModel):
    id: str
    name: str
    calorie_target: int
    dietary_preferences: list[str]
    allergies: list[str]
    foods_to_avoid: list[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Meal Items ----------
class MealItemIn(BaseModel):
    food_name: str
    quantity: float = 1
    unit: str = "serving"
    preparation_method: Optional[str] = None
    calories: float = 0
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0


class MealItemOut(BaseModel):
    id: str
    food_name: str
    quantity: float
    unit: str
    preparation_method: Optional[str]
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    source: str
    confidence: str
    user_corrected: bool
    original_calories: Optional[float] = None
    original_protein: Optional[float] = None
    original_carbs: Optional[float] = None
    original_fat: Optional[float] = None
    kb_entry_name: Optional[str] = None
    source_citation: Optional[str] = None

    class Config:
        from_attributes = True


class MealItemCorrection(BaseModel):
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    food_name: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    preparation_method: Optional[str] = None


# ---------- Clarification ----------
class ClarificationOut(BaseModel):
    id: str
    question_text: str
    options: list[str]
    answer_text: Optional[str]
    item_index: Optional[int]
    status: str

    class Config:
        from_attributes = True


class ClarificationAnswer(BaseModel):
    answer_text: str


# ---------- Meals ----------
class MealParseRequest(BaseModel):
    raw_text: str
    meal_type: str = "lunch"  # breakfast | lunch | dinner | snack
    date: Optional[str] = None  # YYYY-MM-DD, defaults to today


class MealParseResponse(BaseModel):
    meal_id: str
    items: list[MealItemOut]
    clarifications: list[ClarificationOut]
    ai_assumptions: list[str]
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fat: float


class MealSaveRequest(BaseModel):
    meal_id: str
    items: Optional[list[MealItemCorrection]] = None  # user corrections keyed by index


class MealOut(BaseModel):
    id: str
    date: date
    meal_type: str
    raw_text: str
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fat: float
    ai_assumptions: list[str]
    is_finalized: bool
    items: list[MealItemOut]
    created_at: datetime

    class Config:
        from_attributes = True


class DailySummary(BaseModel):
    date: date
    calorie_target: int
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fat: float
    meals: list[MealOut]
    remaining_calories: float
    pct_consumed: float


# ---------- Meal Plans ----------
class MealPlanItemOut(BaseModel):
    id: str
    meal_type: str
    food_name: str
    quantity: float
    unit: str
    preparation_method: Optional[str]
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    source_citation: Optional[str] = None

    class Config:
        from_attributes = True


class MealPlanOut(BaseModel):
    id: str
    plan_date: date
    status: str
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fat: float
    ai_rationale: Optional[str]
    items: list[MealPlanItemOut]
    created_at: datetime

    class Config:
        from_attributes = True


class MealPlanEditRequest(BaseModel):
    items: list[dict]  # updated items


class MealPlanGenerateRequest(BaseModel):
    plan_date: Optional[str] = None  # YYYY-MM-DD, defaults to tomorrow


# ---------- Knowledge Base ----------
class KBEntryOut(BaseModel):
    id: str
    food_name: str
    serving_size: float
    unit: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    preparation_method: Optional[str]
    source_citation: Optional[str]

    class Config:
        from_attributes = True


# ---------- Insights ----------
class InsightOut(BaseModel):
    type: str  # observation | suggestion | warning
    message: str
    supporting_data: Optional[dict] = None
