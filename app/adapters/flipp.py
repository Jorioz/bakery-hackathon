"""Live weekly flyer deals from Flipp (same endpoints the flippscrape prototype proved out)."""
import json
import random
import urllib.request

from .. import config
from .base import RawListing


def _get(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def _sid() -> str:
    return "".join(random.choices("0123456789", k=16))


class FlippAdapter:
    source = "flipp"

    def __init__(self, postal_code: str = config.FLIPP_POSTAL_CODE):
        self.postal_code = postal_code.replace(" ", "").upper()

    def fetch(self, tracked_labels: list[str]) -> list[RawListing]:
        flyers = _get(config.FLIPP_FLYERS_URL.format(self.postal_code, _sid())).get("flyers", [])
        merchants = set(config.MERCHANT_MULTIPLIERS)
        listings = []
        for f in flyers:
            cats = f.get("categories") or []
            if isinstance(cats, str):
                cats = [c.strip() for c in cats.split(",")]
            if f.get("merchant") not in merchants or "Groceries" not in cats:
                continue
            for item in _get(config.FLIPP_ITEMS_URL.format(f["id"], _sid())):
                try:
                    price = float(item.get("price") or 0)
                except (TypeError, ValueError):
                    continue
                if price > 0 and item.get("name"):
                    period = (item.get("valid_from") or "")[:7]
                    listings.append(RawListing(f["merchant"], item["name"], price, period))
        return listings
