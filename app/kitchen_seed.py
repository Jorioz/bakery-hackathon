"""Faux starting data for the kitchen tables (runs once, on an empty DB)."""
from datetime import date, timedelta

# Base amounts per parfait live in BASE_AMOUNTS; add-in amounts per recipe in SPECIALS.
# name: (role, unit_text, baseline, perishable, stock_unit, reorder_at)
INGREDIENTS = {
    "whipping cream":        ("base", "473 ml", 4.99, 1, "cartons", 4),
    "icing sugar":           ("base", "1 kg", 3.99, 0, "bags", 1),
    "vanilla extract":       ("base", "60 ml", 6.99, 0, "bottles", 1),
    "milk":                  ("addin", "2 l", 5.29, 1, "l", 4),
    "butter":                ("addin", "454 g", 6.49, 1, "blocks", 2),
    "brown sugar":           ("addin", "1 kg", 3.99, 0, "bags", 1),
    "cinnamon":              ("addin", "70 g", 3.49, 0, "jars", 1),
    "graham crackers":       ("addin", "400 g", 4.29, 0, "boxes", 1),
    "lemons":                ("addin", "1 each", 1.17, 1, "each", 6),
    "strawberry jam":        ("addin", "500 ml", 4.49, 0, "jars", 1),
    "white chocolate chips": ("addin", "300 g", 5.49, 0, "packs", 2),
    "chocolate chips":       ("addin", "300 g", 4.99, 0, "packs", 2),
    "instant espresso":      ("addin", "100 g", 7.99, 0, "jars", 1),
    "croissants":            ("addin", "6 each", 5.99, 1, "packs", 2),
    "blueberries":           ("addin", "170 g", 3.99, 1, "clamshells", 3),
    "strawberries":          ("addin", "454 g", 4.99, 1, "lb", 3),
    "matcha powder":         ("addin", "30 g", 9.99, 0, "tins", 1),
}

BASE_AMOUNTS = {'whipping cream': (100, 'ml'), 'icing sugar': (15, 'g'), 'vanilla extract': (2, 'ml')}

# (name, status, notes, {add-in: (amount per parfait, unit)}). Originals are always in rotation; the rest rotate weekly.
SPECIALS = [
    ("Latte Kitty", "active", "Original",
     {'instant espresso': (2, 'g'), 'milk': (30, 'ml'), 'brown sugar': (8, 'g'), 'cinnamon': (1, 'g'), 'chocolate chips': (10, 'g')}),
    ("Golden Croissant", "active", "Original",
     {'croissants': (0.5, 'each'), 'butter': (10, 'g'), 'brown sugar': (10, 'g'), 'cinnamon': (1, 'g')}),
    ("Blueberry Jelly", "active", "Original",
     {'blueberries': (60, 'g'), 'strawberry jam': (20, 'ml'), 'lemons': (0.1, 'each'), 'graham crackers': (15, 'g')}),
    ("Strawberry Cake", "active", "Weekly special",
     {'strawberries': (80, 'g'), 'strawberry jam': (20, 'ml'), 'graham crackers': (15, 'g'), 'lemons': (0.1, 'each'), 'white chocolate chips': (10, 'g')}),
    ("Matcha Blob", "active", "Weekly special",
     {'matcha powder': (3, 'g'), 'milk': (40, 'ml'), 'white chocolate chips': (15, 'g'), 'chocolate chips': (5, 'g'), 'graham crackers': (15, 'g')}),
]

# (ingredient, quantity, days until expiry or None)
INVENTORY = [
    ("whipping cream", 3, 6), ("whipping cream", 4, 12), ("icing sugar", 2, None),
    ("vanilla extract", 1, None), ("chocolate chips", 5, None), ("strawberries", 2, 1),
    ("blueberries", 1, -1), ("milk", 6, 5), ("brown sugar", 2, None),
]


def seed(conn) -> None:
    ids = {}
    for name, (role, unit, base, perish, stock_unit, reorder) in INGREDIENTS.items():
        amount, amount_unit = BASE_AMOUNTS.get(name, (None, None))
        ids[name] = conn.execute(
            "INSERT INTO ingredients (name, role, unit_text, baseline, perishable, stock_unit, reorder_at, base_amount, base_unit) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (name, role, unit, base, perish, stock_unit, reorder, amount, amount_unit)).lastrowid
    for name, status, notes, addins in SPECIALS:
        sid = conn.execute("INSERT INTO specials (name, status, notes) VALUES (?, ?, ?)", (name, status, notes)).lastrowid
        conn.executemany(
            "INSERT INTO special_ingredients (special_id, ingredient_id, amount, unit) VALUES (?, ?, ?, ?)",
            [(sid, ids[a], amount, unit) for a, (amount, unit) in addins.items()])
    today = date.today()
    conn.executemany(
        "INSERT INTO inventory (ingredient_id, quantity, expires_on) VALUES (?, ?, ?)",
        [(ids[n], q, (today + timedelta(days=d)).isoformat() if d is not None else None) for n, q, d in INVENTORY])
