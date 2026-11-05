"""SQLite engine/session setup."""

from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine

# Make sure the model classes are registered on SQLModel.metadata before
# create_all() is ever called, regardless of import order elsewhere.
from . import models  # noqa: F401

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "followup.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
