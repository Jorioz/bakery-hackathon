"""Admin CRUD for the kitchen: ingredients, specials (and their add-ins), and inventory batches."""
from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .. import db

router = APIRouter(prefix="/admin/api/kitchen", tags=["kitchen"])

EXPIRING_DAYS = 3  # batches expiring within this many days are flagged


class Ingredient(BaseModel):
    name: str
    role: Literal["base", "addin"] = "addin"
    unit_text: str
    baseline: float = Field(gt=0)
    perishable: bool = False
    stock_unit: str = "units"
    reorder_at: float = Field(default=0, ge=0)


class Special(BaseModel):
    name: str
    status: Literal["idea", "testing", "active", "retired"] = "idea"
    notes: str = ""
    ingredient_ids: list[int] = []


class Batch(BaseModel):
    ingredient_id: int
    quantity: float = Field(ge=0)
    expires_on: date | None = None


def _404(cur, what: str):
    if cur.rowcount == 0:
        raise HTTPException(404, f"{what} not found")


# --- ingredients -------------------------------------------------------------

@router.get("/ingredients")
def list_ingredients():
    """Ingredients with on-hand stock (unexpired batches only) and alert flags."""
    today = date.today().isoformat()
    soon = (date.today() + timedelta(days=EXPIRING_DAYS)).isoformat()
    with db.connect() as conn:
        rows = conn.execute("""
            SELECT i.*,
                   COALESCE(SUM(CASE WHEN v.expires_on IS NULL OR v.expires_on >= ? THEN v.quantity END), 0) AS on_hand,
                   MIN(CASE WHEN v.expires_on >= ? THEN v.expires_on END) AS next_expiry,
                   COUNT(CASE WHEN v.expires_on < ? THEN 1 END) AS expired_batches,
                   COUNT(CASE WHEN v.expires_on >= ? AND v.expires_on <= ? THEN 1 END) AS expiring_batches
            FROM ingredients i LEFT JOIN inventory v ON v.ingredient_id = i.id
            GROUP BY i.id ORDER BY i.role DESC, i.name""", (today, today, today, today, soon)).fetchall()
    return [{**dict(r), "perishable": bool(r["perishable"]), "low_stock": r["on_hand"] < r["reorder_at"]}
            for r in rows]


@router.post("/ingredients", status_code=201)
def add_ingredient(body: Ingredient):
    with db.connect() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO ingredients (name, role, unit_text, baseline, perishable, stock_unit, reorder_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)", _ingredient_values(body))
        except db.sqlite3.IntegrityError:
            raise HTTPException(409, f"'{body.name}' already exists")
    return {"id": cur.lastrowid}


@router.put("/ingredients/{ingredient_id}")
def update_ingredient(ingredient_id: int, body: Ingredient):
    with db.connect() as conn:
        _404(conn.execute(
            "UPDATE ingredients SET name=?, role=?, unit_text=?, baseline=?, perishable=?, stock_unit=?, reorder_at=? "
            "WHERE id=?", (*_ingredient_values(body), ingredient_id)), "Ingredient")
    return {"id": ingredient_id}


@router.delete("/ingredients/{ingredient_id}", status_code=204)
def remove_ingredient(ingredient_id: int):
    with db.connect() as conn:
        _404(conn.execute("DELETE FROM ingredients WHERE id = ?", (ingredient_id,)), "Ingredient")


def _ingredient_values(b: Ingredient) -> tuple:
    name = b.name.strip().lower()
    if not name or not b.unit_text.strip():
        raise HTTPException(422, "Name and unit are required")
    return (name, b.role, b.unit_text.strip(), round(b.baseline, 2), int(b.perishable),
            b.stock_unit.strip() or "units", b.reorder_at)


# --- specials ----------------------------------------------------------------

@router.get("/specials")
def list_specials():
    with db.connect() as conn:
        specials = [dict(r) for r in conn.execute("SELECT * FROM specials ORDER BY name")]
        links = conn.execute("SELECT special_id, ingredient_id FROM special_ingredients").fetchall()
    for s in specials:
        s["ingredient_ids"] = [l["ingredient_id"] for l in links if l["special_id"] == s["id"]]
    return specials


@router.post("/specials", status_code=201)
def add_special(body: Special):
    with db.connect() as conn:
        try:
            sid = conn.execute("INSERT INTO specials (name, status, notes) VALUES (?, ?, ?)",
                               (_name(body.name), body.status, body.notes)).lastrowid
        except db.sqlite3.IntegrityError:
            raise HTTPException(409, f"'{body.name}' already exists")
        _set_links(conn, sid, body.ingredient_ids)
    return {"id": sid}


@router.put("/specials/{special_id}")
def update_special(special_id: int, body: Special):
    with db.connect() as conn:
        _404(conn.execute("UPDATE specials SET name=?, status=?, notes=? WHERE id=?",
                          (_name(body.name), body.status, body.notes, special_id)), "Special")
        _set_links(conn, special_id, body.ingredient_ids)
    return {"id": special_id}


@router.delete("/specials/{special_id}", status_code=204)
def remove_special(special_id: int):
    with db.connect() as conn:
        _404(conn.execute("DELETE FROM specials WHERE id = ?", (special_id,)), "Special")


def _name(name: str) -> str:
    if not name.strip():
        raise HTTPException(422, "Name is required")
    return name.strip()


def _set_links(conn, special_id: int, ingredient_ids: list[int]) -> None:
    conn.execute("DELETE FROM special_ingredients WHERE special_id = ?", (special_id,))
    try:
        conn.executemany("INSERT INTO special_ingredients (special_id, ingredient_id) VALUES (?, ?)",
                         [(special_id, i) for i in set(ingredient_ids)])
    except db.sqlite3.IntegrityError:
        raise HTTPException(422, "Unknown ingredient id")


# --- inventory ---------------------------------------------------------------

@router.get("/inventory")
def list_inventory():
    """Every batch, soonest expiry first."""
    with db.connect() as conn:
        rows = conn.execute("""
            SELECT v.*, i.name, i.stock_unit FROM inventory v JOIN ingredients i ON i.id = v.ingredient_id
            ORDER BY v.expires_on IS NULL, v.expires_on, i.name""").fetchall()
    return [dict(r) for r in rows]


@router.post("/inventory", status_code=201)
def add_batch(body: Batch):
    with db.connect() as conn:
        try:
            cur = conn.execute("INSERT INTO inventory (ingredient_id, quantity, expires_on) VALUES (?, ?, ?)",
                               (body.ingredient_id, body.quantity, _iso(body.expires_on)))
        except db.sqlite3.IntegrityError:
            raise HTTPException(422, "Unknown ingredient id")
    return {"id": cur.lastrowid}


@router.put("/inventory/{batch_id}")
def update_batch(batch_id: int, body: Batch):
    with db.connect() as conn:
        _404(conn.execute("UPDATE inventory SET ingredient_id=?, quantity=?, expires_on=? WHERE id=?",
                          (body.ingredient_id, body.quantity, _iso(body.expires_on), batch_id)), "Batch")
    return {"id": batch_id}


@router.delete("/inventory/{batch_id}", status_code=204)
def remove_batch(batch_id: int):
    with db.connect() as conn:
        _404(conn.execute("DELETE FROM inventory WHERE id = ?", (batch_id,)), "Batch")


def _iso(d: date | None) -> str | None:
    return d.isoformat() if d else None
