"""StatCan table 18-10-0245-01 (monthly average retail prices): Ontario, latest month."""
import csv
import io
import re
import urllib.request
import zipfile
from dataclasses import dataclass
from functools import lru_cache

from . import config


@dataclass(frozen=True)
class Product:
    name: str  # exact StatCan name, e.g. "Eggs, 1 dozen"
    price: float
    period: str  # e.g. "2026-07"

    @property
    def label(self) -> str:
        """Short suggested label: 'Eggs, 1 dozen' -> 'eggs'."""
        return re.sub(r"\s*\(.*?\)", "", self.name.split(",")[0]).strip().lower()

    @property
    def unit_text(self) -> str:
        """Pack size as StatCan states it: 'Eggs, 1 dozen' -> '1 dozen'."""
        return self.name.split(",", 1)[1].strip() if "," in self.name else self.name


def _download() -> None:
    config.STATCAN_CSV.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(config.STATCAN_ZIP_URL) as resp:
        zf = zipfile.ZipFile(io.BytesIO(resp.read()))
    config.STATCAN_CSV.write_bytes(zf.read(config.STATCAN_CSV_NAME_IN_ZIP))


@lru_cache(maxsize=1)
def load_products() -> dict[str, Product]:
    if not config.STATCAN_CSV.exists():
        _download()
    rows = []
    with open(config.STATCAN_CSV, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            if r["GEO"] == config.GEO and r["VALUE"]:
                rows.append(r)
    latest = max(r["REF_DATE"] for r in rows)
    return {
        r["Products"].strip(): Product(r["Products"].strip(), float(r["VALUE"]), latest)
        for r in rows
        if r["REF_DATE"] == latest
    }


def search(q: str, limit: int = 20) -> list[Product]:
    terms = q.lower().split()
    if not terms:
        return []
    hits = [p for p in load_products().values() if all(t in p.name.lower() for t in terms)]
    return sorted(hits, key=lambda p: p.name)[:limit]


def get(name: str) -> Product | None:
    return load_products().get(name.strip())
