from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.modules.bills import service
from app.modules.bills.schemas import BillCreate, BillRead, BillUpdate, MonthlySummary

router = APIRouter(prefix="/bills", tags=["Contas"])
SessionDependency = Annotated[Session, Depends(get_session)]
MonthQuery = Annotated[
    str, Query(description="Competência no formato AAAA-MM", examples=["2026-09"])
]


@router.get("", response_model=list[BillRead], summary="Listar contas da competência")
def list_bills(session: SessionDependency, month: MonthQuery) -> list:
    return service.list_bills(session, service.parse_month(month))


@router.get("/summary", response_model=MonthlySummary, summary="Consultar resumo mensal")
def monthly_summary(session: SessionDependency, month: MonthQuery) -> MonthlySummary:
    return service.monthly_summary(session, service.parse_month(month))


@router.get("/{bill_id}", response_model=BillRead, summary="Consultar uma conta")
def get_bill(bill_id: int, session: SessionDependency):
    return service.get_bill(session, bill_id)


@router.post(
    "", response_model=BillRead, status_code=status.HTTP_201_CREATED, summary="Cadastrar conta"
)
def create_bill(payload: BillCreate, session: SessionDependency):
    return service.create_bill(session, payload)


@router.patch("/{bill_id}", response_model=BillRead, summary="Atualizar conta")
def update_bill(bill_id: int, payload: BillUpdate, session: SessionDependency):
    return service.update_bill(session, service.get_bill(session, bill_id), payload)


@router.delete("/{bill_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Excluir conta")
def delete_bill(bill_id: int, session: SessionDependency) -> Response:
    service.delete_bill(session, service.get_bill(session, bill_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
