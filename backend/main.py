from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import importlib
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import datetime
import os
import uuid
from datetime import timedelta
from dotenv import load_dotenv
from fastapi.responses import JSONResponse

try:
    from mangum import Mangum
except Exception:
    Mangum = None

from database import engine, get_db
import models
from services.data_service import data_service
from services.location_service import location_service
from services.routing_service import routing_service
from services.waiting_bonus_service import waiting_bonus_service

app = FastAPI(title="CityFlow API")

load_dotenv()

def _resolve_cors_origins() -> list[str]:
    env_value = (
        os.getenv("CORS_ORIGINS")
        or os.getenv("FRONTEND_ORIGIN")
        or os.getenv("FRONTEND_URL")
        or ""
    )
    if env_value:
        return [origin.strip() for origin in env_value.split(",") if origin.strip()]

    return [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]


cors_origins = _resolve_cors_origins()
cors_origin_regex = os.getenv("CORS_ORIGIN_REGEX") or r"https://.*\.vercel\.app"

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _include_routers_safely(application: FastAPI):
    router_modules = [
        "controllers.location_controller",
        "controllers.payment_controller",
        "controllers.route_controller",
        "controllers.trip_controller",
        "controllers.waiting_controller",
    ]

    for module_name in router_modules:
        try:
            module = importlib.import_module(module_name)
            router = getattr(module, "router", None)
            if router is not None:
                application.include_router(router)
        except Exception as exc:
            print(f"Router include skipped for {module_name}: {exc}")


_include_routers_safely(app)


def _ensure_database_schema():
    try:
        models.Base.metadata.create_all(bind=engine)
    except Exception as exc:
        print(f"Database schema initialization failed: {exc}")


def _cleanup_cached_crowding(db: Session):
    # Remove cached wait-bonus snapshots that contain out-of-range historical scores.
    deleted_count = (
        db.query(models.WaitBonusSession)
        .filter(
            (models.WaitBonusSession.current_density_score > 90)
            | (models.WaitBonusSession.projected_density_score > 90)
        )
        .delete(synchronize_session=False)
    )

    # Normalize persisted journey snapshots if old crowding values were stored > 90.
    any_changed = False
    journeys = db.query(models.JourneyHistory).all()
    for journey in journeys:
        row_changed = False
        details = journey.route_details or {}
        selected_route = details.get("selected_route") or {}
        density_prediction = selected_route.get("density_prediction") or {}

        current_crowding = selected_route.get("crowding")
        if isinstance(current_crowding, (int, float)) and current_crowding > 90:
            selected_route["crowding"] = 90
            row_changed = True

        density_score = density_prediction.get("score")
        if isinstance(density_score, (int, float)) and density_score > 90:
            density_prediction["score"] = 90
            selected_route["density_prediction"] = density_prediction
            row_changed = True

        if row_changed:
            details["selected_route"] = selected_route
            journey.route_details = details
            any_changed = True

    if any_changed or deleted_count > 0:
        db.commit()

# Initialize Demo User if not exists
@app.on_event("startup")
def startup_populate():
    _ensure_database_schema()

    try:
        db = next(get_db())
    except Exception as exc:
        print(f"Database session bootstrap failed: {exc}")
        return

    try:
        desired_coupons = [
            {
                "partner_name": "Espresso Baku",
                "title": "Espresso endirimi",
                "description": "İstənilən içkiyə 20% endirim",
                "cost_points": 150,
                "image_url": None,
            },
            {
                "partner_name": "Costa Baku",
                "title": "Costa endirimi",
                "description": "İstənilən məhsula 15% endirim",
                "cost_points": 200,
                "image_url": None,
            },
            {
                "partner_name": "Skuter",
                "title": "Skuter kuponu",
                "description": "Skuter gedişinə 25% endirim",
                "cost_points": 400,
                "image_url": None,
            },
            {
                "partner_name": "Velosiped",
                "title": "Velosiped kuponu",
                "description": "Velosiped icarəsinə 20% endirim",
                "cost_points": 350,
                "image_url": None,
            },
        ]
        allowed_partners = {c["partner_name"] for c in desired_coupons}

        demo_user = db.query(models.User).filter(models.User.email == "demo@bakukart.az").first()
        if not demo_user:
            new_user = models.User(full_name="Demo User", email="demo@bakukart.az")
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            
            wallet = models.Wallet(user_id=new_user.id, points=2000, co2_saved=4.2, peak_crowds_avoided=12)
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
            
            db.add_all(
                [
                    models.Coupon(
                        title=c["title"],
                        description=c["description"],
                        cost_points=c["cost_points"],
                        partner_name=c["partner_name"],
                        image_url=c["image_url"],
                    )
                    for c in desired_coupons
                ]
            )
            db.commit()
        else:
            if not demo_user.wallet:
                db.add(models.Wallet(user_id=demo_user.id, points=2000, co2_saved=4.2, peak_crowds_avoided=12))
            else:
                demo_user.wallet.points = 2000
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

        existing = db.query(models.Coupon).all()
        existing_by_partner = {c.partner_name: c for c in existing if c.partner_name}
        changed = False
        for desired in desired_coupons:
            partner = desired["partner_name"]
            row = existing_by_partner.get(partner)
            if not row:
                db.add(
                    models.Coupon(
                        title=desired["title"],
                        description=desired["description"],
                        cost_points=desired["cost_points"],
                        partner_name=partner,
                        image_url=desired["image_url"],
                    )
                )
                changed = True
            else:
                if row.title != desired["title"]:
                    row.title = desired["title"]
                    changed = True
                if row.description != desired["description"]:
                    row.description = desired["description"]
                    changed = True
                if row.cost_points != desired["cost_points"]:
                    row.cost_points = desired["cost_points"]
                    changed = True
                if row.image_url != desired["image_url"]:
                    row.image_url = desired["image_url"]
                    changed = True

        if changed:
            db.commit()

        _cleanup_cached_crowding(db)
    except Exception as exc:
        print(f"Startup data seeding skipped: {exc}")
    finally:
        db.close()

@app.get("/")
async def root():
    return {"message": "CityFlow API is running"}


@app.get("/favicon.ico")
async def favicon():
    return JSONResponse(status_code=204, content=None)

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


def _estimate_route_distance_km(route: dict) -> float:
    explicit_distance = route.get("distance_km")
    if explicit_distance is not None:
        try:
            return max(0.5, float(explicit_distance))
        except (TypeError, ValueError):
            pass

    segments = route.get("segments") or []
    total_km = 0.0
    for seg in segments:
        seg_distance = seg.get("distance_km")
        if seg_distance is not None:
            try:
                total_km += max(0.0, float(seg_distance))
            except (TypeError, ValueError):
                continue

    if total_km > 0:
        return total_km

    eta_min = route.get("eta")
    try:
        eta_min = float(eta_min)
    except (TypeError, ValueError):
        eta_min = 12.0
    return max(0.8, eta_min * 0.45)


def _estimate_co2_saved_kg(route: dict, waited: bool, low_density_selected: bool) -> float:
    distance_km = _estimate_route_distance_km(route)
    car_baseline_kg = distance_km * 0.192
    transit_kg = distance_km * 0.06
    saved_kg = max(0.0, car_baseline_kg - transit_kg)
    if waited or low_density_selected:
        saved_kg *= 1.1
    return round(saved_kg, 3)


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
async def journey_decision(payload: JourneyDecisionRequest, user_email: Optional[str] = None, db: Session = Depends(get_db)):
    user = _get_user_by_email(db, user_email)
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
    carbon_saved_kg = _estimate_co2_saved_kg(payload.route, payload.waited, low_density_selected)
    wallet.co2_saved = round(float(wallet.co2_saved or 0.0) + carbon_saved_kg, 3)
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
            "carbon_saved_kg": carbon_saved_kg,
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
        "carbon_saved_kg": carbon_saved_kg,
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


handler = Mangum(app) if Mangum is not None else None


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
    
    history_items = [
        {
            "id": item.id,
            "start_location": item.start_location,
            "end_location": item.end_location,
            "timestamp": item.timestamp.isoformat() if item.timestamp else None,
            "points_earned": item.points_earned,
            "route_details": item.route_details or {},
        }
        for item in sorted(user.journeys, key=lambda x: x.timestamp or datetime.datetime.min, reverse=True)
    ]

    fare_items = [
        {
            "id": item.id,
            "payment_method": item.payment_method,
            "route_number": item.route_number,
            "validator_stop": item.validator_stop,
            "amount_azn": item.amount_azn,
            "paid_at": item.paid_at.isoformat() if item.paid_at else None,
            "boarding_status": item.boarding_status,
        }
        for item in db.query(models.FareTransaction).filter(models.FareTransaction.user_id == user.id).order_by(models.FareTransaction.paid_at.desc()).all()
    ]

    bonus_items = []
    if user.wallet:
        bonus_items = [
            {
                "id": item.id,
                "amount": item.amount,
                "description": item.description,
                "timestamp": item.timestamp.isoformat() if item.timestamp else None,
            }
            for item in sorted(user.wallet.transactions, key=lambda x: x.timestamp or datetime.datetime.min, reverse=True)
        ]

    return {
        "full_name": user.full_name,
        "email": user.email,
        "joined_at": user.joined_at.isoformat() if user.joined_at else None,
        "wallet": {
            "points": user.wallet.points,
            "bakikart_balance": user.card_balance.amount_azn if user.card_balance else 0.0,
            "co2_saved": user.wallet.co2_saved,
            "peak_crowds_avoided": user.wallet.peak_crowds_avoided
        },
        "history": history_items,
        "fare_transactions": fare_items,
        "bonus_transactions": bonus_items,
        "coupons": user.coupons
    }

@app.get("/coupons")
async def get_coupons(db: Session = Depends(get_db)):
    allowed_partners = {"Espresso Baku", "Costa Baku", "Skuter", "Velosiped"}
    all_coupons = db.query(models.Coupon).all()
    allowed = [c for c in all_coupons if c.partner_name in allowed_partners]
    preferred_order = ["Espresso Baku", "Costa Baku", "Skuter", "Velosiped"]
    allowed.sort(key=lambda c: preferred_order.index(c.partner_name) if c.partner_name in preferred_order else 999)
    return allowed

@app.post("/coupons/purchase/{coupon_id}")
async def purchase_coupon(coupon_id: int, email: Optional[str] = None, db: Session = Depends(get_db)):
    user = _get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="İstifadəçi tapılmadı")

    if not user.wallet:
        wallet = models.Wallet(user_id=user.id, points=0, co2_saved=0.0, peak_crowds_avoided=0)
        db.add(wallet)
        db.commit()
        db.refresh(user)
    
    coupon = db.query(models.Coupon).filter(models.Coupon.id == coupon_id).first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Kupon tapılmadı")
    
    if user.wallet.points < coupon.cost_points:
        raise HTTPException(status_code=400, detail="Kifayət qədər xalınız yoxdur")
    
    # Generate unique promo code
    promo_code = f"BK-{uuid.uuid4().hex[:8].upper()}"
    
    # Deduct points
    user.wallet.points -= coupon.cost_points
    
    # Create user coupon
    user_coupon = models.UserCoupon(
        user_id=user.id,
        coupon_id=coupon.id,
        promo_code=promo_code,
        expires_at=datetime.datetime.utcnow() + timedelta(days=30),
        is_used=False
    )
    
    db.add(user_coupon)
    
    # Add transaction history
    transaction = models.BonusTransaction(
        wallet_id=user.wallet.id,
        amount=-coupon.cost_points,
        description=f"{coupon.partner_name} - {coupon.title} alışı"
    )
    db.add(transaction)
    
    db.commit()
    db.refresh(user_coupon)
    
    return {
        "message": "Alış uğurla tamamlandı",
        "promo_code": promo_code,
        "expires_at": user_coupon.expires_at,
        "new_points_balance": user.wallet.points
    }

@app.get("/user/coupons")
async def get_user_coupons(email: Optional[str] = None, db: Session = Depends(get_db)):
    user = _get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="İstifadəçi tapılmadı")

    if not user.wallet:
        wallet = models.Wallet(user_id=user.id, points=0, co2_saved=0.0, peak_crowds_avoided=0)
        db.add(wallet)
        db.commit()
        db.refresh(user)
    
    # Return coupons with details
    allowed_partners = {"Espresso Baku", "Costa Baku", "Skuter", "Velosiped"}
    results = []
    for uc in user.coupons:
        if uc.coupon and uc.coupon.partner_name not in allowed_partners:
            continue
        results.append({
            "id": uc.id,
            "title": uc.coupon.title,
            "partner_name": uc.coupon.partner_name,
            "promo_code": uc.promo_code,
            "expires_at": uc.expires_at,
            "is_used": uc.is_used,
            "image_url": uc.coupon.image_url
        })
    return results
