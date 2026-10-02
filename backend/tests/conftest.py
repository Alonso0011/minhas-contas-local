import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.db.session import get_session
from app.main import app


@pytest.fixture
def database(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def session(database):
    with sessionmaker(database, expire_on_commit=False)() as session:
        yield session


@pytest.fixture
def client(session):
    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def bill_payload():
    return {
        "name": "Conexão Nuvem",
        "reference_month": "2026-09-20",
        "due_date": "2026-09-05",
        "amount_cents": 9000,
        "status": "PENDING",
        "paid_at": None,
    }
