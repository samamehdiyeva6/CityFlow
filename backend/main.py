from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import datetime

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

        card_balance = models.CardBalance(user_id=new_user.id, amount_azn=15.0)
        db.add(card_balance)
        
        # Add some coupons
        coupons = [
            models.Coupon(title="Espresso Baku", description="Free Flat White", cost_points=150, partner_name="Espresso Baku"),
            models.Coupon(title="Baku Metro", description="10-Trip Transit Pass", cost_points=800, partner_name="Baku Metro"),
            models.Coupon(title="BookZone Library", description="Any Paperback -25%", cost_points=300, partner_name="BookZone Library"),
        ]
        db.add_all(coupons)
        db.commit()
    else:
        if not demo_user.wallet:
            db.add(models.Wallet(user_id=demo_user.id, points=1250, co2_saved=4.2, peak_crowds_avoided=12))
        if not demo_user.card_balance:
            db.add(models.CardBalance(user_id=demo_user.id, amount_azn=15.0))
        db.commit()

@app.get("/")
async def root():
    return {"message": "BakuKart API is running"}

@app.get("/locations")
async def get_locations():
    return data_service.get_all_locations()


@app.get("/traffic")
async def get_traffic():
    return data_service.get_traffic_data()

@app.get("/plan")
async def plan_journey(start: str, end: str, time: Optional[str] = None):
    routes = await routing_service.find_routes(start, end, time)
    return routes


class JourneyDecisionRequest(BaseModel):
    start: str
    end: str
    route: dict
    selected_time: Optional[str] = None
    waited: bool = False
    wait_minutes: int = 15


def is_rush_hour(time_str: Optional[str]) -> bool:
    traffic = data_service.get_traffic_data()
    if not time_str:
        now = datetime.datetime.now().time()
    else:
        try:
            now = datetime.datetime.strptime(time_str, "%H:%M").time()
        except Exception:
            now = datetime.datetime.now().time()

    for rush in traffic.get("rush_hours", []):
        try:
            start, end = rush.split("-")
            start_t = datetime.datetime.strptime(start, "%H:%M").time()
            end_t = datetime.datetime.strptime(end, "%H:%M").time()
            if start_t <= now <= end_t:
                return True
        except Exception:
            continue
    return False


@app.post("/journey/decision")
async def journey_decision(payload: JourneyDecisionRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.wallet:
        wallet = models.Wallet(user_id=user.id, points=0, co2_saved=0.0, peak_crowds_avoided=0)
        db.add(wallet)
        db.commit()
        db.refresh(user)

    if not user.card_balance:
        db.add(models.CardBalance(user_id=user.id, amount_azn=10.0))
        db.commit()
        db.refresh(user)

    wallet = user.wallet
    card_balance = user.card_balance
    route_bonus = int(payload.route.get("bonus_points", 0) or 0)
    route_cost = float(payload.route.get("cost", 0.6) or 0.6)
    rush = is_rush_hour(payload.selected_time)

    if card_balance.amount_azn < route_cost:
        raise HTTPException(status_code=400, detail="Bakikart balansı kifayət etmir")

    card_balance.amount_azn -= route_cost

    # Rule: off-peak payment gives points, peak-hour payment gives no points.
    earned_points = route_bonus if not rush else 0

    wallet.points += earned_points
    if not rush:
        wallet.peak_crowds_avoided += 1

    journey = models.JourneyHistory(
        user_id=user.id,
        start_location=payload.start,
        end_location=payload.end,
        points_earned=earned_points,
        route_details={
            "selected_route": payload.route,
            "selected_time": payload.selected_time,
            "rush_hour": rush,
            "cost_deducted": route_cost,
            "waited": payload.waited,
            "wait_minutes": payload.wait_minutes,
        },
    )
    db.add(journey)

    if earned_points > 0:
        tx = models.BonusTransaction(
            wallet_id=wallet.id,
            amount=earned_points,
            description=f"Off-peak reward (+{earned_points} pts)",
        )
        db.add(tx)

    db.commit()
    db.refresh(wallet)

    return {
        "travel_mode_active": True,
        "rush_hour": rush,
        "waited": payload.waited,
        "cost_deducted": round(route_cost, 2),
        "bakikart_balance": round(card_balance.amount_azn, 2),
        "points_earned": earned_points,
        "wallet_points": wallet.points,
        "message": "AI tövsiyə olunan off-peak saatda ödəniş etdiniz, bonus qazandınız." if not rush else "Pik saatda ödəniş etdiniz, bonus verilmədi.",
    }

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
            "bakikart_balance": user.card_balance.amount_azn if user.card_balance else 0.0,
            "co2_saved": user.wallet.co2_saved,
            "peak_crowds_avoided": user.wallet.peak_crowds_avoided
        },
        "history": user.journeys,
        "coupons": user.coupons
    }

@app.get("/coupons")
async def get_coupons(db: Session = Depends(get_db)):
    return db.query(models.Coupon).all()
