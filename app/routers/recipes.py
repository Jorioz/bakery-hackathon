"""Recipes: each parfait's ingredients and amounts. Frontend pairs this with /prices to cost them."""
from fastapi import APIRouter

from .. import db

router = APIRouter(prefix="/recipes", tags=["recipes"])


@router.get("")
def list_recipes():
    """Non-retired parfaits, each with base + add-in lines (`ingredient` is a /prices query term).

    `amount` is per single parfait in `unit` (g, ml, each); `package` is the size the price refers to.
    """
    with db.connect() as conn:
        base = [
            {"ingredient": r["name"], "role": "base", "amount": r["base_amount"], "unit": r["base_unit"],
             "package": r["unit_text"]}
            for r in conn.execute("SELECT * FROM ingredients WHERE role = 'base' ORDER BY id")]
        recipes = []
        for s in conn.execute("SELECT * FROM specials WHERE status != 'retired' ORDER BY id").fetchall():
            addins = [
                {"ingredient": r["name"], "role": "addin", "amount": r["amount"], "unit": r["unit"],
                 "package": r["unit_text"]}
                for r in conn.execute(
                    "SELECT i.name, i.unit_text, si.amount, si.unit FROM special_ingredients si "
                    "JOIN ingredients i ON i.id = si.ingredient_id WHERE si.special_id = ? ORDER BY i.name",
                    (s["id"],))]
            recipes.append({"name": s["name"], "status": s["status"], "notes": s["notes"],
                            "ingredients": base + addins})
    return {"recipes": recipes}
