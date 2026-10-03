"""On-hand stock in recipe units (g/ml/each), servings per recipe, and first-expiring-first-out deduction."""
from datetime import date
from math import floor

from fastapi import HTTPException

from .normalize import parse_size

DIRECT_UNITS = {"g", "kg", "lb", "ml", "l", "each"}  # stock_units that are themselves a measure
EPS = 1e-9


def stock_factor(ing) -> tuple[float, str] | None:
    """(base units per 1 stock_unit, base unit): 'kg' -> (1000, 'g'); 'packs' of '300 g' -> (300, 'g')."""
    unit = ing["stock_unit"].strip().lower()
    return parse_size(f"1 {unit}") if unit in DIRECT_UNITS else parse_size(ing["unit_text"])


def on_hand(conn) -> dict[int, dict]:
    """ingredient id -> {row, stock (unexpired qty), amount (base units or None), unit, next_expiry, expired_batches}."""
    today = date.today().isoformat()
    out = {}
    for ing in conn.execute("SELECT * FROM ingredients ORDER BY role DESC, name"):
        batches = conn.execute("SELECT quantity, expires_on FROM inventory WHERE ingredient_id = ?", (ing["id"],)).fetchall()
        fresh = [b for b in batches if b["expires_on"] is None or b["expires_on"] >= today]
        stock = sum(b["quantity"] for b in fresh)
        factor = stock_factor(ing)
        out[ing["id"]] = {
            "row": ing, "stock": stock,
            "amount": stock * factor[0] if factor else None, "unit": factor[1] if factor else None,
            "next_expiry": min((b["expires_on"] for b in fresh if b["expires_on"]), default=None),
            "expired_batches": sum(1 for b in batches if b["expires_on"] and b["expires_on"] < today),
        }
    return out


def recipes(conn, include_retired: bool = False) -> list[dict]:
    """Specials with every line (base + add-ins): {name, status, lines: [(ingredient id, amount, unit)]}."""
    base = [(r["id"], r["base_amount"], r["base_unit"]) for r in conn.execute("SELECT * FROM ingredients WHERE role = 'base'")]
    q = "SELECT * FROM specials" + ("" if include_retired else " WHERE status != 'retired'") + " ORDER BY id"
    out = []
    for s in conn.execute(q).fetchall():
        addins = [(r["ingredient_id"], r["amount"], r["unit"]) for r in conn.execute(
            "SELECT * FROM special_ingredients WHERE special_id = ?", (s["id"],))]
        out.append({"name": s["name"], "status": s["status"], "lines": base + addins})
    return out


def servings(recipe: dict, stock: dict) -> dict:
    """How many parfaits the unexpired stock covers, and what limits it."""
    best, limiting, unknown = None, None, []
    for ing_id, amount, unit in recipe["lines"]:
        s = stock[ing_id]
        if not amount or s["unit"] != unit or s["amount"] is None:
            unknown.append(s["row"]["name"])  # no amount, or stock can't be converted to the recipe's unit
            continue
        n = floor(s["amount"] / amount + EPS)
        if best is None or n < best:
            best, limiting = n, s["row"]["name"]
    return {"servings": best, "limiting_ingredient": limiting, "unconverted": unknown}


def use(conn, wanted: list[tuple[str, int]]) -> dict:
    """Deduct stock for N parfaits per recipe, soonest-expiring batches first. All or nothing."""
    by_name = {r["name"].lower(): r for r in recipes(conn, include_retired=True)}
    need: dict[int, float] = {}
    for name, count in wanted:
        r = by_name.get(name.strip().lower())
        if r is None:
            raise HTTPException(404, f"Unknown recipe '{name}'")
        for ing_id, amount, unit in r["lines"]:
            need[ing_id] = need.get(ing_id, 0) + (amount or 0) * count
    stock = on_hand(conn)
    short, plan = [], []
    for ing_id, amount in need.items():
        s = stock[ing_id]
        factor = stock_factor(s["row"])
        if not factor or amount <= 0:
            if amount > 0:
                short.append({"ingredient": s["row"]["name"], "reason": "stock unit can't be converted"})
            continue
        qty = amount / factor[0]  # in stock_unit
        if qty > s["stock"] + EPS:
            short.append({"ingredient": s["row"]["name"], "needed": round(amount, 2),
                          "on_hand": round(s["amount"], 2), "unit": factor[1]})
        plan.append((ing_id, qty))
    if short:
        raise HTTPException(409, {"detail": "Not enough stock", "short": short})
    today = date.today().isoformat()
    used = []
    for ing_id, qty in plan:
        left = qty
        batches = conn.execute(
            "SELECT id, quantity FROM inventory WHERE ingredient_id = ? AND (expires_on IS NULL OR expires_on >= ?) "
            "ORDER BY expires_on IS NULL, expires_on, id", (ing_id, today)).fetchall()
        for b in batches:
            if left <= EPS:
                break
            take = min(b["quantity"], left)
            if b["quantity"] - take <= EPS:
                conn.execute("DELETE FROM inventory WHERE id = ?", (b["id"],))
            else:
                conn.execute("UPDATE inventory SET quantity = ? WHERE id = ?", (b["quantity"] - take, b["id"]))
            left -= take
        used.append({"ingredient": stock[ing_id]["row"]["name"], "used": round(qty, 4),
                     "stock_unit": stock[ing_id]["row"]["stock_unit"]})
    return {"used": used}
