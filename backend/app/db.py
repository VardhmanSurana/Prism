from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from app.config import settings

# SQLite async URL
DATABASE_URL = f"sqlite+aiosqlite:///{settings.BASE_DIR}/Prism.db"

# Enable WAL mode for better concurrent write performance
engine = create_async_engine(
    DATABASE_URL, 
    echo=False,
    connect_args={
        "timeout": 30.0,  # Wait up to 30 seconds for locks
    }
)

from sqlalchemy import event

@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA cache_size=-64000")  # 64MB cache
    cursor.execute("PRAGMA temp_store=MEMORY")
    cursor.close()

async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def init_db():
    """Initialize database with WAL mode enabled."""
    async with engine.connect() as conn:
        # Enable WAL mode for better concurrent performance
        await conn.exec_driver_sql("PRAGMA journal_mode=WAL")
        await conn.exec_driver_sql("PRAGMA synchronous=NORMAL")
        await conn.exec_driver_sql("PRAGMA cache_size=-64000")  # 64MB cache
        await conn.exec_driver_sql("PRAGMA temp_store=MEMORY")

async def get_db():
    async with async_session() as session:
        yield session
