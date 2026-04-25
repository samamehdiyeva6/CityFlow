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
