from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os

# ── Fix: escape percent signs so configparser doesn't choke on
# URL-encoded characters like %23 %3F %2C in DATABASE_URL ──────────
def get_database_url():
    url = os.environ.get("DATABASE_URL", "")
    # Replace % with %% so configparser treats them as literals
    return url.replace("%", "%%")

config = context.config

# Override the sqlalchemy.url with the escaped version
config.set_main_option("sqlalchemy.url", get_database_url())

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

from app.models import Base
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # Use the raw unescaped URL for the actual engine connection
    raw_url = os.environ.get("DATABASE_URL", "")
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = raw_url

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()