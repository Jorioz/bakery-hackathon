"""Public inventory: on-hand stock in recipe units, how many parfaits it covers, and deduction on use."""
from fastapi import APIRouter
from pydantic import BaseModel, Field

from .. import db, inventory

router = APIRouter(prefix="/inventory", tags=["inventory"])


class Made(BaseModel):
    recipe: str
    count: int = Field(gt=0)


class UseBody(BaseModel):
    parfaits: list[Made] = Field(min_length=1)


@router.get("")
def get_inventory():
    """`on_hand` counts unexpired batches, in g/ml/each (null if the stock unit can't be converted)."""
    with db.connect() as conn:
        stock = inventory.on_hand(conn)
        recipes = inventory.recipes(conn)
        ingredients = [{
            "ingredient": s["row"]["name"], "role": s["row"]["role"],
            "on_hand": {"amount": round(s["amount"], 2), "unit": s["unit"]} if s["amount"] is not None else None,
            "stock": s["stock"], "stock_unit": s["row"]["stock_unit"],
            "low_stock": s["stock"] < s["row"]["reorder_at"],
            "next_expiry": s["next_expiry"], "expired_batches": s["expired_batches"],
        } for s in stock.values()]
        covered = [{"name": r["name"], "status": r["status"], **inventory.servings(r, stock)} for r in recipes]
    return {"ingredients": ingredients, "recipes": covered}


@router.post("/use")
def use_inventory(body: UseBody):
    """Deduct the ingredients for N parfaits per recipe (soonest expiry first). 409 with the shortages if stock is short."""
    with db.connect() as conn:
        return inventory.use(conn, [(m.recipe, m.count) for m in body.parfaits])
