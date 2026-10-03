"""Weekly specials: faux Parfait variants (base recipe + add-ins) and scouting flyers for their add-ins."""
from . import db
from .adapters import Adapter
from .normalize import matches, parse_size, unit_text

def _load() -> tuple[dict, list]:
    """Add-in ingredients (name -> row) and non-retired specials with their add-in names, from SQLite."""
    with db.connect() as conn:
        ingredients = {r["name"]: dict(r) for r in conn.execute("SELECT * FROM ingredients WHERE role = 'addin'")}
        specials = [dict(r) for r in conn.execute("SELECT * FROM specials WHERE status != 'retired' ORDER BY name")]
        for s in specials:
            s["addins"] = [r["name"] for r in conn.execute(
                "SELECT i.name FROM special_ingredients si JOIN ingredients i ON i.id = si.ingredient_id "
                "WHERE si.special_id = ? ORDER BY i.name", (s["id"],))]
    return ingredients, specials


def catalogue() -> dict:
    """The specials and the de-duplicated add-in list to scout."""
    ingredients, specials = _load()
    return {"specials": specials, "ingredients": list(ingredients.values())}


def _ratio(price: float, size_text: str, info: dict) -> float:
    """Flyer price relative to the baseline (0.8 = 20% off): per unit when sizes are comparable, else sticker."""
    size, base = parse_size(size_text), parse_size(info["unit_text"])
    if size and base and size[1] == base[1] and size[0] > 0:
        return (price / size[0]) / (info["baseline"] / base[0])
    return price / info["baseline"]


def _size_after_label(label: str, name: str) -> str:
    # Combo listings ("FLOUR, 2.5 KG OR CHOCOLATE CHIPS, 205 G"): take the size following the label.
    i = name.lower().find(label.split()[-1].rstrip("s"))
    return unit_text(name[i:] if i >= 0 else name, unit_text(name, name))


def scout(adapter: Adapter) -> dict:
    """Fetch listings for every add-in, keep the best per ingredient, and rank specials by their deals."""
    ingredients, specials = _load()
    listings = adapter.fetch(list(ingredients))
    deals, matched = {}, 0
    for label, info in ingredients.items():
        best, best_ratio = None, None
        for l in listings:
            if not matches(label, l.name):
                continue
            matched += 1
            size = _size_after_label(label, l.name)
            ratio = _ratio(l.price, size, info)
            if best is None or ratio < best_ratio:
                best, best_ratio = (l, size), ratio
        deals[label] = None if best is None else {
            "merchant": best[0].merchant,
            "listing": best[0].name,
            "price": best[0].price,
            "unit_text": best[1],
            "baseline": info["baseline"],
            "discount_pct": round((1 - best_ratio) * 100, 1),
            "on_sale": best_ratio < 1,
        }

    ranked = []
    for s in specials:
        found = {a: deals.get(a) for a in s["addins"]}
        on_sale = [a for a, d in found.items() if d and d["on_sale"]]
        ranked.append({
            **s,
            "addins_on_sale": on_sale,
            "score": round(sum(found[a]["discount_pct"] for a in on_sale), 1),
            "deals": found,
        })
    ranked.sort(key=lambda s: (-len(s["addins_on_sale"]), -s["score"]))
    return {"source": adapter.source, "listings_matched": matched, "ingredients": deals, "specials": ranked}
