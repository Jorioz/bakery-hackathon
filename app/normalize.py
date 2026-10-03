"""Turn raw adapter listings into rows matched to tracked items, ready for the prices table."""
import re
from dataclasses import dataclass

from . import config
from .adapters import RawListing

_SIZE = re.compile(r"(\d+(?:\.\d+)?\s*(?:-\s*\d+(?:\.\d+)?\s*)?(?:kg|g|ml|l|lb|oz|'s|pk|un)\b)", re.I)


@dataclass(frozen=True)
class PriceRow:
    item_id: int
    item: str  # tracked label
    merchant: str
    price: float
    unit_text: str
    period: str


def _words(text: str) -> set[str]:
    words = set(re.findall(r"[a-z]+", text.lower()))
    return words | {w[:-1] for w in words if w.endswith("s")}  # "eggs" matches "egg"


def matches(label: str, name: str) -> bool:
    """Every word of the label appears in the listing name, and nothing on the exclude list does."""
    name_words = _words(name)
    return _words(label) <= name_words and not (name_words & config.FLIPP_EXCLUDE_WORDS - _words(label))


def unit_text(name: str, default: str) -> str:
    m = _SIZE.search(name)
    return m.group(1).strip() if m else default


def normalize(listings: list[RawListing], items: list[dict]) -> list[PriceRow]:
    """items: tracked_items rows (id, label, unit_text). One listing may match several items."""
    rows = []
    for it in items:
        for l in listings:
            if matches(it["label"], l.name):
                rows.append(PriceRow(it["id"], it["label"], l.merchant, round(l.price, 2),
                                     unit_text(l.name, l.name), l.period))
    return rows


# Size text -> (quantity, base unit). Base units: g, ml, each.
_UNITS = {
    "g": (1, "g"), "gram": (1, "g"), "kg": (1000, "g"), "kilogram": (1000, "g"),
    "lb": (453.6, "g"), "pound": (453.6, "g"), "oz": (28.35, "g"),
    "ml": (1, "ml"), "millilitre": (1, "ml"), "l": (1000, "ml"), "litre": (1000, "ml"),
    "dozen": (12, "each"), "'s": (1, "each"), "pk": (1, "each"), "un": (1, "each"), "each": (1, "each"),
}
_PARSE = re.compile(r"(\d+(?:\.\d+)?)\s*(?:-\s*\d+(?:\.\d+)?\s*)?([a-z']+)", re.I)
# How unit price is displayed per base unit.
DISPLAY_PER = {"g": (100, "100 g"), "ml": (1000, "L"), "each": (12, "dozen")}


def parse_size(text: str) -> tuple[float, str] | None:
    """'4 litres' -> (4000, 'ml'); '225-336 g' -> (225, 'g') (low end of a range); None if unparseable."""
    m = _PARSE.search(text or "")
    if not m:
        return None
    unit = m.group(2).lower()
    factor = _UNITS.get(unit) or _UNITS.get(unit.rstrip("s"))
    return (float(m.group(1)) * factor[0], factor[1]) if factor else None


def unit_price(price: float, unit_text: str) -> dict | None:
    """Price per display unit, e.g. {'value': 0.89, 'per': '100 g'}."""
    size = parse_size(unit_text)
    if not size or size[0] <= 0:
        return None
    qty, base = size
    mult, label = DISPLAY_PER[base]
    return {"value": round(price / qty * mult, 2), "per": label}
