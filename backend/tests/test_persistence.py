import os
import subprocess
import sys
from datetime import date
from pathlib import Path

from sqlalchemy import create_engine, inspect, select
from sqlalchemy.orm import Session

from app.core.config import BACKEND_DIR, Settings
from app.modules.bills.model import BillStatus, MonthlyBill
from app.seed import SEED_BILLS, seed_bills


def test_seed_is_idempotent_and_preserves_payment(session):
    assert sum(amount for _, amount, _ in SEED_BILLS) == 237570
    assert seed_bills(session) == 10
    bills = list(session.scalars(select(MonthlyBill)))
    assert len(bills) == 10
    assert sum(bill.amount_cents for bill in bills) == 237570
    assert all(bill.status == BillStatus.PENDING and bill.paid_at is None for bill in bills)
    assert all(bill.reference_month == date(2026, 9, 1) for bill in bills)
    bills[0].status = BillStatus.PAID
    bills[0].paid_at = date(2026, 9, 1)
    bills[0].amount_cents = 142001
    session.commit()
    assert seed_bills(session) == 0
    assert len(list(session.scalars(select(MonthlyBill)))) == 10
    session.refresh(bills[0])
    assert bills[0].status == BillStatus.PAID
    assert bills[0].paid_at == date(2026, 9, 1)
    assert bills[0].amount_cents == 142001


def test_seed_data_persists_with_a_new_engine(database, session):
    seed_bills(session)
    database_url = str(database.url)
    session.close()
    database.dispose()
    restarted_engine = create_engine(database_url)
    try:
        with Session(restarted_engine) as restarted_session:
            bills = list(restarted_session.scalars(select(MonthlyBill)))
            assert len(bills) == 10
            assert sum(bill.amount_cents for bill in bills) == 237570
    finally:
        restarted_engine.dispose()


def test_relative_database_path_is_independent_of_working_directory(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    settings = Settings(database_url="sqlite:///./stable.db", _env_file=None)
    expected = (BACKEND_DIR / "stable.db").resolve()
    engine = create_engine(settings.resolved_database_url)
    assert Path(engine.url.database) == expected
    engine.dispose()


def test_migration_and_seed_commands_from_fresh_database(tmp_path):
    database_path = tmp_path / "migration.db"
    environment = {**os.environ, "DATABASE_URL": f"sqlite:///{database_path}"}

    def run_module(*arguments):
        return subprocess.run(
            [sys.executable, "-m", *arguments],
            cwd=BACKEND_DIR,
            env=environment,
            check=True,
            capture_output=True,
            text=True,
        )

    run_module("alembic", "upgrade", "head")
    assert "10 conta(s)" in run_module("app.seed").stdout
    assert "0 conta(s)" in run_module("app.seed").stdout
    run_module("alembic", "check")
    engine = create_engine(environment["DATABASE_URL"])
    try:
        with Session(engine) as session:
            bills = list(session.scalars(select(MonthlyBill)))
            assert len(bills) == 10
            assert sum(bill.amount_cents for bill in bills) == 237570
        assert "monthly_bills" in inspect(engine).get_table_names()
    finally:
        engine.dispose()
    run_module("alembic", "downgrade", "base")
    run_module("alembic", "upgrade", "head")
