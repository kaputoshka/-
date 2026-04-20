
from __future__ import annotations

import os
import json
from pathlib import Path
from datetime import datetime, timedelta, date
from typing import Optional, List, Dict, Any, Tuple

from dotenv import load_dotenv

from fastapi import FastAPI, Depends, HTTPException, status, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from pydantic import BaseModel, Field

from passlib.context import CryptContext
from jose import jwt, JWTError

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
    ForeignKey,
    Numeric,
    Text,
    Table,
    select,
    func,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, Session

import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.linear_model import LogisticRegression


BASE_DIR = Path(__file__).resolve().parent        # .../car-sales-deals/server
ROOT_DIR = BASE_DIR.parent                        # .../car-sales-deals

# читаем .env из server/.env (если есть)
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://car_user:car_pass@localhost:5432/car_sales")
JWT_SECRET = os.getenv("JWT_SECRET", "change_me_super_secret_key")
JWT_ALG = os.getenv("JWT_ALG", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "120"))

CORS_ORIGINS_RAW = os.getenv("CORS_ORIGINS", "http://localhost:5173")
CORS_ORIGINS = [x.strip() for x in CORS_ORIGINS_RAW.split(",") if x.strip()]

MODEL_PATH_RAW = os.getenv("MODEL_PATH", "server/storage/model.joblib")
METRICS_PATH_RAW = os.getenv("METRICS_PATH", "server/storage/metrics.json")


def resolve_repo_path(p: str) -> Path:
    """MODEL_PATH в .env задан относительно корня репозитория."""
    if not p:
        return ROOT_DIR / "server/storage/model.joblib"
    pp = Path(p)
    return pp if pp.is_absolute() else (ROOT_DIR / pp)


MODEL_PATH = resolve_repo_path(MODEL_PATH_RAW)
METRICS_PATH = resolve_repo_path(METRICS_PATH_RAW)

MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def now_utc() -> datetime:
    return datetime.utcnow()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def make_token(user_id: int) -> str:
    exp = now_utc() + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": exp}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return date.fromisoformat(s)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid date: {s}. Use YYYY-MM-DD")


def must(condition: bool, status_code: int, detail: str):
    if not condition:
        raise HTTPException(status_code=status_code, detail=detail)




user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", ForeignKey("users.id"), primary_key=True),
    Column("role_id", ForeignKey("roles.id"), primary_key=True),
)

role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", ForeignKey("roles.id"), primary_key=True),
    Column("permission_id", ForeignKey("permissions.id"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    full_name = Column(String(200), nullable=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=now_utc, nullable=False)

    roles = relationship("Role", secondary=user_roles, back_populates="users")
    audit_logs = relationship("AuditLog", back_populates="user")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True)
    name = Column(String(64), unique=True, index=True, nullable=False)  # admin/manager/lead
    title = Column(String(128), nullable=True)

    users = relationship("User", secondary=user_roles, back_populates="roles")
    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True)
    code = Column(String(64), unique=True, index=True, nullable=False)  # "deals:write"
    title = Column(String(128), nullable=True)

    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")


class DealStatus(Base):
    __tablename__ = "deal_statuses"

    code = Column(String(32), primary_key=True)  # new/in_progress/closed/canceled
    title = Column(String(128), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)


class Car(Base):
    __tablename__ = "cars"

    id = Column(Integer, primary_key=True)
    vin = Column(String(32), unique=True, index=True, nullable=True)
    brand = Column(String(100), nullable=False)
    model = Column(String(100), nullable=False)
    year = Column(Integer, nullable=False)
    mileage = Column(Integer, default=0, nullable=False)
    price = Column(Numeric(12, 2), nullable=False)
    status = Column(String(16), default="available", nullable=False)  # available/reserved/sold
    created_at = Column(DateTime, default=now_utc, nullable=False)

    deals = relationship("Deal", back_populates="car")


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True)
    full_name = Column(String(200), nullable=False)
    phone = Column(String(50), unique=True, index=True, nullable=False)
    doc_id = Column(String(64), nullable=True)  # упрощённо: паспорт/документ
    note = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=now_utc, nullable=False)

    deals = relationship("Deal", back_populates="client")


class Deal(Base):
    __tablename__ = "deals"

    id = Column(Integer, primary_key=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    car_id = Column(Integer, ForeignKey("cars.id"), nullable=False)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    status_code = Column(String(32), ForeignKey("deal_statuses.code"), nullable=False, default="new")

    sale_price = Column(Numeric(12, 2), nullable=False)
    discount = Column(Numeric(12, 2), default=0, nullable=False)
    source = Column(String(64), default="unknown", nullable=False)  # источник лида (упрощённо)
    touches = Column(Integer, default=1, nullable=False)            # “касания” (упрощённо)

    created_at = Column(DateTime, default=now_utc, nullable=False)
    updated_at = Column(DateTime, default=now_utc, nullable=False)
    closed_at = Column(DateTime, nullable=True)

    client = relationship("Client", back_populates="deals")
    car = relationship("Car", back_populates="deals")
    manager = relationship("User")
    payments = relationship("Payment", back_populates="deal")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True)
    deal_id = Column(Integer, ForeignKey("deals.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    kind = Column(String(16), default="deposit", nullable=False)  # deposit/full/other
    status = Column(String(16), default="paid", nullable=False)   # planned/paid
    paid_at = Column(DateTime, default=now_utc, nullable=False)
    note = Column(String(300), nullable=True)

    deal = relationship("Deal", back_populates="payments")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=now_utc, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    action = Column(String(64), nullable=False)   # CREATE/UPDATE/DELETE/LOGIN/AI_TRAIN/...
    entity = Column(String(64), nullable=False)   # Car/Client/Deal/Payment/User/Role/AI
    entity_id = Column(String(64), nullable=True)
    details = Column(Text, nullable=True)
    ip = Column(String(64), nullable=True)

    user = relationship("User", back_populates="audit_logs")


# создаём таблицы (для учебного проекта KISS)
Base.metadata.create_all(bind=engine)



class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    roles: List[str]


class LoginIn(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=4, max_length=128)


class UserOut(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    is_active: bool
    roles: List[str]

    class Config:
        from_attributes = True


class UserCreateIn(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    full_name: Optional[str] = Field(default=None, max_length=200)
    password: str = Field(min_length=4, max_length=128)
    role_names: List[str] = Field(default_factory=list)


class UserUpdateIn(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=200)
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=4, max_length=128)
    role_names: Optional[List[str]] = None


class RoleOut(BaseModel):
    id: int
    name: str
    title: Optional[str] = None
    permissions: List[str]

    class Config:
        from_attributes = True


class RoleCreateIn(BaseModel):
    name: str = Field(min_length=2, max_length=64)
    title: Optional[str] = Field(default=None, max_length=128)
    permission_codes: List[str] = Field(default_factory=list)


class RoleUpdateIn(BaseModel):
    title: Optional[str] = Field(default=None, max_length=128)
    permission_codes: Optional[List[str]] = None


class PermissionOut(BaseModel):
    code: str
    title: Optional[str] = None


class DealStatusOut(BaseModel):
    code: str
    title: str
    is_active: bool


class CarIn(BaseModel):
    vin: Optional[str] = Field(default=None, max_length=32)
    brand: str = Field(min_length=1, max_length=100)
    model: str = Field(min_length=1, max_length=100)
    year: int = Field(ge=1950, le=2100)
    mileage: int = Field(ge=0, le=2_000_000)
    price: float = Field(gt=0)


class CarOut(BaseModel):
    id: int
    vin: Optional[str] = None
    brand: str
    model: str
    year: int
    mileage: int
    price: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ClientIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    phone: str = Field(min_length=5, max_length=50)
    doc_id: Optional[str] = Field(default=None, max_length=64)
    note: Optional[str] = Field(default=None, max_length=500)


class ClientOut(BaseModel):
    id: int
    full_name: str
    phone: str
    doc_id: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DealCreateIn(BaseModel):
    client_id: int
    car_id: int
    sale_price: float = Field(gt=0)
    discount: float = Field(ge=0)
    source: str = Field(default="unknown", max_length=64)
    touches: int = Field(default=1, ge=1, le=10_000)


class DealStatusChangeIn(BaseModel):
    status_code: str = Field(min_length=1, max_length=32)


class DealOut(BaseModel):
    id: int
    client_id: int
    car_id: int
    manager_id: int
    status_code: str
    sale_price: float
    discount: float
    source: str
    touches: int
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PaymentCreateIn(BaseModel):
    deal_id: int
    amount: float = Field(gt=0)
    kind: str = Field(default="deposit", max_length=16)
    status: str = Field(default="paid", max_length=16)  # planned/paid
    note: Optional[str] = Field(default=None, max_length=300)


class PaymentOut(BaseModel):
    id: int
    deal_id: int
    amount: float
    kind: str
    status: str
    paid_at: datetime
    note: Optional[str] = None

    class Config:
        from_attributes = True


class ReportSummaryOut(BaseModel):
    date_from: date
    date_to: date
    deals_total: int
    deals_closed: int
    revenue: float
    avg_check: float


class AiTrainOut(BaseModel):
    trained: bool
    samples: int
    features: int
    metrics: Dict[str, Any]
    model_path: str


class AiPredictOut(BaseModel):
    deal_id: int
    probability_close: float
    level: str
    used_features: Dict[str, Any]


class AuditOut(BaseModel):
    id: int
    created_at: datetime
    user_id: Optional[int] = None
    action: str
    entity: str
    entity_id: Optional[str] = None
    details: Optional[str] = None
    ip: Optional[str] = None

    class Config:
        from_attributes = True




def audit(db: Session, request: Optional[Request], user: Optional[User], action: str, entity: str, entity_id: Optional[str] = None, details: Optional[str] = None):
    ip = None
    if request:
        ip = request.client.host if request.client else None
    row = AuditLog(
        user_id=user.id if user else None,
        action=action,
        entity=entity,
        entity_id=entity_id,
        details=details,
        ip=ip,
    )
    db.add(row)
    db.commit()


def get_user_roles(user: User) -> List[str]:
    return [r.name for r in user.roles]


def user_permissions(user: User) -> set[str]:
    perms: set[str] = set()
    for r in user.roles:
        for p in r.permissions:
            perms.add(p.code)
    return perms


def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    must(creds is not None and creds.credentials, status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    token = creds.credentials

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.get(User, user_id)
    must(user is not None, 401, "User not found")
    must(user.is_active, 403, "User is inactive")
    return user


def require_perm(code: str):
    def _dep(user: User = Depends(get_current_user)) -> User:
        perms = user_permissions(user)
        must(code in perms, 403, f"Forbidden: missing permission '{code}'")
        return user
    return _dep



app = FastAPI(title="Car sales — учет сделок", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




@app.get("/api/health")
def health():
    return {"status": "ok"}




@app.post("/api/auth/login", response_model=TokenOut)
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.username == payload.username)).scalar_one_or_none()
    must(user is not None, 401, "Invalid username or password")
    must(user.is_active, 403, "User is inactive")
    must(verify_password(payload.password, user.password_hash), 401, "Invalid username or password")

    token = make_token(user.id)
    audit(db, request, user, action="LOGIN", entity="Auth", entity_id=str(user.id), details=f"username={user.username}")
    return TokenOut(access_token=token, user_id=user.id, username=user.username, roles=get_user_roles(user))


@app.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        is_active=user.is_active,
        roles=get_user_roles(user),
    )



@app.get("/api/dicts/deal-statuses", response_model=list[DealStatusOut])
def list_deal_statuses(db: Session = Depends(get_db), user: User = Depends(require_perm("deals:read"))):
    rows = db.execute(select(DealStatus).order_by(DealStatus.code)).scalars().all()
    return [DealStatusOut(code=r.code, title=r.title, is_active=r.is_active) for r in rows]




@app.get("/api/cars", response_model=list[CarOut])
def list_cars(
    db: Session = Depends(get_db),
    user: User = Depends(require_perm("cars:read")),
    q: Optional[str] = Query(default=None, description="search by brand/model/vin"),
    status_: Optional[str] = Query(default=None, alias="status"),
):
    stmt = select(Car).order_by(Car.id.desc())
    if q:
        like = f"%{q}%"
        stmt = stmt.where((Car.brand.ilike(like)) | (Car.model.ilike(like)) | (Car.vin.ilike(like)))
    if status_:
        stmt = stmt.where(Car.status == status_)
    return db.execute(stmt).scalars().all()


@app.post("/api/cars", response_model=CarOut)
def create_car(payload: CarIn, request: Request, db: Session = Depends(get_db), user: User = Depends(require_perm("cars:write"))):
    car = Car(**payload.model_dump(), status="available")
    db.add(car)
    db.commit()
    db.refresh(car)
    audit(db, request, user, "CREATE", "Car", str(car.id), details=f"{car.brand} {car.model} {car.year}")
    return car


@app.get("/api/cars/{car_id}", response_model=CarOut)
def get_car(car_id: int, db: Session = Depends(get_db), user: User = Depends(require_perm("cars:read"))):
    car = db.get(Car, car_id)
    must(car is not None, 404, "Car not found")
    return car


@app.put("/api/cars/{car_id}", response_model=CarOut)
def update_car(car_id: int, payload: CarIn, request: Request, db: Session = Depends(get_db), user: User = Depends(require_perm("cars:write"))):
    car = db.get(Car, car_id)
    must(car is not None, 404, "Car not found")

    for k, v in payload.model_dump().items():
        setattr(car, k, v)
    db.commit()
    db.refresh(car)
    audit(db, request, user, "UPDATE", "Car", str(car.id))
    return car


@app.delete("/api/cars/{car_id}")
def delete_car(car_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require_perm("cars:write"))):
    car = db.get(Car, car_id)
    must(car is not None, 404, "Car not found")
    must(car.status != "sold", 400, "Cannot delete sold car")
    db.delete(car)
    db.commit()
    audit(db, request, user, "DELETE", "Car", str(car_id))
    return {"deleted": True}



@app.get("/api/clients", response_model=list[ClientOut])
def list_clients(
    db: Session = Depends(get_db),
    user: User = Depends(require_perm("clients:read")),
    q: Optional[str] = Query(default=None, description="search by full_name/phone"),
):
    stmt = select(Client).order_by(Client.id.desc())
    if q:
        like = f"%{q}%"
        stmt = stmt.where((Client.full_name.ilike(like)) | (Client.phone.ilike(like)))
    return db.execute(stmt).scalars().all()


@app.post("/api/clients", response_model=ClientOut)
def create_client(payload: ClientIn, request: Request, db: Session = Depends(get_db), user: User = Depends(require_perm("clients:write"))):
    obj = Client(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    audit(db, request, user, "CREATE", "Client", str(obj.id), details=obj.full_name)
    return obj


@app.get("/api/clients/{client_id}", response_model=ClientOut)
def get_client(client_id: int, db: Session = Depends(get_db), user: User = Depends(require_perm("clients:read"))):
    obj = db.get(Client, client_id)
    must(obj is not None, 404, "Client not found")
    return obj


@app.put("/api/clients/{client_id}", response_model=ClientOut)
def update_client(client_id: int, payload: ClientIn, request: Request, db: Session = Depends(get_db), user: User = Depends(require_perm("clients:write"))):
    obj = db.get(Client, client_id)
    must(obj is not None, 404, "Client not found")
    for k, v in payload.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    audit(db, request, user, "UPDATE", "Client", str(obj.id))
    return obj


@app.delete("/api/clients/{client_id}")
def delete_client(client_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require_perm("clients:write"))):
    obj = db.get(Client, client_id)
    must(obj is not None, 404, "Client not found")
    cnt = db.execute(select(func.count(Deal.id)).where(Deal.client_id == client_id)).scalar_one()
    must(cnt == 0, 400, "Cannot delete client with deals")
    db.delete(obj)
    db.commit()
    audit(db, request, user, "DELETE", "Client", str(client_id))
    return {"deleted": True}




@app.get("/api/deals", response_model=list[DealOut])
def list_deals(
    db: Session = Depends(get_db),
    user: User = Depends(require_perm("deals:read")),
    status_code: Optional[str] = Query(default=None),
    manager_id: Optional[int] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
):
    stmt = select(Deal).order_by(Deal.id.desc())
    if status_code:
        stmt = stmt.where(Deal.status_code == status_code)
    if manager_id:
        stmt = stmt.where(Deal.manager_id == manager_id)

    d1 = parse_date(date_from)
    d2 = parse_date(date_to)
    if d1:
        stmt = stmt.where(Deal.created_at >= datetime.combine(d1, datetime.min.time()))
    if d2:
        stmt = stmt.where(Deal.created_at <= datetime.combine(d2, datetime.max.time()))

    return db.execute(stmt).scalars().all()


@app.post("/api/deals", response_model=DealOut)
def create_deal(payload: DealCreateIn, request: Request, db: Session = Depends(get_db), user: User = Depends(require_perm("deals:write"))):
    car = db.get(Car, payload.car_id)
    must(car is not None, 404, "Car not found")
    must(car.status == "available", 400, "Car is not available")

    client = db.get(Client, payload.client_id)
    must(client is not None, 404, "Client not found")

    must(payload.discount <= payload.sale_price, 400, "Discount cannot exceed sale price")

    deal = Deal(
        client_id=payload.client_id,
        car_id=payload.car_id,
        manager_id=user.id,
        status_code="new",
        sale_price=payload.sale_price,
        discount=payload.discount,
        source=payload.source,
        touches=payload.touches,
        updated_at=now_utc(),
    )
    car.status = "reserved"

    db.add(deal)
    db.commit()
    db.refresh(deal)
    audit(db, request, user, "CREATE", "Deal", str(deal.id), details=f"client={client.id}, car={car.id}")
    return deal


@app.get("/api/deals/{deal_id}", response_model=DealOut)
def get_deal(deal_id: int, db: Session = Depends(get_db), user: User = Depends(require_perm("deals:read"))):
    deal = db.get(Deal, deal_id)
    must(deal is not None, 404, "Deal not found")
    return deal


@app.put("/api/deals/{deal_id}/status", response_model=DealOut)
def change_deal_status(deal_id: int, payload: DealStatusChangeIn, request: Request, db: Session = Depends(get_db), user: User = Depends(require_perm("deals:write"))):
    deal = db.get(Deal, deal_id)
    must(deal is not None, 404, "Deal not found")

    st = db.get(DealStatus, payload.status_code)
    must(st is not None and st.is_active, 400, "Unknown or inactive status")

    deal.status_code = payload.status_code
    deal.updated_at = now_utc()
    if payload.status_code == "closed":
        deal.closed_at = now_utc()
        car = db.get(Car, deal.car_id)
        if car:
            car.status = "sold"
    if payload.status_code == "canceled":
        car = db.get(Car, deal.car_id)
        if car and car.status != "sold":
            car.status = "available"

    db.commit()
    db.refresh(deal)
    audit(db, request, user, "UPDATE", "Deal", str(deal.id), details=f"status={deal.status_code}")
    return deal


@app.post("/api/deals/{deal_id}/close", response_model=DealOut)
def close_deal(deal_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require_perm("deals:write"))):
    deal = db.get(Deal, deal_id)
    must(deal is not None, 404, "Deal not found")

    paid_sum = db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.deal_id == deal_id).where(Payment.status == "paid")
    ).scalar_one()

    must(float(paid_sum) >= float(deal.sale_price), 400, "Not enough paid amount to close deal")

    deal.status_code = "closed"
    deal.closed_at = now_utc()
    deal.updated_at = now_utc()

    car = db.get(Car, deal.car_id)
    if car:
        car.status = "sold"

    db.commit()
    db.refresh(deal)
    audit(db, request, user, "UPDATE", "Deal", str(deal.id), details="closed")
    return deal


@app.post("/api/deals/{deal_id}/cancel", response_model=DealOut)
def cancel_deal(deal_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require_perm("deals:write"))):
    deal = db.get(Deal, deal_id)
    must(deal is not None, 404, "Deal not found")
    must(deal.status_code != "closed", 400, "Closed deal cannot be canceled")

    deal.status_code = "canceled"
    deal.updated_at = now_utc()

    car = db.get(Car, deal.car_id)
    if car and car.status != "sold":
        car.status = "available"

    db.commit()
    db.refresh(deal)
    audit(db, request, user, "UPDATE", "Deal", str(deal.id), details="canceled")
    return deal




@app.get("/api/payments", response_model=list[PaymentOut])
def list_payments(
    db: Session = Depends(get_db),
    user: User = Depends(require_perm("payments:read")),
    deal_id: Optional[int] = Query(default=None),
):
    stmt = select(Payment).order_by(Payment.id.desc())
    if deal_id:
        stmt = stmt.where(Payment.deal_id == deal_id)
    return db.execute(stmt).scalars().all()


@app.post("/api/payments", response_model=PaymentOut)
def create_payment(payload: PaymentCreateIn, request: Request, db: Session = Depends(get_db), user: User = Depends(require_perm("payments:write"))):
    deal = db.get(Deal, payload.deal_id)
    must(deal is not None, 404, "Deal not found")
    pay = Payment(
        deal_id=payload.deal_id,
        amount=payload.amount,
        kind=payload.kind,
        status=payload.status,
        paid_at=now_utc(),
        note=payload.note,
    )
    db.add(pay)
    db.commit()
    db.refresh(pay)
    audit(db, request, user, "CREATE", "Payment", str(pay.id), details=f"deal={pay.deal_id}, amount={float(pay.amount)}")
    return pay


@app.get("/api/reports/summary", response_model=ReportSummaryOut)
def report_summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_perm("reports:read")),
    date_from: str = Query(..., description="YYYY-MM-DD"),
    date_to: str = Query(..., description="YYYY-MM-DD"),
):
    d1 = parse_date(date_from)
    d2 = parse_date(date_to)
    must(d1 is not None and d2 is not None, 400, "date_from/date_to required")
    must(d1 <= d2, 400, "date_from must be <= date_to")

    dt1 = datetime.combine(d1, datetime.min.time())
    dt2 = datetime.combine(d2, datetime.max.time())

    deals_total = db.execute(select(func.count(Deal.id)).where(Deal.created_at >= dt1).where(Deal.created_at <= dt2)).scalar_one()
    deals_closed = db.execute(select(func.count(Deal.id)).where(Deal.status_code == "closed").where(Deal.closed_at != None).where(Deal.closed_at >= dt1).where(Deal.closed_at <= dt2)).scalar_one()  # noqa: E711

    revenue = db.execute(
        select(func.coalesce(func.sum(Deal.sale_price), 0))
        .where(Deal.status_code == "closed")
        .where(Deal.closed_at != None)  # noqa: E711
        .where(Deal.closed_at >= dt1)
        .where(Deal.closed_at <= dt2)
    ).scalar_one()

    avg_check = float(revenue) / int(deals_closed) if int(deals_closed) > 0 else 0.0

    return ReportSummaryOut(
        date_from=d1,
        date_to=d2,
        deals_total=int(deals_total),
        deals_closed=int(deals_closed),
        revenue=float(revenue),
        avg_check=float(avg_check),
    )




@app.get("/api/audit", response_model=list[AuditOut])
def list_audit(
    db: Session = Depends(get_db),
    user: User = Depends(require_perm("audit:read")),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    user_id: Optional[int] = Query(default=None),
    entity: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
):
    stmt = select(AuditLog).order_by(AuditLog.id.desc())

    d1 = parse_date(date_from)
    d2 = parse_date(date_to)
    if d1:
        stmt = stmt.where(AuditLog.created_at >= datetime.combine(d1, datetime.min.time()))
    if d2:
        stmt = stmt.where(AuditLog.created_at <= datetime.combine(d2, datetime.max.time()))

    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)
    if entity:
        stmt = stmt.where(AuditLog.entity == entity)
    if action:
        stmt = stmt.where(AuditLog.action == action)

    return db.execute(stmt).scalars().all()



@app.get("/api/admin/permissions", response_model=list[PermissionOut])
def admin_list_permissions(db: Session = Depends(get_db), user: User = Depends(require_perm("admin:roles"))):
    rows = db.execute(select(Permission).order_by(Permission.code)).scalars().all()
    return [PermissionOut(code=r.code, title=r.title) for r in rows]


@app.get("/api/admin/users", response_model=list[UserOut])
def admin_list_users(db: Session = Depends(get_db), user: User = Depends(require_perm("admin:users"))):
    users = db.execute(select(User).order_by(User.id.desc())).scalars().all()
    out = []
    for u in users:
        out.append(UserOut(id=u.id, username=u.username, full_name=u.full_name, is_active=u.is_active, roles=get_user_roles(u)))
    return out


@app.post("/api/admin/users", response_model=UserOut)
def admin_create_user(payload: UserCreateIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_perm("admin:users"))):
    existing = db.execute(select(User).where(User.username == payload.username)).scalar_one_or_none()
    must(existing is None, 400, "Username already exists")

    u = User(
        username=payload.username,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        is_active=True,
    )

    if payload.role_names:
        roles = db.execute(select(Role).where(Role.name.in_(payload.role_names))).scalars().all()
        must(len(roles) == len(set(payload.role_names)), 400, "Some roles not found")
        u.roles = roles

    db.add(u)
    db.commit()
    db.refresh(u)
    audit(db, request, admin, "CREATE", "User", str(u.id), details=f"username={u.username}")
    return UserOut(id=u.id, username=u.username, full_name=u.full_name, is_active=u.is_active, roles=get_user_roles(u))


@app.put("/api/admin/users/{user_id}", response_model=UserOut)
def admin_update_user(user_id: int, payload: UserUpdateIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_perm("admin:users"))):
    u = db.get(User, user_id)
    must(u is not None, 404, "User not found")

    if payload.full_name is not None:
        u.full_name = payload.full_name
    if payload.is_active is not None:
        u.is_active = payload.is_active
    if payload.password:
        u.password_hash = hash_password(payload.password)
    if payload.role_names is not None:
        roles = db.execute(select(Role).where(Role.name.in_(payload.role_names))).scalars().all()
        must(len(roles) == len(set(payload.role_names)), 400, "Some roles not found")
        u.roles = roles

    db.commit()
    db.refresh(u)
    audit(db, request, admin, "UPDATE", "User", str(u.id))
    return UserOut(id=u.id, username=u.username, full_name=u.full_name, is_active=u.is_active, roles=get_user_roles(u))


@app.get("/api/admin/roles", response_model=list[RoleOut])
def admin_list_roles(db: Session = Depends(get_db), user: User = Depends(require_perm("admin:roles"))):
    roles = db.execute(select(Role).order_by(Role.id.asc())).scalars().all()
    out: list[RoleOut] = []
    for r in roles:
        out.append(RoleOut(id=r.id, name=r.name, title=r.title, permissions=[p.code for p in r.permissions]))
    return out


@app.post("/api/admin/roles", response_model=RoleOut)
def admin_create_role(payload: RoleCreateIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_perm("admin:roles"))):
    existing = db.execute(select(Role).where(Role.name == payload.name)).scalar_one_or_none()
    must(existing is None, 400, "Role already exists")

    r = Role(name=payload.name, title=payload.title)

    if payload.permission_codes:
        perms = db.execute(select(Permission).where(Permission.code.in_(payload.permission_codes))).scalars().all()
        must(len(perms) == len(set(payload.permission_codes)), 400, "Some permissions not found")
        r.permissions = perms

    db.add(r)
    db.commit()
    db.refresh(r)
    audit(db, request, admin, "CREATE", "Role", str(r.id), details=r.name)
    return RoleOut(id=r.id, name=r.name, title=r.title, permissions=[p.code for p in r.permissions])


@app.put("/api/admin/roles/{role_id}", response_model=RoleOut)
def admin_update_role(role_id: int, payload: RoleUpdateIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_perm("admin:roles"))):
    r = db.get(Role, role_id)
    must(r is not None, 404, "Role not found")

    if payload.title is not None:
        r.title = payload.title

    if payload.permission_codes is not None:
        perms = db.execute(select(Permission).where(Permission.code.in_(payload.permission_codes))).scalars().all()
        must(len(perms) == len(set(payload.permission_codes)), 400, "Some permissions not found")
        r.permissions = perms

    db.commit()
    db.refresh(r)
    audit(db, request, admin, "UPDATE", "Role", str(r.id), details=r.name)
    return RoleOut(id=r.id, name=r.name, title=r.title, permissions=[p.code for p in r.permissions])



def build_training_dataframe(db: Session) -> pd.DataFrame:
    """
    Датасет строим из истории сделок.
    y=1 если closed, y=0 если canceled (или другое неуспешное).
    Если данных мало — добиваем синтетикой (учебный проект).
    """
    rows = db.execute(
        select(
            Deal.id,
            Deal.status_code,
            Deal.sale_price,
            Deal.discount,
            Deal.source,
            Deal.touches,
            Deal.created_at,
            Deal.closed_at,
            Deal.manager_id,
            Car.year.label("car_year"),
            Car.mileage.label("car_mileage"),
            Car.brand.label("car_brand"),
            Car.model.label("car_model"),
        )
        .join(Car, Car.id == Deal.car_id)
    ).all()

    data = []
    for r in rows:
        status_code = r.status_code
        if status_code not in ("closed", "canceled"):
            continue  
        days = 0
        if r.closed_at:
            days = max(0, int((r.closed_at - r.created_at).total_seconds() // 86400))
        y = 1 if status_code == "closed" else 0
        data.append(
            {
                "deal_id": r.id,
                "sale_price": float(r.sale_price),
                "discount": float(r.discount),
                "source": r.source,
                "touches": int(r.touches),
                "days_to_close": days,
                "manager_id": int(r.manager_id),
                "car_year": int(r.car_year),
                "car_mileage": int(r.car_mileage),
                "car_brand": r.car_brand,
                "car_model": r.car_model,
                "y": y,
            }
        )

    df = pd.DataFrame(data)

    if df.shape[0] < 30 or df["y"].nunique() < 2:
        rng = np.random.default_rng(42)
        n = max(60, 2 * df.shape[0] if df.shape[0] > 0 else 80)
        synth = []
        brands = ["Toyota", "Kia", "Hyundai", "BMW", "Audi", "Lada", "VW"]
        sources = ["site", "call", "ads", "walkin", "partners"]
        for i in range(n):
            sale_price = float(rng.integers(500_000, 5_000_000))
            discount = float(rng.integers(0, min(250_000, int(sale_price * 0.15)) + 1))
            car_year = int(rng.integers(2005, 2025))
            car_mileage = int(rng.integers(5_000, 250_000))
            touches = int(rng.integers(1, 15))
            days_to_close = int(rng.integers(0, 45))
            source = str(rng.choice(sources))
            brand = str(rng.choice(brands))
            model = f"Model{int(rng.integers(1, 7))}"
            manager_id = int(rng.integers(1, 6))

            score = 0.0
            score += (discount / max(1.0, sale_price)) * 3.0
            score += (touches / 10.0) * 0.8
            score -= (days_to_close / 60.0) * 1.2
            score += 0.2 if source in ("walkin", "partners") else 0.0
            score -= 0.3 if car_mileage > 180_000 else 0.0
            prob = 1 / (1 + np.exp(-score))
            y = 1 if rng.random() < prob else 0

            synth.append(
                {
                    "deal_id": 10_000_000 + i,
                    "sale_price": sale_price,
                    "discount": discount,
                    "source": source,
                    "touches": touches,
                    "days_to_close": days_to_close,
                    "manager_id": manager_id,
                    "car_year": car_year,
                    "car_mileage": car_mileage,
                    "car_brand": brand,
                    "car_model": model,
                    "y": y,
                }
            )

        df_s = pd.DataFrame(synth)
        df = pd.concat([df, df_s], ignore_index=True)

    return df


def prepare_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
    y = df["y"].astype(int)
    X = df.drop(columns=["y", "deal_id"]).copy()

    X = pd.get_dummies(X, columns=["source", "car_brand", "car_model"], drop_first=True)
    return X, y


def save_metrics(metrics: Dict[str, Any]):
    METRICS_PATH.parent.mkdir(parents=True, exist_ok=True)
    METRICS_PATH.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")


def load_metrics() -> Optional[Dict[str, Any]]:
    if not METRICS_PATH.exists():
        return None
    try:
        return json.loads(METRICS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return None


@app.post("/api/ai/train", response_model=AiTrainOut)
def ai_train(request: Request, db: Session = Depends(get_db), user: User = Depends(require_perm("ai:train"))):
    df = build_training_dataframe(db)
    X, y = prepare_features(df)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)

    model = LogisticRegression(max_iter=2000)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    metrics: Dict[str, Any] = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "f1": float(f1_score(y_test, y_pred)),
    }
    try:
        metrics["roc_auc"] = float(roc_auc_score(y_test, y_proba))
    except Exception:
        metrics["roc_auc"] = None

    payload = {
        "model": model,
        "columns": list(X.columns),
        "trained_at": now_utc().isoformat(),
        "metrics": metrics,
    }
    joblib.dump(payload, MODEL_PATH)

    save_metrics({"trained_at": payload["trained_at"], "metrics": metrics, "samples": int(df.shape[0]), "features": int(X.shape[1])})

    audit(db, request, user, "AI_TRAIN", "AI", entity_id=None, details=f"samples={df.shape[0]}, features={X.shape[1]}")

    return AiTrainOut(
        trained=True,
        samples=int(df.shape[0]),
        features=int(X.shape[1]),
        metrics=metrics,
        model_path=str(MODEL_PATH),
    )


@app.get("/api/ai/metrics")
def ai_metrics(user: User = Depends(require_perm("ai:read"))):
    m = load_metrics()
    must(m is not None, 404, "No metrics yet. Train model first.")
    return m


def deal_to_feature_row(db: Session, deal_id: int) -> Dict[str, Any]:
    deal = db.get(Deal, deal_id)
    must(deal is not None, 404, "Deal not found")
    car = db.get(Car, deal.car_id)
    must(car is not None, 404, "Car not found for deal")

    days_to_close = 0
    days_to_close = max(0, int((now_utc() - deal.created_at).total_seconds() // 86400))

    row = {
        "sale_price": float(deal.sale_price),
        "discount": float(deal.discount),
        "source": deal.source,
        "touches": int(deal.touches),
        "days_to_close": int(days_to_close),
        "manager_id": int(deal.manager_id),
        "car_year": int(car.year),
        "car_mileage": int(car.mileage),
        "car_brand": str(car.brand),
        "car_model": str(car.model),
    }
    return row


@app.get("/api/ai/predict", response_model=AiPredictOut)
def ai_predict(
    deal_id: int = Query(...),
    request: Request = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_perm("ai:use")),
):
    must(MODEL_PATH.exists(), 404, "No model yet. Train model first.")

    pack = joblib.load(MODEL_PATH)
    model = pack["model"]
    cols = pack["columns"]

    row = deal_to_feature_row(db, deal_id)
    df = pd.DataFrame([row])
    X = pd.get_dummies(df, columns=["source", "car_brand", "car_model"], drop_first=True)

    for c in cols:
        if c not in X.columns:
            X[c] = 0
    X = X[cols]

    proba = float(model.predict_proba(X)[0, 1])

    if proba >= 0.70:
        level = "high"
    elif proba >= 0.40:
        level = "medium"
    else:
        level = "low"

    audit(db, request, user, "AI_PREDICT", "AI", entity_id=str(deal_id), details=f"p={proba:.3f}")

    return AiPredictOut(deal_id=deal_id, probability_close=proba, level=level, used_features=row)




DEFAULT_PERMISSIONS = [
    ("cars:read", "Просмотр автомобилей"),
    ("cars:write", "Изменение автомобилей"),
    ("clients:read", "Просмотр клиентов"),
    ("clients:write", "Изменение клиентов"),
    ("deals:read", "Просмотр сделок"),
    ("deals:write", "Изменение сделок"),
    ("payments:read", "Просмотр платежей"),
    ("payments:write", "Изменение платежей"),
    ("reports:read", "Просмотр отчетов"),
    ("audit:read", "Просмотр журнала"),
    ("ai:read", "Просмотр метрик ИИ"),
    ("ai:use", "Использование ИИ"),
    ("ai:train", "Обучение ИИ"),
    ("admin:users", "Администрирование пользователей"),
    ("admin:roles", "Администрирование ролей/прав"),
]

ROLE_TEMPLATES = {
    "admin": {
        "title": "Администратор",
        "perms": [p[0] for p in DEFAULT_PERMISSIONS],
    },
    "manager": {
        "title": "Менеджер",
        "perms": [
            "cars:read", "cars:write",
            "clients:read", "clients:write",
            "deals:read", "deals:write",
            "payments:read", "payments:write",
            "reports:read",
            "ai:read", "ai:use",
            "audit:read",
        ],
    },
    "lead": {
        "title": "Руководитель",
        "perms": [
            "cars:read",
            "clients:read",
            "deals:read",
            "payments:read",
            "reports:read",
            "ai:read", "ai:use", "ai:train",
            "audit:read",
        ],
    },
}

DEFAULT_STATUSES = [
    ("new", "Новая"),
    ("in_progress", "В работе"),
    ("closed", "Закрыта"),
    ("canceled", "Отменена"),
]


@app.post("/api/admin/seed")
def admin_seed(request: Request, db: Session = Depends(get_db), admin: User = Depends(require_perm("admin:users"))):
    for code, title in DEFAULT_PERMISSIONS:
        ex = db.execute(select(Permission).where(Permission.code == code)).scalar_one_or_none()
        if not ex:
            db.add(Permission(code=code, title=title))
    db.commit()

    for role_name, cfg in ROLE_TEMPLATES.items():
        role = db.execute(select(Role).where(Role.name == role_name)).scalar_one_or_none()
        if not role:
            role = Role(name=role_name, title=cfg["title"])
            db.add(role)
            db.commit()
            db.refresh(role)

        perms = db.execute(select(Permission).where(Permission.code.in_(cfg["perms"]))).scalars().all()
        role.permissions = perms
        db.commit()

    for code, title in DEFAULT_STATUSES:
        st = db.get(DealStatus, code)
        if not st:
            db.add(DealStatus(code=code, title=title, is_active=True))
        else:
            st.title = title
            st.is_active = True
    db.commit()

    def ensure_user(username: str, password: str, role_name: str, full_name: str):
        u = db.execute(select(User).where(User.username == username)).scalar_one_or_none()
        if not u:
            u = User(username=username, full_name=full_name, password_hash=hash_password(password), is_active=True)
            role = db.execute(select(Role).where(Role.name == role_name)).scalar_one()
            u.roles = [role]
            db.add(u)
            db.commit()
            db.refresh(u)
        return u

    seed_admin = ensure_user("admin", "admin", "admin", "Администратор")
    seed_manager = ensure_user("manager", "manager", "manager", "Менеджер")
    seed_lead = ensure_user("lead", "lead", "lead", "Руководитель")

    car_cnt = db.execute(select(func.count(Car.id))).scalar_one()
    if int(car_cnt) == 0:
        cars = [
            Car(vin="XTESTVIN001", brand="Toyota", model="Camry", year=2018, mileage=85000, price=2100000, status="available"),
            Car(vin="XTESTVIN002", brand="Kia", model="Rio", year=2020, mileage=52000, price=1200000, status="available"),
            Car(vin="XTESTVIN003", brand="Lada", model="Vesta", year=2021, mileage=30000, price=1100000, status="available"),
        ]
        db.add_all(cars)
        db.commit()

    client_cnt = db.execute(select(func.count(Client.id))).scalar_one()
    if int(client_cnt) == 0:
        clients = [
            Client(full_name="Иванов Иван", phone="+79990000001", doc_id="1111 222222", note="первичный клиент"),
            Client(full_name="Петров Петр", phone="+79990000002", doc_id="3333 444444", note="просил скидку"),
        ]
        db.add_all(clients)
        db.commit()

    deal_cnt = db.execute(select(func.count(Deal.id))).scalar_one()
    if int(deal_cnt) == 0:
        c1 = db.execute(select(Client).order_by(Client.id.asc())).scalars().first()
        car1 = db.execute(select(Car).where(Car.status == "available").order_by(Car.id.asc())).scalars().first()
        if c1 and car1:
            d = Deal(
                client_id=c1.id,
                car_id=car1.id,
                manager_id=seed_manager.id,
                status_code="in_progress",
                sale_price=float(car1.price),
                discount=50000,
                source="site",
                touches=3,
                created_at=now_utc() - timedelta(days=5),
                updated_at=now_utc(),
            )
            car1.status = "reserved"
            db.add(d)
            db.commit()

    audit(db, request, admin, "SEED", "System", entity_id=None, details="seed executed")

    return {
        "seeded": True,
        "users": {"admin": seed_admin.username, "manager": seed_manager.username, "lead": seed_lead.username},
        "passwords": {"admin": "admin", "manager": "manager", "lead": "lead"},
    }
