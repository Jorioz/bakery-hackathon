import { http } from "./client";
import type { ScoutDealDto, ScoutResponseDto } from "./dto";
import { formatMoney, imageFor } from "./format";
import type { DealView, ScoutView } from "../models";

function toDeal(ingredient: string, dto: ScoutDealDto): DealView {
  return {
    ingredient,
    merchant: dto.merchant,
    listing: dto.listing,
    priceLabel: formatMoney(dto.price),
    sizeLabel: dto.unit_text,
    discountPct: dto.discount_pct,
    onSale: dto.on_sale,
  };
}

export function toScoutView(res: ScoutResponseDto): ScoutView {
  const deals = Object.entries(res.ingredients)
    .flatMap(([name, dto]) => (dto ? [toDeal(name, dto)] : []))
    .sort((a, b) => b.discountPct - a.discountPct);

  return {
    source: res.source,
    listingsMatched: res.listings_matched,
    deals,
    specials: res.specials.map((s) => {
      const onSale = s.addins_on_sale.flatMap((a) => (s.deals[a] ? [toDeal(a, s.deals[a]!)] : []));
      return {
        name: s.name,
        image: imageFor(s.name),
        addins: s.addins,
        addinsOnSale: s.addins_on_sale,
        bestDeal: onSale.sort((a, b) => b.discountPct - a.discountPct)[0] ?? null,
        score: s.score,
      };
    }),
  };
}

let scout: { postal: string; at: number; view: Promise<ScoutView> } | null = null;

/** Live Flipp scout (slow: fetches real flyers), so share one in-flight/recent result between screens. */
export function fetchScout(postalCode?: string, force = false): Promise<ScoutView> {
  const postal = postalCode ?? "";
  if (!force && scout && scout.postal === postal && Date.now() - scout.at < 5 * 60_000) return scout.view;
  const view = http
    .get<ScoutResponseDto>("/specials/scout", { params: { postal_code: postalCode } })
    .then(toScoutView);
  scout = { postal, at: Date.now(), view };
  view.catch(() => {
    if (scout?.view === view) scout = null;
  });
  return view;
}
