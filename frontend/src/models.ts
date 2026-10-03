/** Presentation models: what components render. Built from the raw DTOs by the modules in ./api. */

export type Tone = "good" | "warn" | "bad" | "info";

export interface PriceQuote {
  item: string;
  matched: string | null;
  carried: boolean;
  retailer: string | null;
  price: number | null;
  sizeLabel: string | null;
  sizeQuantity: number | null;
  sizeUnit: string | null;
  unitPriceLabel: string | null;
  /** Live flyer price (vs. the simulated baseline). */
  isFlyerDeal: boolean;
}

export interface StockItem {
  name: string;
  role: "base" | "addin";
  onHandLabel: string;
  stockLabel: string;
  lowStock: boolean;
  nextExpiry: string | null;
  /** Days until the soonest unexpired batch runs out; null when nothing expires. */
  daysToExpiry: number | null;
  expiredBatches: number;
}

export interface RecipeIngredientView {
  name: string;
  role: "base" | "addin";
  amountLabel: string;
  retailer: string | null;
  priceLabel: string;
}

export interface RecipeView {
  name: string;
  category: "Original" | "Weekly Special";
  image: string;
  costEach: number | null;
  costEachLabel: string;
  /** True when some ingredient couldn't be priced, so costEach is a lower bound. */
  costPartial: boolean;
  servings: number | null;
  stockLabel: string;
  stockOk: boolean;
  ingredients: RecipeIngredientView[];
}

export interface DealView {
  ingredient: string;
  merchant: string;
  listing: string;
  priceLabel: string;
  sizeLabel: string;
  discountPct: number;
  onSale: boolean;
}

export interface SpecialView {
  name: string;
  image: string;
  addins: string[];
  addinsOnSale: string[];
  bestDeal: DealView | null;
  score: number;
}

export interface ScoutView {
  source: string;
  listingsMatched: number;
  deals: DealView[];
  specials: SpecialView[];
}

export interface WorkspaceRow {
  name: string;
  detail: string;
  cells: string[];
  status: string;
  tone: Tone;
  action: string;
  /** Tabs this row appears under; absent means it always shows. */
  tabs?: string[];
}

/** Shape rendered by the generic workspace page (metrics, notice, table, side list). */
export interface WorkspaceView {
  title: string;
  intro: string;
  primaryAction: string;
  pills: string[];
  metrics: { label: string; value: string; detail: string; tone?: string }[];
  notice: string;
  tabs: string[];
  tableTitle: string;
  columns: string[];
  rows: (Omit<WorkspaceRow, "tone"> & { tone?: Tone })[];
  sideTitle: string;
  sideIntro: string;
  sideItems: { title: string; detail: string; badge: string; image?: string }[];
}
