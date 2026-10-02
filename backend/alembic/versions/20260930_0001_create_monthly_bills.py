"""Cria a tabela de contas mensais e suas restrições de integridade."""

import sqlalchemy as sa

from alembic import op

revision = "20260930_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "monthly_bills",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("reference_month", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("amount_cents", sa.BigInteger(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING", "PAID", name="bill_status", native_enum=False, create_constraint=True
            ),
            nullable=False,
        ),
        sa.Column("paid_at", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("amount_cents > 0", name="ck_monthly_bills_positive_amount"),
        sa.CheckConstraint(
            "(status = 'PENDING' AND paid_at IS NULL) OR (status = 'PAID' AND paid_at IS NOT NULL)",
            name="ck_monthly_bills_payment_date",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_monthly_bills_reference_due", "monthly_bills", ["reference_month", "due_date", "id"]
    )


def downgrade() -> None:
    op.drop_index("ix_monthly_bills_reference_due", table_name="monthly_bills")
    op.drop_table("monthly_bills")
