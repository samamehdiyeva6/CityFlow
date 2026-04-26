from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
from schemas.payment import NFCPaymentRequest, NFCPaymentResponse, QRPaymentRequest, QRPaymentResponse
from services.payment_service import payment_service

router = APIRouter(prefix="/api/v1/payments", tags=["payments"])


def _resolve_user(db: Session, user_email: Optional[str]):
    if user_email:
        credential = (
            db.query(models.SignInCredential)
            .filter(models.SignInCredential.email == user_email.strip().lower())
            .first()
        )
        if credential:
            return db.query(models.User).filter(models.User.id == credential.user_id).first()
    return db.query(models.User).first()


@router.post("/nfc", response_model=NFCPaymentResponse)
async def record_nfc_payment(payload: NFCPaymentRequest, user_email: Optional[str] = None, db: Session = Depends(get_db)):
    user = _resolve_user(db, user_email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        return payment_service.record_payment(db=db, user_id=user.id, payload=payload, method="NFC")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/qr", response_model=QRPaymentResponse)
async def record_qr_payment(payload: QRPaymentRequest, user_email: Optional[str] = None, db: Session = Depends(get_db)):
    user = _resolve_user(db, user_email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        result = payment_service.record_payment(db=db, user_id=user.id, payload=payload, method="QR")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    result["qr_code"] = payload.qr_code
    return result
