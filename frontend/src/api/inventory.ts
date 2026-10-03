import { http } from "./client";
import type { InventoryIngredientDto, InventoryResponseDto } from "./dto";
import { daysUntil, formatAmount } from "./format";
import type { StockItem } from "../models";

export function toStockItem(dto: InventoryIngredientDto): StockItem {
  return {
    name: dto.ingredient,
    role: dto.role,
    onHandLabel: dto.on_hand ? formatAmount(dto.on_hand.amount, dto.on_hand.unit) : "Unknown",
    stockLabel: formatAmount(dto.stock, dto.stock_unit),
    lowStock: dto.low_stock,
    nextExpiry: dto.next_expiry,
    daysToExpiry: dto.next_expiry ? daysUntil(dto.next_expiry) : null,
    expiredBatches: dto.expired_batches,
  };
}

export interface Inventory {
  stock: StockItem[];
  /** Parfaits the unexpired stock covers, by recipe name. */
  servings: Map<string, { servings: number | null; limiting: string | null }>;
}

export async function fetchInventory(signal?: AbortSignal): Promise<Inventory> {
  const res = await http.get<InventoryResponseDto>("/inventory", { signal });
  return {
    stock: res.ingredients.map(toStockItem),
    servings: new Map(res.recipes.map((r) => [r.name, { servings: r.servings, limiting: r.limiting_ingredient }])),
  };
}

/** Ingredients that need attention soon: expired batches, or the next batch runs out within `withinDays`. */
export function expiringSoon(stock: StockItem[], withinDays = 7): StockItem[] {
  return stock
    .filter((s) => s.expiredBatches > 0 || (s.daysToExpiry !== null && s.daysToExpiry <= withinDays))
    .sort((a, b) => (a.daysToExpiry ?? -1) - (b.daysToExpiry ?? -1));
}
