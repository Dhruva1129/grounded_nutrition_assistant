from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine, seed_knowledge_base
from app.routers import profile, meals, meal_plans, knowledge, wellness

settings = get_settings()

# Initialize tables
Base.metadata.create_all(bind=engine)

# Seed the database knowledge base and default user profile
seed_knowledge_base()

app = FastAPI(
    title="Knowledge-Grounded Nutrition Planning Assistant",
    description="Wellness application for nutrition tracking and AI meal planning.",
    version="1.0.0",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(profile.router)
app.include_router(meals.router)
app.include_router(meal_plans.router)
app.include_router(knowledge.router)
app.include_router(wellness.router)


@app.get("/health")
def health():
    return {"status": "ok", "app": "Nutrition Planning Assistant"}


@app.get("/disclaimer")
def disclaimer():
    return {
        "disclaimer": "This application is a wellness assistant designed for educational and informational purposes only. It is not intended to diagnose, treat, cure, or prevent any health condition or disease, nor should it substitute professional medical advice, diagnosis, or treatment. Always consult a qualified medical professional or registered dietitian before starting any new diet or exercise regimen."
    }
