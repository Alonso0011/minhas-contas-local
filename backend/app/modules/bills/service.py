import re
from datetime import date

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.bills.model import BillStatus, MonthlyBill
from app.modules.bills.schemas import BillCreate, BillUpdate, MonthlySummary


def parse_month(value: str) -> date:
    try:
        if not re.fullmatch(r"\d{4}-\d{2}", value):
            raise ValueError
        return date.fromisoformat(f"{value}-01")
    except ValueError as error:
        raise HTTPException(422, "Informe uma competência válida no formato AAAA-MM.") from error


def list_bills(session: Session, reference_month: date) -> list[MonthlyBill]:
    query = (
        select(MonthlyBill)
        .where(MonthlyBill.reference_month == reference_month)
        .order_by(MonthlyBill.due_date, MonthlyBill.id)
    )
    return list(session.scalars(query))


def get_bill(session: Session, bill_id: int) -> MonthlyBill:
    bill = session.get(MonthlyBill, bill_id)
    if bill is None:
        raise HTTPException(404, "Conta não encontrada.")
    return bill


def apply_payment_rule(data: dict) -> None:
    """Pagamento sem data usa hoje; retornar a pendente sempre remove a data de pagamento."""
    if data["status"] == BillStatus.PENDING:
        data["paid_at"] = None
    elif data["paid_at"] is None:
        data["paid_at"] = date.today()


def create_bill(session: Session, payload: BillCreate) -> MonthlyBill:
    data = payload.model_dump()
    apply_payment_rule(data)
    bill = MonthlyBill(**data)
    session.add(bill)
    session.commit()
    session.refresh(bill)
    return bill


def update_bill(session: Session, bill: MonthlyBill, payload: BillUpdate) -> MonthlyBill:
    """Revalida dados mesclados, impedindo que um PATCH isolado torne o vencimento incoerente."""
    merged = {field: getattr(bill, field) for field in BillCreate.model_fields}
    merged.update(payload.model_dump(exclude_unset=True))
    try:
        data = BillCreate.model_validate(merged).model_dump()
    except ValidationError as error:
        message = error.errors()[0]["msg"].removeprefix("Value error, ")
        raise HTTPException(422, message) from error
    apply_payment_rule(data)
    for field, value in data.items():
        setattr(bill, field, value)
    session.commit()
    session.refresh(bill)
    return bill


def delete_bill(session: Session, bill: MonthlyBill) -> None:
    session.delete(bill)
    session.commit()


def monthly_summary(session: Session, reference_month: date) -> MonthlySummary:
    amounts = list(
        session.scalars(
            select(MonthlyBill.amount_cents).where(MonthlyBill.reference_month == reference_month)
        )
    )
    return MonthlySummary(
        reference_month=reference_month,
        total_amount_cents=sum(amounts),
        bill_count=len(amounts),
    )
