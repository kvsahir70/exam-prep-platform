from collections.abc import Iterator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


_settings = get_settings()
_connect_args = {"check_same_thread": False} if _settings.database_url.startswith("sqlite") else {}
engine = create_engine(_settings.database_url, pool_pre_ping=True, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def add_missing_columns() -> list[str]:
    """Add columns that exist in the models but not in the database (new nullable/defaulted columns only).

    `create_all` creates missing tables but never alters existing ones; this keeps a dev database usable
    across releases. Real schema changes (types, constraints) still need proper migrations."""
    added = []
    insp = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not insp.has_table(table.name):
                continue
            have = {c["name"] for c in insp.get_columns(table.name)}
            for column in table.columns:
                if column.name in have:
                    continue
                ddl = column.type.compile(dialect=engine.dialect)
                default = ""
                if column.default is not None and getattr(column.default, "is_scalar", False):
                    value = column.default.arg
                    default = f" DEFAULT {int(value) if isinstance(value, bool) else repr(value)}"
                conn.execute(text(f'ALTER TABLE {table.name} ADD COLUMN {column.name} {ddl}{default}'))
                added.append(f"{table.name}.{column.name}")
    return added
