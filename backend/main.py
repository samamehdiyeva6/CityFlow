from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import datetime

from controllers.location_controller import router as location_router
from controllers.payment_controller import router as payment_router
from controllers.route_controller import router as route_router
from controllers.trip_controller import router as trip_router
from controllers.waiting_controller import router as waiting_router
from database import engine, get_db
import models
from services.data_service import data_service
from services.location_service import location_service
from services.routing_service import routing_service
from services.waiting_bonus_service import waiting_bonus_service

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="BakuKart API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(location_router)
app.include_router(payment_router)
app.include_router(route_router)
app.include_router(trip_router)
app.include_router(waiting_router)

# Initialize Demo User if not exists
@app.on_event("startup")
def startup_populate():
    db = next(get_db())
    try:
        demo_user = db.query(models.User).filter(models.User.email == "demo@bakukart.az").first()
        if not demo_user:
            new_user = models.User(full_name="Demo User", email="demo@bakukart.az")
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            
            wallet = models.Wallet(user_id=new_user.id, points=1250, co2_saved=4.2, peak_crowds_avoided=12)
            db.add(wallet)

            card_balance = models.CardBalance(user_id=new_user.id, amount_azn=100.0)
            db.add(card_balance)
            db.add(
                models.SignInCredential(
                    user_id=new_user.id,
                    full_name="Demo User",
                    email="demo@bakukart.az",
                    bakikart_id="BK-DEMO-100",
                    phone="+994500000000",
                    password="demo123",
                )
            )
            
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
                db.add(models.CardBalance(user_id=demo_user.id, amount_azn=100.0))
            if not demo_user.sign_in_credential:
                db.add(
                    models.SignInCredential(
                        user_id=demo_user.id,
                        full_name=demo_user.full_name or "Demo User",
                        email=demo_user.email,
                        bakikart_id="BK-DEMO-100",
                        phone="+994500000000",
                        password="demo123",
                    )
                )
            db.commit()

        location_service.ensure_seeded_stops(db)
    finally:
        db.close()

@app.get("/")
async def root():
    return {"message": "BakuKart API is running"}

@app.get("/locations")
async def get_locations():
    return location_service.get_all_location_options()


@app.get("/traffic")
async def get_traffic():
    return data_service.get_traffic_data()

@app.get("/plan")
async def plan_journey(start: str, end: str, time: Optional[str] = None, db: Session = Depends(get_db)):
    planned = await routing_service.plan_routes(start_name=start, end_name=end, desired_time=time, db=db)
    return planned["recommended_routes"]


class JourneyDecisionRequest(BaseModel):
    start: str
    end: str
    route: dict
    selected_time: Optional[str] = None
    waited: bool = False
    wait_skipped_demo: bool = False
    wait_minutes: int = 15
    wait_session_id: Optional[str] = None
    fare_paid: bool = False
    paid_amount_azn: Optional[float] = None


class RegisterRequest(BaseModel):
    full_name: str
    email: str
    bakikart_id: str
    phone: Optional[str] = None
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


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


def _resolve_selection_bonus(route: dict) -> int:
    reward_preview = route.get("reward_preview") or {}
    if reward_preview:
        return int(reward_preview.get("selection_bonus_points", 0) or 0)
    return int(route.get("bonus_points", 0) or 0)


def _get_user_by_email(db: Session, email: Optional[str]) -> models.User:
    if email:
        credential = (
            db.query(models.SignInCredential)
            .filter(models.SignInCredential.email == email.strip().lower())
            .first()
        )
        if credential:
            return db.query(models.User).filter(models.User.id == credential.user_id).first()
    return db.query(models.User).first()


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
    route_bonus = _resolve_selection_bonus(payload.route)
    route_cost = float(payload.route.get("cost", 0.6) or 0.6)
    rush = is_rush_hour(payload.selected_time)
    crowding = int(payload.route.get("crowding", 100) or 100)
    low_density_selected = crowding <= 55

    wait_bonus_points = 0
    wait_bonus_message = ""
    if payload.waited:
        if payload.wait_skipped_demo:
            wait_bonus_points = waiting_bonus_service.extra_wait_bonus_points
            wait_bonus_message = "Demo wait skip aktivdir."
        elif not payload.wait_session_id:
            raise HTTPException(status_code=400, detail="Gözləmə bonus session tapılmadı. Yenidən route seçin.")
        else:
            verified, wait_bonus_message, wait_bonus_points = waiting_bonus_service.verify_wait_bonus(
                db=db,
                user_id=user.id,
                wait_session_id=payload.wait_session_id,
                route=payload.route,
            )
            if not verified:
                raise HTTPException(status_code=400, detail=wait_bonus_message)

    # Fare deduction is handled by /api/v1/payments/* endpoints.
    if not payload.fare_paid:
        earned_points = 0
    elif low_density_selected:
        earned_points = route_bonus
    elif wait_bonus_points > 0:
        earned_points = wait_bonus_points
    else:
        earned_points = 0

    wallet.points += earned_points
    if earned_points > 0:
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
            "cost_deducted": float(payload.paid_amount_azn or route_cost),
            "waited": payload.waited,
            "wait_minutes": payload.wait_minutes,
            "wait_session_id": payload.wait_session_id,
            "wait_skipped_demo": payload.wait_skipped_demo,
            "selection_bonus_points": route_bonus,
            "wait_bonus_points": wait_bonus_points,
            "fare_paid": payload.fare_paid,
            "low_density_selected": low_density_selected,
        },
    )
    db.add(journey)

    if earned_points > 0:
        tx = models.BonusTransaction(
            wallet_id=wallet.id,
            amount=earned_points,
            description=f"Crowd-aware route reward (+{earned_points} pts)",
        )
        db.add(tx)

    db.commit()
    db.refresh(wallet)

    latest_payment = (
        db.query(models.FareTransaction)
        .filter(models.FareTransaction.user_id == user.id)
        .order_by(models.FareTransaction.paid_at.desc())
        .first()
    )

    return {
        "travel_mode_active": True,
        "rush_hour": rush,
        "waited": payload.waited,
        "cost_deducted": round(float(payload.paid_amount_azn or route_cost), 2),
        "bakikart_balance": round(user.card_balance.amount_azn, 2),
        "points_earned": earned_points,
        "wallet_points": wallet.points,
        "wait_bonus_verified": wait_bonus_points > 0,
        "fare_payment_recorded": latest_payment is not None,
        "fare_payment_time": latest_payment.paid_at.isoformat() if latest_payment else None,
        "fare_payment_stop": latest_payment.validator_stop if latest_payment else None,
        "message": (
            f"{wait_bonus_message} AI tövsiyəsinə əməl etdiniz və əlavə bonus qazandınız."
            if wait_bonus_points > 0 else
            (
                "Daha az sıx marşrut seçdiniz və bonus qazandınız."
                if earned_points > 0 else
                (
                    "Ödəniş tamamlanmadan bonus hesablanmır."
                    if not payload.fare_paid else
                    "Bu seçim az sıxlıq qaydasına düşmədiyi üçün bonus hesablanmadı."
                )
            )
        ),
    }


@app.post("/auth/register")
async def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    normalized_email = payload.email.strip().lower()
    existing_credential = (
        db.query(models.SignInCredential)
        .filter(models.SignInCredential.email == normalized_email)
        .first()
    )
    if existing_credential:
        raise HTTPException(status_code=409, detail="Bu email ilə artıq qeydiyyat var. Login edin.")

    existing_user = db.query(models.User).filter(models.User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="Bu email ilə artıq hesab mövcuddur. Login edin.")

    user = models.User(full_name=payload.full_name, email=normalized_email)
    db.add(user)
    db.commit()
    db.refresh(user)

    db.add(models.Wallet(user_id=user.id, points=0, co2_saved=0.0, peak_crowds_avoided=0))
    db.add(models.CardBalance(user_id=user.id, amount_azn=100.0))
    db.add(
        models.SignInCredential(
            user_id=user.id,
            full_name=payload.full_name,
            email=normalized_email,
            bakikart_id=payload.bakikart_id,
            phone=payload.phone,
            password=payload.password,
        )
    )

    db.commit()
    db.refresh(user)
    if user.wallet:
        db.refresh(user.wallet)
    if user.card_balance:
        db.refresh(user.card_balance)

    return {
        "message": "Register successful",
        "profile": {
            "full_name": user.full_name,
            "email": user.email,
            "wallet": {
                "points": user.wallet.points if user.wallet else 0,
                "bakikart_balance": user.card_balance.amount_azn if user.card_balance else 0.0,
                "co2_saved": user.wallet.co2_saved if user.wallet else 0.0,
                "peak_crowds_avoided": user.wallet.peak_crowds_avoided if user.wallet else 0,
            },
        },
    }


@app.post("/auth/login")
async def login(payload: LoginRequest, db: Session = Depends(get_db)):
    normalized_email = payload.email.strip().lower()
    credential = (
        db.query(models.SignInCredential)
        .filter(models.SignInCredential.email == normalized_email)
        .first()
    )
    if not credential:
        raise HTTPException(status_code=404, detail="Hesab tapılmadı. Əvvəlcə qeydiyyatdan keçin.")
    if credential.password != payload.password:
        raise HTTPException(status_code=401, detail="Email və ya şifrə yanlışdır.")

    user = db.query(models.User).filter(models.User.id == credential.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found for login")

    if not user.wallet:
        db.add(models.Wallet(user_id=user.id, points=0, co2_saved=0.0, peak_crowds_avoided=0))
    if not user.card_balance:
        db.add(models.CardBalance(user_id=user.id, amount_azn=100.0))
    db.commit()
    db.refresh(user)
    db.refresh(user.wallet)
    db.refresh(user.card_balance)

    return {
        "message": "Login successful",
        "profile": {
            "full_name": user.full_name,
            "email": user.email,
            "wallet": {
                "points": user.wallet.points,
                "bakikart_balance": user.card_balance.amount_azn,
                "co2_saved": user.wallet.co2_saved,
                "peak_crowds_avoided": user.wallet.peak_crowds_avoided,
            },
        },
    }

@app.get("/user/profile")
async def get_profile(email: Optional[str] = None, db: Session = Depends(get_db)):
    user = _get_user_by_email(db, email)
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
        "fare_transactions": db.query(models.FareTransaction).filter(models.FareTransaction.user_id == user.id).order_by(models.FareTransaction.paid_at.desc()).all(),
        "coupons": user.coupons
    }

@app.get("/coupons")
async def get_coupons(db: Session = Depends(get_db)):
    return db.query(models.Coupon).all()
