"""PROTOTYPE — throwaway. Checks whether github.com/Kiizon/flippscrape still scrapes Flipp.

Usage: python run_prototype.py [POSTAL_CODE]   (prompts if omitted)
Writes flyer_items_<POSTAL_CODE>.csv in this directory.
"""
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "flippscrape"))
import app  # noqa: E402

postal = (sys.argv[1] if len(sys.argv) > 1 else input("Postal code (A1A1A1): ")).replace(" ", "").upper()

# Show the raw state: every merchant Flipp returns, before the repo's grocery filter.
data = app.get_flyers_by_postal_code(postal)
flyers = data.get("flyers", [])
print(f"Flipp returned {len(flyers)} flyers for {postal}")
for merchant, n in Counter(f.get("merchant") for f in flyers).most_common():
    mark = "*" if merchant in app.GROCERY_STORES else " "
    print(f"  {mark} {merchant} ({n})")
print("  (* = in the repo's GROCERY_STORES filter)\n")

# Run the repo's own pipeline unchanged; it writes the CSV to the cwd.
sys.argv = sys.argv[:1]
app.input = lambda _prompt: postal
app.main()
