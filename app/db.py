import sqlite3
from contextlib import contextmanager

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS tracked_items (
    id INTEGER PRIMARY KEY,
    label TEXT NOT NULL,
    product_name TEXT NOT NULL UNIQUE,   -- exact StatCan name, or 'label, unit' for custom items
    source TEXT NOT NULL DEFAULT 'statcan',  -- 'statcan' | 'custom'
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS prices (
    id INTEGER PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES tracked_items(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    merchant TEXT NOT NULL,
    price REAL NOT NULL,
    unit_text TEXT NOT NULL,
    source TEXT NOT NULL,          -- 'statcan' | 'custom' | 'mock' (later 'flipp')
    period TEXT NOT NULL,          -- StatCan reference month, e.g. 2026-07
    collected_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prices_item ON prices(item);

-- Kitchen: ingredients used by the Parfait and its weekly specials, plus on-hand stock.
CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,         -- also the Flipp search term
    role TEXT NOT NULL DEFAULT 'addin',  -- 'base' (original recipe) | 'addin' (specials)
    unit_text TEXT NOT NULL,           -- package size the baseline refers to, e.g. '300 g'
    baseline REAL NOT NULL,            -- regular shelf price; flyer prices below it are deals
    perishable INTEGER NOT NULL DEFAULT 0,
    stock_unit TEXT NOT NULL DEFAULT 'units',  -- what inventory quantities count, e.g. 'kg', 'packs'
    reorder_at REAL NOT NULL DEFAULT 0,         -- low-stock threshold in stock_unit
    base_amount REAL,                  -- base ingredients: amount per parfait
    base_unit TEXT                     -- unit of base_amount ('g', 'ml', 'each')
);
CREATE TABLE IF NOT EXISTS specials (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'idea',  -- 'idea' | 'testing' | 'active' | 'retired'
    notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS special_ingredients (
    special_id INTEGER NOT NULL REFERENCES specials(id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    amount REAL,                       -- amount per parfait, in unit
    unit TEXT,                         -- 'g', 'ml', 'each'
    PRIMARY KEY (special_id, ingredient_id)
);
CREATE TABLE IF NOT EXISTS inventory (  -- one row per received batch, so each can carry its own expiry
    id INTEGER PRIMARY KEY,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity REAL NOT NULL,
    expires_on TEXT,                    -- YYYY-MM-DD, NULL for shelf-stable
    received_on TEXT NOT NULL DEFAULT (date('now'))
);
"""


def init_db() -> None:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA)
        _migrate(conn)
        if not conn.execute("SELECT 1 FROM ingredients").fetchone():
            from .kitchen_seed import seed
            seed(conn)


def _add_column(conn, table: str, column: str, decl: str) -> None:
    if column not in {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")


def _migrate(conn) -> None:
    """Upgrade a DB created before custom items / recipe amounts existed."""
    _add_column(conn, "ingredients", "base_amount", "REAL")
    _add_column(conn, "ingredients", "base_unit", "TEXT")
    _add_column(conn, "special_ingredients", "amount", "REAL")
    _add_column(conn, "special_ingredients", "unit", "TEXT")
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(tracked_items)")}
    if "statcan_product" in cols:
        conn.execute("ALTER TABLE tracked_items RENAME COLUMN statcan_product TO product_name")
    if "source" not in cols:
        conn.execute("ALTER TABLE tracked_items ADD COLUMN source TEXT NOT NULL DEFAULT 'statcan'")


@contextmanager
def connect():
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
