from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class RawListing:
    merchant: str
    name: str  # as the source wrote it, e.g. "BURNBRAE LARGE WHITE EGGS, 12'S"
    price: float
    period: str  # YYYY-MM the price applies to


class Adapter(Protocol):
    source: str  # stored in prices.source

    def fetch(self, tracked_labels: list[str]) -> list[RawListing]: ...
