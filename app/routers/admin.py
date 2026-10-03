from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .. import adapters, config, db, mock, pipeline, statcan

router = APIRouter(prefix="/admin/api", tags=["admin"])


class NewItem(BaseModel):
    label: str
    statcan_product: str


class CustomItem(BaseModel):
    label: str
    unit_text: str  # the metric, e.g. "100 millilitres"
    price: float = Field(gt=0)  # average price for that unit


@router.get("/products")
def search_products(q: str = ""):
    """Autocomplete: exact StatCan names that have an Ontario price for the latest month."""
    return [
        {"name": p.name, "label": p.label, "price": p.price, "unit_text": p.unit_text, "period": p.period}
        for p in statcan.search(q)
    ]


@router.get("/items")
def list_items():
    with db.connect() as conn:
        items = conn.execute("SELECT * FROM tracked_items ORDER BY label, id").fetchall()
        prices = conn.execute("SELECT * FROM prices ORDER BY price").fetchall()
    by_item: dict[int, list] = {}
    for p in prices:
        by_item.setdefault(p["item_id"], []).append(
            {"merchant": p["merchant"], "price": p["price"], "source": p["source"], "unit_text": p["unit_text"]}
        )
    return [{**dict(i), "prices": by_item.get(i["id"], [])} for i in items]


def _insert_item(label, product_name, source, baseline_merchant, base_price, unit_text, period) -> int:
    """Store the baseline row plus auto-generated faux rows for every simulated merchant."""
    rows = [(baseline_merchant, base_price, source)] + [
        (m, price, "mock") for m, price in mock.mock_prices(product_name, base_price).items()
    ]
    with db.connect() as conn:
        if conn.execute("SELECT 1 FROM tracked_items WHERE product_name = ?", (product_name,)).fetchone():
            raise HTTPException(409, f"'{product_name}' is already tracked")
        item_id = conn.execute(
            "INSERT INTO tracked_items (label, product_name, source) VALUES (?, ?, ?)",
            (label, product_name, source),
        ).lastrowid
        conn.executemany(
            "INSERT INTO prices (item_id, item, merchant, price, unit_text, source, period) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            [(item_id, label, m, pr, unit_text, src, period) for m, pr, src in rows],
        )
    return item_id


@router.post("/items", status_code=201)
def add_item(body: NewItem):
    label = body.label.strip()
    product = statcan.get(body.statcan_product)
    if not label:
        raise HTTPException(422, "Label is required")
    if product is None:
        raise HTTPException(422, "Unknown StatCan product")
    item_id = _insert_item(
        label, product.name, "statcan", config.STATCAN_MERCHANT, product.price, product.unit_text, product.period
    )
    return {"id": item_id}


@router.post("/items/custom", status_code=201)
def add_custom_item(body: CustomItem):
    """Override StatCan for items it doesn't carry (e.g. vanilla extract)."""
    label, unit = body.label.strip(), body.unit_text.strip()
    if not label or not unit:
        raise HTTPException(422, "Label and unit are required")
    item_id = _insert_item(
        label, f"{label}, {unit}", "custom", config.CUSTOM_MERCHANT, round(body.price, 2), unit,
        date.today().strftime("%Y-%m"),
    )
    return {"id": item_id}


@router.delete("/items/{item_id}", status_code=204)
def remove_item(item_id: int):
    with db.connect() as conn:
        if conn.execute("DELETE FROM tracked_items WHERE id = ?", (item_id,)).rowcount == 0:
            raise HTTPException(404, "Item not found")


@router.post("/refresh/{source}")
def refresh_source(source: str, postal_code: str = config.FLIPP_POSTAL_CODE):
    """Re-pull one source (flipp | mock) and replace its stored prices."""
    if source not in adapters.ADAPTERS:
        raise HTTPException(404, f"Unknown source '{source}'")
    adapter = adapters.FlippAdapter(postal_code) if source == "flipp" else adapters.ADAPTERS[source]()
    try:
        return pipeline.refresh(adapter)
    except OSError as e:
        raise HTTPException(502, f"{source} fetch failed: {e}")
