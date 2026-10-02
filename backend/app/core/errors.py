from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    messages = {
        "missing": "Campo obrigatório.",
        "int_type": "Informe um número inteiro de centavos.",
        "int_parsing": "Informe um número inteiro.",
        "greater_than": "O valor deve ser maior que zero.",
        "less_than_equal": "O valor informado ultrapassa o limite permitido.",
        "string_type": "Informe um texto válido.",
        "string_too_short": "Informe o nome da conta.",
        "string_too_long": "O nome deve ter no máximo 120 caracteres.",
        "string_pattern_mismatch": "Use o formato AAAA-MM para a competência.",
        "enum": "O status deve ser PENDING ou PAID.",
        "extra_forbidden": "Campo não permitido.",
        "json_invalid": "O corpo da requisição deve conter um JSON válido.",
        "model_attributes_type": "O corpo da requisição deve ser um objeto JSON.",
    }
    errors = []
    for error in exc.errors():
        message = messages.get(error["type"], "Valor inválido para este campo.")
        if error["type"] == "value_error":
            message = error["msg"].removeprefix("Value error, ")
        errors.append({"loc": error["loc"], "msg": message, "type": error["type"]})
    return JSONResponse(status_code=422, content={"detail": errors})
