"""Cria uma cópia consistente do SQLite sem alterar o banco original."""

import sqlite3
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from sqlalchemy.engine import make_url  # noqa: E402

from app.core.config import get_settings  # noqa: E402


def main() -> None:
    url = make_url(get_settings().resolved_database_url)
    if url.get_backend_name() != "sqlite" or not url.database:
        raise SystemExit("O backup local requer um banco SQLite em arquivo.")
    source_path = Path(url.database).resolve(strict=True)
    backup_dir = PROJECT_ROOT / "backups"
    backup_dir.mkdir(exist_ok=True)
    target_path = backup_dir / f"minhas-contas-{datetime.now():%Y%m%d-%H%M%S-%f}.db"
    with sqlite3.connect(source_path.as_uri() + "?mode=ro", uri=True) as source:
        with sqlite3.connect(target_path) as target:
            source.backup(target)
            if target.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise SystemExit("O backup não passou na verificação de integridade.")
    print(f"Backup verificado: {target_path}")


if __name__ == "__main__":
    main()
