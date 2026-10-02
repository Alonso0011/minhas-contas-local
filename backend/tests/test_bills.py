from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.modules.bills.model import BillStatus, MonthlyBill

API = "/api/v1/bills"


def test_crud_month_filter_and_summary(client, bill_payload):
    created = client.post(API, json=bill_payload)
    assert created.status_code == 201
    bill = created.json()
    assert bill["reference_month"] == "2026-09-01"
    assert bill["amount_cents"] == 9000
    assert bill["paid_at"] is None
    assert bill["created_at"]
    assert bill["updated_at"]

    bill_id = bill["id"]
    assert client.get(f"{API}/{bill_id}").json() == bill
    october = {
        **bill_payload,
        "name": "Moradia Aurora",
        "reference_month": "2026-10-01",
        "due_date": "2026-10-17",
        "amount_cents": 181500,
    }
    assert client.post(API, json=october).status_code == 201
    september_bills = client.get(API, params={"month": "2026-09"}).json()
    assert [item["id"] for item in september_bills] == [bill_id]
    assert len(client.get(API, params={"month": "2026-10"}).json()) == 1
    assert client.get(API, params={"month": "2027-09"}).json() == []
    assert client.get(f"{API}/summary?month=2026-09").json() == {
        "reference_month": "2026-09-01",
        "total_amount_cents": 9000,
        "bill_count": 1,
    }

    updated = client.patch(
        f"{API}/{bill_id}", json={"name": "Conexão Nuvem Plus", "amount_cents": 10050}
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Conexão Nuvem Plus"
    assert updated.json()["amount_cents"] == 10050
    assert updated.json()["reference_month"] == "2026-09-01"
    assert client.get(f"{API}/summary?month=2026-09").json()["total_amount_cents"] == 10050

    deleted = client.delete(f"{API}/{bill_id}")
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert client.get(f"{API}/{bill_id}").status_code == 404
    assert client.get(f"{API}/summary?month=2026-09").json() == {
        "reference_month": "2026-09-01",
        "total_amount_cents": 0,
        "bill_count": 0,
    }


def test_payment_transitions_and_manual_date(client, bill_payload):
    bill_id = client.post(API, json=bill_payload).json()["id"]
    endpoint = f"{API}/{bill_id}"
    paid = client.patch(endpoint, json={"status": "PAID"}).json()
    assert paid["status"] == "PAID"
    assert paid["paid_at"] == date.today().isoformat()
    assert paid["is_overdue"] is False

    manual_date = "2026-08-31"
    assert client.patch(endpoint, json={"paid_at": manual_date}).json()["paid_at"] == manual_date
    assert client.patch(endpoint, json={"name": "Plano Nuvem"}).json()["paid_at"] == manual_date
    assert client.patch(endpoint, json={"status": "PAID"}).json()["paid_at"] == manual_date
    pending = client.patch(endpoint, json={"status": "PENDING", "paid_at": manual_date}).json()
    assert pending["status"] == "PENDING"
    assert pending["paid_at"] is None
    assert client.patch(endpoint, json={"paid_at": manual_date}).json()["paid_at"] is None
    paid_again = client.patch(endpoint, json={"status": "PAID", "paid_at": None}).json()
    assert paid_again["paid_at"] == date.today().isoformat()


@pytest.mark.parametrize("paid_at", [None, "2026-09-03"])
def test_create_paid_bill(client, bill_payload, paid_at):
    result = client.post(API, json={**bill_payload, "status": "PAID", "paid_at": paid_at})
    assert result.status_code == 201
    assert result.json()["paid_at"] == (paid_at or date.today().isoformat())


@pytest.mark.parametrize("offset,expected", [(-1, True), (0, False), (1, False)])
def test_overdue_is_computed_from_calendar_dates(client, bill_payload, session, offset, expected):
    due_date = date.today() + timedelta(days=offset)
    result = client.post(
        API,
        json={
            **bill_payload,
            "reference_month": due_date.replace(day=1).isoformat(),
            "due_date": due_date.isoformat(),
        },
    )
    bill = result.json()
    assert bill["is_overdue"] is expected
    assert "is_overdue" not in MonthlyBill.__table__.columns
    stored = session.get(MonthlyBill, bill["id"])
    assert stored.status == BillStatus.PENDING
    assert stored.due_date == due_date
    assert (
        client.patch(f"{API}/{bill['id']}", json={"status": "PAID"}).json()["is_overdue"] is False
    )


@pytest.mark.parametrize(
    "invalid",
    [
        {"amount_cents": 0},
        {"amount_cents": -1},
        {"amount_cents": 1.25},
        {"amount_cents": 10.0},
        {"amount_cents": "9000"},
        {"amount_cents": True},
        {"amount_cents": 10**30},
        {"name": "   "},
        {"name": "a" * 121},
        {"status": "OVERDUE"},
        {"due_date": "2026-10-01"},
        {"due_date": "2026-09-31"},
        {"due_date": "2026-09-01T00:00:00Z"},
        {"reference_month": 1788220800},
        {"paid_at": "2026-09-01T12:00:00-03:00"},
        {"paid_at": "2026-02-30"},
        {"unknown": "campo"},
    ],
)
def test_invalid_bill_is_rejected_without_insertion(client, session, bill_payload, invalid):
    response = client.post(API, json={**bill_payload, **invalid})
    assert response.status_code == 422
    assert response.json()["detail"]
    assert list(session.scalars(select(MonthlyBill))) == []


@pytest.mark.parametrize("month", ["2026-00", "2026-13", "2026-9", "2026-09-01", "0000-09", "abcd"])
def test_invalid_month_query(client, month):
    for endpoint in [API, f"{API}/summary"]:
        result = client.get(endpoint, params={"month": month})
        assert result.status_code == 422
        assert "AAAA-MM" in result.json()["detail"]


def test_month_query_is_required(client):
    result = client.get(API)
    assert result.status_code == 422
    assert result.json()["detail"][0]["msg"] == "Campo obrigatório."


def test_patch_validates_merged_dates_and_is_atomic(client, bill_payload):
    bill = client.post(API, json=bill_payload).json()
    endpoint = f"{API}/{bill['id']}"
    invalid_patches = [
        {"reference_month": "2026-10-01", "name": "Não salvar"},
        {"due_date": "2026-10-01"},
        {"name": None},
        {"reference_month": None},
        {"due_date": None},
        {"amount_cents": None},
        {"status": None},
        {"amount_cents": False},
        {"amount_cents": 1.5},
    ]
    for patch in invalid_patches:
        assert client.patch(endpoint, json=patch).status_code == 422
        assert client.get(endpoint).json() == bill
    moved = client.patch(endpoint, json={"reference_month": "2026-10-19", "due_date": "2026-10-22"})
    assert moved.status_code == 200
    assert moved.json()["reference_month"] == "2026-10-01"
    assert client.get(API, params={"month": "2026-09"}).json() == []
    assert len(client.get(API, params={"month": "2026-10"}).json()) == 1


def test_list_is_ordered_by_due_date(client, bill_payload):
    for day in [17, 5, 10]:
        assert (
            client.post(API, json={**bill_payload, "due_date": f"2026-09-{day:02d}"}).status_code
            == 201
        )
    result = client.get(API, params={"month": "2026-09"}).json()
    assert [bill["due_date"] for bill in result] == ["2026-09-05", "2026-09-10", "2026-09-17"]


def test_missing_bill_errors_are_clear(client):
    responses = [
        client.get(f"{API}/999"),
        client.patch(f"{API}/999", json={"name": "Conta"}),
        client.delete(f"{API}/999"),
    ]
    for response in responses:
        assert response.status_code == 404
        assert response.json() == {"detail": "Conta não encontrada."}


def test_name_is_trimmed(client, bill_payload):
    response = client.post(API, json={**bill_payload, "name": "  Conexão Nuvem  "})
    assert response.json()["name"] == "Conexão Nuvem"


def test_cors_allows_configured_frontend(client):
    response = client.options(
        API,
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    denied = client.options(
        API,
        headers={"Origin": "https://unconfigured.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in denied.headers
