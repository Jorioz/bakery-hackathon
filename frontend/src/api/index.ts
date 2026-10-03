/** Single entry point for components: `import { api } from "../api"`. */
import { loadRecipes } from "./recipes";
import { fetchInventory, expiringSoon } from "./inventory";
import { fetchQuotes, clearPriceCache } from "./prices";
import { fetchScout } from "./specials";
import { flavorLabWorkspace, inventoryWorkspace, suppliersWorkspace } from "./workspaces";

export { ApiError, isAbort } from "./client";

export const api = {
  prices: { quotes: fetchQuotes, clearCache: clearPriceCache },
  recipes: { list: loadRecipes },
  inventory: { get: fetchInventory, expiringSoon },
  specials: { scout: fetchScout },
  workspaces: {
    Inventory: inventoryWorkspace,
    Suppliers: suppliersWorkspace,
    "Flavor Lab": flavorLabWorkspace,
  },
} as const;

export type LiveWorkspaceName = keyof typeof api.workspaces;
export const isLiveWorkspace = (name: string): name is LiveWorkspaceName => name in api.workspaces;
