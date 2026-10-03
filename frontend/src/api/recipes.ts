import { http } from "./client";
import type { RecipeDto, RecipesResponseDto } from "./dto";
import { formatAmount, formatMoney, imageFor } from "./format";
import { fetchInventory, type Inventory } from "./inventory";
import { fetchQuotes } from "./prices";
import type { PriceQuote, RecipeView } from "../models";

/** Cost of `amount` of an ingredient from its best-priced package; null when the units can't be compared. */
function lineCost(amount: number | null, unit: string | null, quote: PriceQuote | undefined): number | null {
  if (!quote?.carried || quote.price === null || amount === null) return null;
  if (!quote.sizeQuantity || quote.sizeUnit !== unit) return null;
  return (quote.price / quote.sizeQuantity) * amount;
}

export function toRecipeView(dto: RecipeDto, quotes: Map<string, PriceQuote>, inventory: Inventory): RecipeView {
  let total = 0;
  let partial = false;
  const ingredients = dto.ingredients.map((line) => {
    const quote = quotes.get(line.ingredient.toLowerCase());
    const cost = lineCost(line.amount, line.unit, quote);
    if (cost === null) partial = true;
    else total += cost;
    return {
      name: line.ingredient,
      role: line.role,
      amountLabel: line.amount === null ? "—" : formatAmount(line.amount, line.unit),
      retailer: quote?.retailer ?? null,
      priceLabel: cost === null ? "Price unavailable" : `${formatMoney(cost)}${quote?.retailer ? ` · ${quote.retailer}` : ""}`,
    };
  });

  const { servings = null, limiting = null } = inventory.servings.get(dto.name) ?? {};
  const low = dto.ingredients.map((l) => inventory.stock.find((s) => s.name === l.ingredient)).filter((s) => s?.lowStock);
  let stockLabel = "Stock unknown";
  if (servings === 0) stockLabel = `Out of ${limiting ?? "stock"}`;
  else if (low.length) stockLabel = `Low: ${low[0]!.name}`;
  else if (servings !== null) stockLabel = `${servings} servings in stock`;

  return {
    name: dto.name,
    category: /weekly/i.test(dto.notes) ? "Weekly Special" : "Original",
    image: imageFor(dto.name),
    costEach: ingredients.length && total > 0 ? total : null,
    costEachLabel: total > 0 ? `${partial ? "≥ " : ""}${formatMoney(total)}` : "—",
    costPartial: partial,
    servings,
    stockLabel,
    stockOk: servings !== null && servings > 0 && low.length === 0,
    ingredients,
  };
}

/** Active parfaits with ingredient costs priced from the best retailer and servings from current stock. */
export async function loadRecipes(signal?: AbortSignal): Promise<RecipeView[]> {
  const [{ recipes }, inventory] = await Promise.all([
    http.get<RecipesResponseDto>("/recipes", { signal }),
    fetchInventory(signal),
  ]);
  const quotes = await fetchQuotes(recipes.flatMap((r) => r.ingredients.map((i) => i.ingredient)));
  return recipes.map((r) => toRecipeView(r, quotes, inventory));
}
