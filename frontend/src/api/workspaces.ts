/** Builds the generic workspace pages (Inventory, Suppliers, Flavor Lab) from real endpoint data. */
import { expiryLabel, formatMoney, imageFor, titleCase } from "./format";
import { expiringSoon, fetchInventory } from "./inventory";
import { fetchQuotes } from "./prices";
import { fetchScout } from "./specials";
import type { PriceQuote, StockItem, Tone, WorkspaceView } from "../models";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

async function loadStockWithPrices() {
  const { stock } = await fetchInventory();
  const quotes = await fetchQuotes(stock.map((s) => s.name));
  return { stock, quotes };
}

function expiryStatus(s: StockItem): { status: string; tone: Tone } {
  if (s.expiredBatches > 0) return { status: "Expired batch", tone: "bad" };
  if (s.daysToExpiry === null) return { status: "No expiry", tone: "info" };
  const tone: Tone = s.daysToExpiry <= 1 ? "bad" : s.daysToExpiry <= 3 ? "warn" : "good";
  return { status: expiryLabel(s.nextExpiry), tone };
}

export async function inventoryWorkspace(): Promise<WorkspaceView> {
  const { stock, quotes } = await loadStockWithPrices();
  const low = stock.filter((s) => s.lowStock);
  const expiring = expiringSoon(stock, 3);
  const expiredBatches = stock.reduce((n, s) => n + s.expiredBatches, 0);

  const rows = stock.map((s) => {
    const { status, tone } = expiryStatus(s);
    const needsAttention = expiring.includes(s);
    return {
      name: titleCase(s.name),
      detail: `${s.stockLabel} in stock${s.lowStock ? " · below reorder level" : ""}`,
      cells: [s.role === "base" ? "Base" : "Add-in", s.onHandLabel, quotes.get(s.name)?.unitPriceLabel ?? "—"],
      status,
      tone,
      action: s.lowStock ? "Reorder" : needsAttention ? "Use first" : "View",
      tabs: ["All Ingredients", ...(needsAttention ? ["Use First"] : []), ...(s.lowStock ? ["Low Stock"] : [])],
    };
  });

  return {
    title: "Inventory & Expiry",
    intro: "Know what is in stock, what is running low, and what should be used first.",
    primaryAction: "Add inventory",
    pills: [plural(stock.length, "ingredient"), `${expiring.length} near expiry`, `${low.length} low-stock`],
    metrics: [
      { label: "Ingredients tracked", value: String(stock.length), detail: "Base and add-ins" },
      { label: "Near expiry", value: String(expiring.length), detail: "Within 3 days or already expired", tone: expiring.length ? "danger-text" : undefined },
      { label: "Low stock", value: String(low.length), detail: "Below reorder level", tone: low.length ? "danger-text" : undefined },
      { label: "Expired batches", value: String(expiredBatches), detail: "Excluded from on-hand totals" },
    ],
    notice: low.length
      ? `Reorder soon: ${low.map((s) => s.name).join(", ")}.`
      : "Nothing is below its reorder level.",
    tabs: ["All Ingredients", "Use First", "Low Stock"],
    tableTitle: "Ingredient stock",
    columns: ["Ingredient", "Type", "On hand", "Best unit price", "Next expiry", "Action"],
    rows,
    sideTitle: "Needs attention",
    sideIntro: "Low stock and ingredients to use first.",
    sideItems: [
      ...low.map((s) => ({ title: titleCase(s.name), detail: `${s.stockLabel} left`, badge: "Reorder" })),
      ...expiring.map((s) => ({ title: titleCase(s.name), detail: `Next batch: ${expiryLabel(s.nextExpiry)}`, badge: "Use first" })),
    ].slice(0, 6),
  };
}

export async function suppliersWorkspace(): Promise<WorkspaceView> {
  const { stock, quotes } = await loadStockWithPrices();
  const priced = stock.map((s) => ({ s, q: quotes.get(s.name) as PriceQuote | undefined }));
  const carried = priced.filter((p) => p.q?.carried);
  const flyer = carried.filter((p) => p.q!.isFlyerDeal);

  const byRetailer = new Map<string, number>();
  for (const { q } of carried) byRetailer.set(q!.retailer!, (byRetailer.get(q!.retailer!) ?? 0) + 1);
  const retailers = [...byRetailer.entries()].sort((a, b) => b[1] - a[1]);

  const rows = priced.map(({ s, q }) => ({
    name: titleCase(s.name),
    detail: q?.sizeLabel ? `Best package: ${q.sizeLabel}` : "No matching package",
    cells: [q?.retailer ?? "—", q?.price != null ? formatMoney(q.price) : "—", q?.unitPriceLabel ?? "—"],
    status: !q?.carried ? "Not carried" : q.isFlyerDeal ? "Flyer deal" : "Estimated",
    tone: (!q?.carried ? "bad" : q.isFlyerDeal ? "warn" : "info") as Tone,
    action: "Add to order",
    tabs: ["Compare Prices", ...(q?.isFlyerDeal ? ["Deals"] : []), "Supplier List"],
  }));

  return {
    title: "Suppliers & Ingredient Costs",
    intro: "The best-priced retailer for every ingredient, ranked by price per unit.",
    primaryAction: "Create purchase order",
    pills: [plural(retailers.length, "retailer"), plural(flyer.length, "flyer deal"), `${priced.length - carried.length} not carried`],
    metrics: [
      { label: "Ingredients priced", value: `${carried.length}/${priced.length}`, detail: "Found at a retailer" },
      { label: "Flyer deals", value: String(flyer.length), detail: "Live prices from this week's flyers" },
      { label: "Top retailer", value: retailers[0]?.[0] ?? "—", detail: retailers[0] ? `Cheapest for ${plural(retailers[0][1], "ingredient")}` : "No prices yet" },
      { label: "Not carried", value: String(priced.length - carried.length), detail: "No retailer has it", tone: priced.length - carried.length ? "danger-text" : undefined },
    ],
    notice: flyer.length
      ? `${plural(flyer.length, "ingredient")} ${flyer.length === 1 ? "has" : "have"} a live flyer price. The rest use simulated retailer prices.`
      : "No live flyer prices matched. All prices are simulated from the StatCan baseline.",
    tabs: ["Compare Prices", "Deals", "Supplier List"],
    tableTitle: "Ingredient price comparison",
    columns: ["Ingredient", "Retailer", "Price", "Unit price", "Source", "Action"],
    rows,
    sideTitle: "Retailers",
    sideIntro: "How many ingredients each retailer wins.",
    sideItems: retailers.map(([name, n]) => ({ title: name, detail: `Best price on ${plural(n, "ingredient")}`, badge: String(n) })),
  };
}

export async function flavorLabWorkspace(): Promise<WorkspaceView> {
  const scout = await fetchScout();
  const sale = scout.specials.filter((s) => s.addinsOnSale.length > 0);
  const best = scout.specials.find((s) => s.bestDeal);
  const onSaleDeals = scout.deals.filter((d) => d.onSale);

  const rows = scout.specials.map((s) => ({
    name: s.name,
    detail: s.addins.map(titleCase).join(" · "),
    cells: [
      s.bestDeal ? `${titleCase(s.bestDeal.ingredient)} @ ${s.bestDeal.merchant}` : "—",
      s.bestDeal ? s.bestDeal.priceLabel : "—",
      s.bestDeal ? `${Math.round(s.bestDeal.discountPct)}% off` : "—",
    ],
    status: `${s.addinsOnSale.length} of ${s.addins.length} on sale`,
    tone: (s.addinsOnSale.length ? "good" : "info") as Tone,
    action: "Build",
    tabs: ["Ranked Specials", ...(s.addinsOnSale.length ? ["On Sale"] : [])],
  }));

  return {
    title: "Flavor Lab",
    intro: "Weekly specials ranked by how many of their add-ins are on sale in this week's flyers.",
    primaryAction: "Create a new flavor",
    pills: [plural(scout.specials.length, "special"), `${sale.length} with add-ins on sale`, `${scout.listingsMatched} flyer matches`],
    metrics: [
      { label: "Specials with deals", value: String(sale.length), detail: `Of ${scout.specials.length} active` },
      { label: "Best discount", value: onSaleDeals[0] ? `${Math.round(onSaleDeals[0].discountPct)}%` : "—", detail: onSaleDeals[0] ? `${titleCase(onSaleDeals[0].ingredient)} at ${onSaleDeals[0].merchant}` : "Nothing on sale" },
      { label: "Add-ins on sale", value: String(onSaleDeals.length), detail: `Of ${scout.deals.length} with a flyer match` },
      { label: "Flyer source", value: titleCase(scout.source), detail: `${scout.listingsMatched} listings matched` },
    ],
    notice: best?.bestDeal
      ? `Best opportunity: ${best.name} — ${best.bestDeal.ingredient} is ${Math.round(best.bestDeal.discountPct)}% below baseline at ${best.bestDeal.merchant}.`
      : "No add-ins are on sale this week.",
    tabs: ["Ranked Specials", "On Sale"],
    tableTitle: "Weekly special candidates",
    columns: ["Flavor", "Best deal", "Flyer price", "Discount", "Add-ins on sale", "Action"],
    rows,
    sideTitle: "Top flyer deals",
    sideIntro: "Add-ins with the biggest discount versus baseline.",
    sideItems: onSaleDeals.slice(0, 6).map((d) => ({
      title: titleCase(d.ingredient),
      detail: `${d.merchant} · ${d.priceLabel} (${d.sizeLabel})`,
      badge: `${Math.round(d.discountPct)}% off`,
      image: imageFor(d.ingredient),
    })),
  };
}
