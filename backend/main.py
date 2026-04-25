from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional

from database import engine, get_db
import models
from services.data_service import data_service
from services.routing_service import routing_service

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="BakuKart API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Demo User if not exists
@app.on_event("startup")
def startup_populate():
    db = next(get_db())
    demo_user = db.query(models.User).filter(models.User.email == "demo@bakukart.az").first()
    if not demo_user:
        new_user = models.User(full_name="Demo User", email="demo@bakukart.az")
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        wallet = models.Wallet(user_id=new_user.id, points=1250, co2_saved=4.2, peak_crowds_avoided=12)
        db.add(wallet)
        
        # Add some coupons
        coupons = [
            models.Coupon(title="Espresso Baku", description="Free Flat White", cost_points=150, partner_name="Espresso Baku"),
            models.Coupon(title="Baku Metro", description="10-Trip Transit Pass", cost_points=800, partner_name="Baku Metro"),
            models.Coupon(title="BookZone Library", description="Any Paperback -25%", cost_points=300, partner_name="BookZone Library"),
        ]
        db.add_all(coupons)
        db.commit()

@app.get("/")
async def root():
    return {"message": "BakuKart API is running"}

@app.get("/locations")
async def get_locations():
    return data_service.get_all_locations()

@app.get("/plan")
async def plan_journey(start: str, end: str, time: Optional[str] = None):
    routes = await routing_service.find_routes(start, end, time)
    if not routes:
        raise HTTPException(status_code=404, detail="No routes found")
    return routes

@app.get("/user/profile")
async def get_profile(db: Session = Depends(get_db)):
    user = db.query(models.User).first() # Just get the first user for demo
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "full_name": user.full_name,
        "email": user.email,
        "wallet": {
            "points": user.wallet.points,
            "co2_saved": user.wallet.co2_saved,
            "peak_crowds_avoided": user.wallet.peak_crowds_avoided
        },
        "history": user.journeys,
        "coupons": user.coupons
    }

@app.get("/coupons")
async def get_coupons(db: Session = Depends(get_db)):
    return db.query(models.Coupon).all()
