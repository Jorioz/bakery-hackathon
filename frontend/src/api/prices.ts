import { http } from "./client";
import type { PriceEntryDto, PricesResponseDto } from "./dto";
import { formatMoney } from "./format";
import type { PriceQuote } from "../models";

export function toQuote(dto: PriceEntryDto): PriceQuote {
  const carried = dto.price !== null && dto.retailer !== null;
  return {
    item: dto.item,
    matched: dto.matched,
    carried,
    retailer: dto.retailer,
    price: dto.price,
    sizeLabel: dto.size?.raw ?? null,
    sizeQuantity: dto.size?.quantity ?? null,
    sizeUnit: dto.size?.unit ?? null,
    unitPriceLabel: dto.unit_price ? `${formatMoney(dto.unit_price.value)} / ${dto.unit_price.per}` : null,
    isFlyerDeal: dto.source === "flipp",
  };
}

// Prices only change on a backend refresh, and several screens ask for the same ingredients.
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; quotes: Promise<Map<string, PriceQuote>> }>();

export function clearPriceCache(): void {
  cache.clear();
}

/** Best-priced retailer per item, keyed by lower-cased item name. Unknown items come back with `carried: false`. */
export function fetchQuotes(items: readonly string[]): Promise<Map<string, PriceQuote>> {
  const names = [...new Set(items.map((i) => i.trim().toLowerCase()).filter(Boolean))].sort();
  if (names.length === 0) return Promise.resolve(new Map());
  const key = names.join(",");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.quotes;

  const quotes = http
    .get<PricesResponseDto>("/prices", { params: { items: names } })
    .then((res) => new Map(res.items.map((dto) => [dto.item.toLowerCase(), toQuote(dto)] as const)));
  cache.set(key, { at: Date.now(), quotes });
  quotes.catch(() => cache.delete(key)); // don't cache failures
  return quotes;
}
