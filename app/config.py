from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "prices.db"
STATCAN_CSV = DATA_DIR / "cache" / "statcan_18100245.csv"
STATCAN_ZIP_URL = "https://www150.statcan.gc.ca/n1/tbl/csv/18100245-eng.zip"
STATCAN_CSV_NAME_IN_ZIP = "18100245.csv"

# StatCan has no Kitchener/Waterloo row; Ontario is the closest geography.
GEO = "Ontario"
STATCAN_MERCHANT = "StatCan Average"
CUSTOM_MERCHANT = "Custom Average"  # baseline row for manually entered items

# Merchants come from the unique `merchant` values in prototype-flippscrape/*.csv.
# Value is the price multiplier applied to the StatCan baseline (faux data).
MERCHANT_MULTIPLIERS = {
    "Walmart": 0.95,
    "Loblaws": 1.08,
    "No Frills": 0.92,
    "FreshCo": 0.98,
}
NOISE = 0.05  # per-item +/- fraction, seeded so results are reproducible

# Flipp flyers (primary source). Postal code in Kitchener/Waterloo; override per refresh.
FLIPP_POSTAL_CODE = "N2L3G1"
FLIPP_FLYERS_URL = "https://flyers-ng.flippback.com/api/flipp/data?locale=en&postal_code={}&sid={}"
FLIPP_ITEMS_URL = "https://flyers-ng.flippback.com/api/flipp/flyers/{}/flyer_items?locale=en&sid={}"
# Flyer names containing any of these are never matched to a tracked item (keeps "eggs" off dog treats).
FLIPP_EXCLUDE_WORDS = {"dog", "cat", "pet", "chocolate", "candy", "bar", "bars", "cereal", "ice", "eggplant", "chips", "cheese", "brie", "sour", "soup", "corn", "serum", "lotion", "shampoo"}
