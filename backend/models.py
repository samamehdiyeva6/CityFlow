from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, JSON, Boolean
from sqlalchemy.orm import relationship
from database import Base
import datetime


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String)
    email = Column(String, unique=True, index=True)
    joined_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    wallet = relationship("Wallet", back_populates="user", uselist=False)
    card_balance = relationship("CardBalance", back_populates="user", uselist=False)
    journeys = relationship("JourneyHistory", back_populates="user")
    coupons = relationship("UserCoupon", back_populates="user")

class Wallet(Base):
    __tablename__ = "wallets"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    points = Column(Integer, default=0)
    co2_saved = Column(Float, default=0.0)
    peak_crowds_avoided = Column(Integer, default=0)
    
    user = relationship("User", back_populates="wallet")
    transactions = relationship("BonusTransaction", back_populates="wallet")

class BonusTransaction(Base):
    __tablename__ = "bonus_transactions"
    id = Column(Integer, primary_key=True, index=True)
    wallet_id = Column(Integer, ForeignKey("wallets.id"))
    amount = Column(Integer)
    description = Column(String)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    wallet = relationship("Wallet", back_populates="transactions")


class CardBalance(Base):
    __tablename__ = "card_balances"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    amount_azn = Column(Float, default=10.0)

    user = relationship("User", back_populates="card_balance")

class JourneyHistory(Base):
    __tablename__ = "journey_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    start_location = Column(String)
    end_location = Column(String)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    points_earned = Column(Integer)
    route_details = Column(JSON) # Stores segments, mode, etc.
    
    user = relationship("User", back_populates="journeys")

class Coupon(Base):
    __tablename__ = "coupons"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(String)
    cost_points = Column(Integer)
    image_url = Column(String)
    partner_name = Column(String)

class UserCoupon(Base):
    __tablename__ = "user_coupons"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    coupon_id = Column(Integer, ForeignKey("coupons.id"))
    purchased_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_used = Column(Boolean, default=False)
    
    user = relationship("User", back_populates="coupons")
    coupon = relationship("Coupon")


class Stop(Base):
    __tablename__ = "stops"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    type = Column(String, nullable=False)  # BUS / METRO


class RealtimeLocationPing(Base):
    __tablename__ = "realtime_location_pings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    session_id = Column(String, index=True, nullable=False)
    route_id = Column(String, nullable=True)
    route_number = Column(String, nullable=True)
    trip_status = Column(String, default="ACTIVE")
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    accuracy_m = Column(Float, nullable=True)
    speed_mps = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)


class WaitBonusSession(Base):
    __tablename__ = "wait_bonus_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(String, unique=True, index=True, nullable=False)
    route_id = Column(String, nullable=True)
    route_number = Column(String, nullable=True)
    start_location = Column(String, nullable=True)
    end_location = Column(String, nullable=True)
    origin_lat = Column(Float, nullable=False)
    origin_lon = Column(Float, nullable=False)
    current_density_score = Column(Integer, nullable=False)
    projected_density_score = Column(Integer, nullable=False)
    suggested_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    recommended_departure_at = Column(DateTime, nullable=False)
    status = Column(String, default="PENDING", nullable=False)


class FareTransaction(Base):
    __tablename__ = "fare_transactions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(String, index=True, nullable=False)
    payment_method = Column(String, default="NFC", nullable=False)
    route_id = Column(String, nullable=True)
    route_number = Column(String, nullable=True)
    validator_stop = Column(String, nullable=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    amount_azn = Column(Float, nullable=False)
    paid_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)
    boarding_status = Column(String, default="PAID", nullable=False)
    matched_wait_session_id = Column(String, nullable=True)
    matched_wait_minutes = Column(Integer, nullable=True)
