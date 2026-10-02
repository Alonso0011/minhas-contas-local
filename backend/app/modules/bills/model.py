from datetime import UTC, date, datetime
from enum import StrEnum

from sqlalchemy import BigInteger, CheckConstraint, Date, DateTime, Index, String
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BillStatus(StrEnum):
    PENDING = "PENDING"
    PAID = "PAID"


class MonthlyBill(Base):
    __tablename__ = "monthly_bills"
    __table_args__ = (
        CheckConstraint("amount_cents > 0", name="ck_monthly_bills_positive_amount"),
        CheckConstraint(
            "(status = 'PENDING' AND paid_at IS NULL) OR (status = 'PAID' AND paid_at IS NOT NULL)",
            name="ck_monthly_bills_payment_date",
        ),
        Index("ix_monthly_bills_reference_due", "reference_month", "due_date", "id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    reference_month: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date)
    amount_cents: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[BillStatus] = mapped_column(
        SQLEnum(BillStatus, name="bill_status", native_enum=False, create_constraint=True),
        default=BillStatus.PENDING,
    )
    paid_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    @property
    def is_overdue(self) -> bool:
        return self.status == BillStatus.PENDING and self.due_date < date.today()
