from datetime import date
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel


class Vendor(BaseModel, frozen=True):
    id: str
    name: str
    category: str


class Subscription(BaseModel, frozen=True):
    id: str
    vendor_id: str
    name: str
    cadence: Literal["Monthly", "Annual"]
    next_renewal: date
    currency: Literal["INR"] = "INR"
    expected_amount_minor: int


class Invoice(BaseModel, frozen=True):
    id: str
    subscription_id: str
    due_date: date
    currency: Literal["INR"] = "INR"
    amount_minor: int
    status: Literal["Awaiting approval", "Due soon", "Simulated paid"]


VENDORS = (
    Vendor(id="DEMO-V01", name="Northstar Cloud", category="Cloud infrastructure"),
    Vendor(id="DEMO-V02", name="Cedar Workspace", category="Workplace software"),
    Vendor(id="DEMO-V03", name="Bluepeak Internet", category="Connectivity"),
)

SUBSCRIPTIONS = (
    Subscription(id="DEMO-S01", vendor_id="DEMO-V01", name="Cloud hosting", cadence="Monthly", next_renewal=date(2026, 12, 3), expected_amount_minor=2_480_000),
    Subscription(id="DEMO-S02", vendor_id="DEMO-V02", name="Team workspace", cadence="Annual", next_renewal=date(2026, 12, 7), expected_amount_minor=840_000),
    Subscription(id="DEMO-S03", vendor_id="DEMO-V03", name="Office broadband", cadence="Monthly", next_renewal=date(2027, 1, 12), expected_amount_minor=320_000),
    Subscription(id="DEMO-S04", vendor_id="DEMO-V01", name="Backup storage", cadence="Monthly", next_renewal=date(2027, 1, 18), expected_amount_minor=155_000),
)

INVOICES = (
    Invoice(id="DEMO-101", subscription_id="DEMO-S01", due_date=date(2026, 12, 3), amount_minor=2_480_000, status="Awaiting approval"),
    Invoice(id="DEMO-102", subscription_id="DEMO-S02", due_date=date(2026, 12, 7), amount_minor=840_000, status="Due soon"),
    Invoice(id="DEMO-103", subscription_id="DEMO-S03", due_date=date(2026, 12, 12), amount_minor=320_000, status="Simulated paid"),
)

router = APIRouter()


@router.get("/vendors")
def list_vendors() -> tuple[Vendor, ...]:
    return VENDORS


@router.get("/subscriptions")
def list_subscriptions() -> tuple[Subscription, ...]:
    return SUBSCRIPTIONS


@router.get("/invoices")
def list_invoices() -> tuple[Invoice, ...]:
    return INVOICES
