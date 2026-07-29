from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/knowledge-base", tags=["knowledge-base"])


@router.get("", response_model=list[schemas.KBEntryOut])
def get_knowledge_base(q: Optional[str] = Query(None), db: Session = Depends(get_db)):
    query = db.query(models.NutritionKnowledge)
    if q:
        query = query.filter(models.NutritionKnowledge.food_name.ilike(f"%{q}%"))
    return query.order_by(models.NutritionKnowledge.food_name.asc()).all()


@router.get("/{item_id}", response_model=schemas.KBEntryOut)
def get_knowledge_base_item(item_id: str, db: Session = Depends(get_db)):
    item = db.get(models.NutritionKnowledge, item_id)
    if not item:
        raise HTTPException(404, "Knowledge base item not found")
    return item
