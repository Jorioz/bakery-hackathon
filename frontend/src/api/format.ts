/** Display helpers shared by the normalizers. */

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

export const formatMoney = (n: number): string => money.format(n);

/** 2000 g -> "2,000 g", 0.5 each -> "0.5 each" */
export function formatAmount(amount: number, unit: string | null): string {
  const n = Number.isInteger(amount) ? amount.toLocaleString("en-CA") : String(+amount.toFixed(2));
  return unit ? `${n} ${unit}` : n;
}

export function titleCase(text: string): string {
  return text.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** Whole days from today (local) until an ISO date; negative if past. */
export function daysUntil(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((new Date(y, m - 1, d).getTime() - start.getTime()) / 86_400_000);
}

export function expiryLabel(iso: string | null): string {
  if (!iso) return "No expiry";
  const days = daysUntil(iso);
  if (days < 0) return "Expired";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days`;
}

/** Figma flavor art; pick the closest to a recipe or ingredient name. */
export function imageFor(name: string): string {
  const n = name.toLowerCase();
  if (/latte|coffee|espresso/.test(n)) return "flavor-latte-kitty.png";
  if (/matcha/.test(n)) return "flavor-matcha-blob.png";
  if (/blueberr/.test(n)) return "flavor-blueberry-jelly.png";
  if (/strawberr/.test(n)) return "flavor-strawberry.png";
  if (/chocolate|mochi/.test(n)) return "flavor-choco-mochi.png";
  if (/pretzel|caramel/.test(n)) return "flavor-pretzel.png";
  return "flavor-golden-croissant.png";
}
