export const pct = (x: number, d = 1, sign = true) => `${sign && x > 0 ? "+" : ""}${x.toFixed(d)}%`;
export const money = (x: number) => x.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const compact = (x: number) => Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(x);
export const date = (s: string) => s.slice(0, 10);
