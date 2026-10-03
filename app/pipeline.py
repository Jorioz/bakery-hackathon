"""adapter -> normalize -> SQLite. Replaces all rows previously stored for that source."""
from . import db
from .adapters import Adapter
from .normalize import normalize


def refresh(adapter: Adapter) -> dict:
    with db.connect() as conn:
        items = [dict(r) for r in conn.execute("SELECT id, label FROM tracked_items")]
    listings = adapter.fetch([i["label"] for i in items])
    rows = normalize(listings, items)
    with db.connect() as conn:
        conn.execute("DELETE FROM prices WHERE source = ?", (adapter.source,))
        conn.executemany(
            "INSERT INTO prices (item_id, item, merchant, price, unit_text, source, period) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [(r.item_id, r.item, r.merchant, r.price, r.unit_text, adapter.source, r.period) for r in rows],
        )
    return {"source": adapter.source, "listings": len(listings), "matched": len(rows)}
