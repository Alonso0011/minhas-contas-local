from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.modules.bills.model import BillStatus, MonthlyBill

SEED_MONTH = date(2026, 9, 1)
SEED_BILLS = (
    ("Moradia Aurora", 142000, 5),
    ("Conexão Nuvem", 9900, 8),
    ("Energia Horizonte", 18640, 12),
    ("Água Cristal", 7250, 15),
    ("Academia Órbita", 11900, 20),
    ("Clube de leitura", 3990, 22),
    ("Música Estelar", 2990, 23),
    ("Curso Horizonte", 25900, 24),
    ("Transporte Lunar", 8500, 25),
    ("Jardim Solar", 6500, 28),
)


def seed_bills(session: Session) -> int:
    """Insere exemplos ausentes por nome e competência, preservando contas já editadas ou pagas."""
    existing_names = set(
        session.scalars(select(MonthlyBill.name).where(MonthlyBill.reference_month == SEED_MONTH))
    )
    inserted = 0
    for name, amount_cents, due_day in SEED_BILLS:
        if name not in existing_names:
            session.add(
                MonthlyBill(
                    name=name,
                    amount_cents=amount_cents,
                    reference_month=SEED_MONTH,
                    due_date=date(2026, 9, due_day),
                    status=BillStatus.PENDING,
                    paid_at=None,
                )
            )
            inserted += 1
    session.commit()
    return inserted


def main() -> None:
    with SessionLocal() as session:
        inserted = seed_bills(session)
        print(f"Seed concluído: {inserted} conta(s) inserida(s).")


if __name__ == "__main__":
    main()
