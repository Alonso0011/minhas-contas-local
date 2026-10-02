"""Valida a API local por HTTP e remove a conta temporária ao terminar."""

import argparse
import json
from datetime import date, timedelta
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4


def request(base_url, method, path, payload=None, expected=200):
    data = json.dumps(payload).encode() if payload is not None else None
    req = Request(
        f"{base_url.rstrip('/')}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method=method,
    )
    try:
        response = urlopen(req, timeout=10)
    except HTTPError as exc:
        response = exc
    with response:
        body = response.read().decode()
        assert response.status == expected, (
            f"{method} {path}: HTTP {response.status}; esperado {expected}. {body}"
        )
        return json.loads(body) if body else None


def run(base_url, check_seed):
    request(base_url, "GET", "/health")
    if check_seed:
        bills = request(base_url, "GET", "/bills?month=2026-09")
        summary = request(base_url, "GET", "/bills/summary?month=2026-09")
        assert len(bills) == summary["bill_count"] == 10
        assert summary["total_amount_cents"] == 237570
        print("Seed: 10 contas e R$ 2.375,70 confirmados.")

    today = date.today()
    due_date = today - timedelta(days=1)
    month = due_date.strftime("%Y-%m")
    baseline = request(base_url, "GET", f"/bills/summary?month={month}")
    bill_id = None
    try:
        bill = request(
            base_url,
            "POST",
            "/bills",
            {
                "name": f"Teste temporário {uuid4().hex[:8]}",
                "reference_month": due_date.isoformat(),
                "due_date": due_date.isoformat(),
                "amount_cents": 12345,
                "status": "PENDING",
            },
            expected=201,
        )
        bill_id = bill["id"]
        path = f"/bills/{bill_id}"
        assert bill["reference_month"] == f"{month}-01"
        assert bill["is_overdue"] and bill["paid_at"] is None
        assert request(base_url, "GET", path)["id"] == bill_id
        bills = request(base_url, "GET", f"/bills?month={month}")
        assert any(item["id"] == bill_id for item in bills)

        changed = request(base_url, "PATCH", path, {"amount_cents": 23456})
        assert changed["amount_cents"] == 23456
        summary = request(base_url, "GET", f"/bills/summary?month={month}")
        assert summary["bill_count"] == baseline["bill_count"] + 1
        assert summary["total_amount_cents"] == baseline["total_amount_cents"] + 23456

        paid = request(base_url, "PATCH", path, {"status": "PAID"})
        assert paid["paid_at"] == today.isoformat() and not paid["is_overdue"]
        manual = request(base_url, "PATCH", path, {"paid_at": due_date.isoformat()})
        assert manual["paid_at"] == due_date.isoformat()
        pending = request(base_url, "PATCH", path, {"status": "PENDING"})
        assert pending["paid_at"] is None and pending["is_overdue"]
        request(base_url, "PATCH", path, {"amount_cents": 1.5}, expected=422)
        request(base_url, "PATCH", path, {"amount_cents": 0}, expected=422)
        request(base_url, "PATCH", path, {"status": "OVERDUE"}, expected=422)

        request(base_url, "DELETE", path, expected=204)
        bill_id = None
        request(base_url, "GET", path, expected=404)
        assert request(base_url, "GET", f"/bills/summary?month={month}") == baseline
    finally:
        if bill_id is not None:
            request(base_url, "DELETE", f"/bills/{bill_id}", expected=204)
    print("Smoke HTTP aprovado: health, CRUD, filtro, resumo, pagamento, atraso e validação.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000/api/v1")
    parser.add_argument("--check-seed", action="store_true")
    args = parser.parse_args()
    run(args.base_url, args.check_seed)
