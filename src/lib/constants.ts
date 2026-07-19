export const CATEGORIES = [
  "Delivery",
  "Warehouse",
  "Home Services",
  "Events & Hospitality",
  "Skilled Trades",
  "Retail & Customer Service",
] as const;

export type Category = (typeof CATEGORIES)[number];
