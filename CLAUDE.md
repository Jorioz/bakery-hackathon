# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Stack: Python + FastAPI, with SQLite for storage. Implemented: the admin dashboard (tracked items, StatCan/custom baselines, simulated merchant prices), source adapters (`flipp`, `mock`), normalization, and the public `GET /prices?items=eggs,sugar` endpoint. No tests yet.

### Commands

```
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # setup
.venv/bin/uvicorn app.main:app --reload                              # run; admin UI at http://127.0.0.1:8000/admin
```

### Layout

- `app/config.py` — paths, geography (Ontario), simulated merchants + price multipliers (merchants = unique ones in the Flipp CSVs: Walmart, Loblaws, No Frills, FreshCo).
- `app/statcan.py` — loads `data/cache/statcan_18100245.csv` (auto-downloads if missing), Ontario latest month only.
- `app/mock.py` — seeded faux merchant prices derived from the StatCan baseline.
- `app/db.py` — SQLite schema (`tracked_items`, `prices`) at `data/prices.db`.
- `app/adapters/` — `RawListing` + `Adapter` protocol; `FlippAdapter` (live flyers via urllib, postal code in config) and `MockAdapter`.
- `app/normalize.py` — matches listing names to tracked labels (all label words present, `FLIPP_EXCLUDE_WORDS` filtered), extracts size text.
- `app/pipeline.py` — `refresh(adapter)`: fetch → normalize → replace that source's rows in `prices`. Triggered by `POST /admin/api/refresh/{flipp|mock}?postal_code=`.
- `app/routers/prices.py` — `/prices`: resolves each query to a tracked label (exact, then substring), ranks rows by unit price (`normalize.parse_size` turns `unit_text` into g/ml/each; unparseable sizes rank last by sticker price) and returns the best `flipp` row, else the best `mock` row, else a not-carried entry with the same keys set to null.
- `app/routers/admin.py` — CRUD at `/admin/api/*`; `app/static/admin/` — the dashboard (HTML/JS/CSS).
- Adding an item stores the baseline price (`merchant='StatCan Average'`, `source='statcan'`) and four `source='mock'` rows; removing deletes them all. Custom items (`POST /admin/api/items/custom`: label, unit text, average price) override StatCan for products it lacks, using `merchant='Custom Average'`, `source='custom'` as the baseline. There is no refresh by design.

## Context

This is a hackathon project, not intended for production. Favor speed and simplicity over production hardening.

The user is a bakery owner who buys all their ingredients from one merchant and doesn't compare prices. This service finds them the best-priced merchant for each product.

`prototype-flippscrape/` is a throwaway prototype. It only existed to confirm that the scraping code in that repo still works against Flipp, and it does. Don't build on it or treat it as part of the service.

## Weekly specials

Beyond finding the best-priced ingredients for the bakery's Parfaits, the owner wants to run weekly specials, similar to Crumbl Cookies' rotating weekly flavors. The approach:

- Start from the existing inventory and the original Parfait recipe (the base stays the same).
- Look for products on special (primarily in the Flipp data) that can be appended to the original recipe as a limited-time variant.
- Example: Oreos are on special at No Frills, so the special is an Oreo Parfait (base recipe plus crushed Oreos), sourced from No Frills.

Implemented in `app/specials.py` and `app/routers/specials.py`:

- Specials and ingredients live in SQLite (`ingredients`, `specials`, `special_ingredients`, `inventory`), seeded once with faux data from `app/kitchen_seed.py` when `ingredients` is empty. Ingredient names are also the flyer search terms (all words must be present, so keep them specific, e.g. `shredded coconut`, not `coconut`). `role` is `base` (original Parfait) or `addin`; only add-ins are scouted, and `retired` specials are skipped.
- `inventory` has one row per received batch with an optional expiry. On hand = unexpired batches; an ingredient is low when on hand < `reorder_at` (in its `stock_unit`).
- Admin CRUD at `/admin/api/kitchen/{ingredients,specials,inventory}` (`app/routers/kitchen.py`); UI at `/admin/kitchen.html`, which flags low stock, expired batches, and batches expiring within 3 days.
- `GET /specials` returns the specials and the de-duplicated add-in list.
- `GET /specials/scout?postal_code=` fetches live Flipp flyers and keeps the best listing per add-in. It gives each a discount against the baseline (unit price when sizes share a base unit, otherwise sticker price), then ranks specials by how many add-ins are on sale. The results are not stored in SQLite.

## Data sources

- **Flipp scraped data** is the primary source for current deals, such as eggs.
- **StatCan monthly average retail prices** are the fallback for items that don't appear in the Flipp data.
- **Merchant data is simulated.** The baseline is mock data that we create ourselves. To save time, we don't scrape each merchant's prices. Instead, we take the StatCan average for each item and apply random noise per merchant, then store the result as the baseline. If an item such as eggs isn't in any Flipp flyer, the response falls back to this baseline price.

## Purpose

A microservice API that takes a list of grocery items (e.g. `eggs,sugar,milk`) and returns JSON indicating the best-priced retailer for each item (e.g. Walmart, Sobeys). The caller can be a frontend or another service.

Illustrative request/response shape (not yet implemented — revise once the real contract exists):

```
GET /prices?items=eggs,sugar,milk
```
```json
{
  "items": [
    { "item": "eggs",  "retailer": "Walmart", "price": 3.97 },
    { "item": "sugar", "retailer": "Sobeys",  "price": 2.49 },
    { "item": "milk",  "retailer": "Walmart", "price": 5.29 }
  ]
}
```

## Intended architecture

Data flows through this pipeline:

1. **FastAPI layer** — parses the item list, validates input, returns JSON.
2. **Source adapters** — a common interface with interchangeable implementations: a mock adapter (static/fake price data for development and tests) and real adapters that call an external scraper or service. The rest of the pipeline must not care which one is active.
3. **Normalization** — converts raw adapter output into one shared schema (item name, retailer, price, unit/size, etc.) so data from different sources is comparable.
4. **SQLite storage** — normalized price data is persisted to SQLite tables.
5. **Query/response** — the best-priced retailer per requested item is read from SQLite and returned as JSON. Must handle items no retailer carries.

Keep these layers separate so new adapters can be added without touching the API, normalization, or storage code.
