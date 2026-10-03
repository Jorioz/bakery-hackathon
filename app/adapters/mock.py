"""Faux merchant listings derived from each tracked item's baseline price."""
from .. import config, db, mock
from .base import RawListing


class MockAdapter:
    source = "mock"

    def fetch(self, tracked_labels: list[str]) -> list[RawListing]:
        with db.connect() as conn:
            rows = conn.execute(
                "SELECT t.label, t.product_name, p.price, p.period FROM tracked_items t "
                "JOIN prices p ON p.item_id = t.id AND p.source IN ('statcan', 'custom')"
            ).fetchall()
        return [
            RawListing(m, r["label"], price, r["period"])
            for r in rows
            if r["label"] in tracked_labels
            for m, price in mock.mock_prices(r["product_name"], r["price"]).items()
        ]
