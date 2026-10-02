import re
from datetime import UTC, date, datetime
from typing import Annotated

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
    field_serializer,
    field_validator,
    model_validator,
)

from app.modules.bills.model import BillStatus


def validate_calendar_date(value: object) -> date:
    """Recusa horários e timestamps: competência, vencimento e pagamento são datas de calendário."""
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        try:
            return date.fromisoformat(value)
        except ValueError:
            pass
    raise ValueError("Informe uma data válida no formato AAAA-MM-DD, sem horário.")


CalendarDate = Annotated[date, BeforeValidator(validate_calendar_date)]
BillName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
AmountCents = Annotated[int, Field(strict=True, gt=0, le=9_007_199_254_740_991)]


class BillCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: BillName
    reference_month: CalendarDate
    due_date: CalendarDate
    amount_cents: AmountCents
    status: BillStatus = BillStatus.PENDING
    paid_at: CalendarDate | None = None

    @field_validator("reference_month")
    @classmethod
    def normalize_reference_month(cls, value: date) -> date:
        return value.replace(day=1)

    @model_validator(mode="after")
    def validate_dates(self) -> "BillCreate":
        if self.due_date.replace(day=1) != self.reference_month:
            raise ValueError("O vencimento deve pertencer ao mês da competência.")
        return self


class BillUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: BillName | None = None
    reference_month: CalendarDate | None = None
    due_date: CalendarDate | None = None
    amount_cents: AmountCents | None = None
    status: BillStatus | None = None
    paid_at: CalendarDate | None = None

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> "BillUpdate":
        for field in self.model_fields_set - {"paid_at"}:
            if getattr(self, field) is None:
                raise ValueError(f"O campo {field} não pode ser nulo.")
        return self


class BillRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    reference_month: date
    due_date: date
    amount_cents: int
    status: BillStatus
    paid_at: date | None
    created_at: datetime
    updated_at: datetime
    is_overdue: bool

    @field_serializer("created_at", "updated_at")
    def serialize_timestamp(self, value: datetime) -> str:
        return value.replace(tzinfo=value.tzinfo or UTC).isoformat()


class MonthlySummary(BaseModel):
    reference_month: date
    total_amount_cents: int
    bill_count: int
