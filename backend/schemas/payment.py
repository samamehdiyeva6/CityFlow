from typing import Optional

from pydantic import BaseModel


class PaymentRequestBase(BaseModel):
    session_id: str
    route_id: Optional[str] = None
    route_number: Optional[str] = None
    validator_stop: Optional[str] = None
    lat: float
    lon: float
    amount_azn: float = 0.6


class NFCPaymentRequest(PaymentRequestBase):
    pass


class QRPaymentRequest(PaymentRequestBase):
    qr_code: str


class NFCPaymentResponse(BaseModel):
    payment_recorded: bool
    paid_at: str
    validator_stop: Optional[str] = None
    wait_bonus_candidate: bool
    matched_wait_session_id: Optional[str] = None
    matched_wait_minutes: Optional[int] = None
    boarding_status: str
    bakikart_balance: float


class QRPaymentResponse(NFCPaymentResponse):
    qr_code: str
