"""Public API: best-priced retailer per requested item, ranked by unit price."""
from fastapi import APIRouter, HTTPException, Query

from .. import db
from ..normalize import parse_size, unit_price

router = APIRouter(tags=["prices"])

# Flipp deals win; otherwise the cheapest simulated merchant (derived from the StatCan/custom baseline).
SOURCE_PRIORITY = ("flipp", "mock")


@router.get("/prices")
def best_prices(items: str = Query(..., description="Comma-separated, e.g. eggs,sugar,milk")):
    wanted = [i.strip().lower() for i in items.split(",") if i.strip()]
    if not wanted:
        raise HTTPException(422, "Provide at least one item")
    with db.connect() as conn:
        out = [_best(conn, name) for name in wanted]
    return {"currency": "CAD", "items": out}


def _entry(name, matched=None, row=None) -> dict:
    size = parse_size(row["unit_text"]) if row else None
    return {
        "item": name,
        "matched": matched,
        "retailer": row["merchant"] if row else None,
        "price": round(row["price"], 2) if row else None,
        "size": {"quantity": size[0], "unit": size[1], "raw": row["unit_text"]} if size
        else ({"quantity": None, "unit": None, "raw": row["unit_text"]} if row else None),
        "unit_price": unit_price(row["price"], row["unit_text"]) if row else None,
        "source": row["source"] if row else None,
        "error": None if row else "not carried by any retailer",
    }


def _rank_key(row):
    # Rows with a parseable size rank by price per base unit; unparseable ones go last, by sticker price.
    size = parse_size(row["unit_text"])
    return (0, row["price"] / size[0]) if size and size[0] > 0 else (1, row["price"])


def _best(conn, name: str) -> dict:
    # Exact label first, then any tracked label containing the query ("sugar" -> "white sugar").
    item = conn.execute("SELECT id, label FROM tracked_items WHERE lower(label) = ?", (name,)).fetchone() or \
        conn.execute("SELECT id, label FROM tracked_items WHERE lower(label) LIKE ? ORDER BY length(label)",
                     (f"%{name}%",)).fetchone()
    if item:
        for source in SOURCE_PRIORITY:
            rows = conn.execute("SELECT merchant, price, unit_text, source FROM prices WHERE item_id = ? AND source = ?",
                                (item["id"], source)).fetchall()
            if rows:
                return _entry(name, item["label"], min(rows, key=_rank_key))
    return _entry(name)
