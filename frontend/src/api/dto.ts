/** Raw response shapes, exactly as the FastAPI backend returns them. Components never see these. */

export interface PriceEntryDto {
  item: string;
  matched: string | null;
  retailer: string | null;
  price: number | null;
  size: { quantity: number | null; unit: string | null; raw: string } | null;
  unit_price: { value: number; per: string } | null;
  source: "flipp" | "mock" | "statcan" | "custom" | null;
  error: string | null;
}
export interface PricesResponseDto {
  currency: string;
  items: PriceEntryDto[];
}

export interface RecipeLineDto {
  ingredient: string;
  role: "base" | "addin";
  amount: number | null;
  unit: string | null;
  package: string;
}
export interface RecipeDto {
  name: string;
  status: string;
  notes: string;
  ingredients: RecipeLineDto[];
}
export interface RecipesResponseDto {
  recipes: RecipeDto[];
}

export interface InventoryIngredientDto {
  ingredient: string;
  role: "base" | "addin";
  on_hand: { amount: number; unit: string } | null;
  stock: number;
  stock_unit: string;
  low_stock: boolean;
  next_expiry: string | null;
  expired_batches: number;
}
export interface InventoryRecipeDto {
  name: string;
  status: string;
  servings: number | null;
  limiting_ingredient: string | null;
  unconverted: string[];
}
export interface InventoryResponseDto {
  ingredients: InventoryIngredientDto[];
  recipes: InventoryRecipeDto[];
}

export interface ScoutDealDto {
  merchant: string;
  listing: string;
  price: number;
  unit_text: string;
  baseline: number;
  discount_pct: number;
  on_sale: boolean;
}
export interface ScoutSpecialDto {
  id: number;
  name: string;
  status: string;
  notes: string;
  addins: string[];
  addins_on_sale: string[];
  score: number;
  deals: Record<string, ScoutDealDto | null>;
}
export interface ScoutResponseDto {
  source: string;
  listings_matched: number;
  ingredients: Record<string, ScoutDealDto | null>;
  specials: ScoutSpecialDto[];
}
