import { allocate } from "./money";
import type { Bill, Charge, Item } from "./types";

export type ItemShare = { itemId: string; name: string; amount: number; portions: number; of: number };

export type PersonShare = {
  personId: string;
  items: ItemShare[];
  subtotal: number;
  discount: number;
  service: number;
  tax: number;
  total: number;
};

export type BillMath = {
  subtotal: number;
  discount: number;
  service: number;
  tax: number;
  total: number;
  /** items nobody has claimed yet, as part of the subtotal */
  unclaimedSubtotal: number;
  /** what the unclaimed items cost once extras are added */
  unclaimedTotal: number;
  unclaimedItemIds: string[];
  people: PersonShare[];
};

export const lineTotal = (it: Item) => Math.round(it.qty * it.unit);

function charge(c: Charge, base: number): number {
  if (!c.value || base <= 0) return 0;
  const v = c.mode === "pct" ? Math.round((base * c.value) / 100) : Math.round(c.value);
  return Math.max(0, v);
}

export function computeBill(bill: Bill): BillMath {
  const subtotal = bill.items.reduce((a, it) => a + lineTotal(it), 0);
  const discount = Math.min(subtotal, charge(bill.discount, subtotal));
  const afterDiscount = subtotal - discount;
  const service = charge(bill.service, afterDiscount);
  const tax = charge(bill.tax, afterDiscount + (bill.serviceTaxed ? service : 0));
  const total = afterDiscount + service + tax;

  const ids = bill.people.map((p) => p.id);
  const itemShares: Record<string, ItemShare[]> = Object.fromEntries(ids.map((id) => [id, []]));
  let unclaimedSubtotal = 0;
  const unclaimedItemIds: string[] = [];

  for (const it of bill.items) {
    const line = lineTotal(it);
    const claimers = ids.filter((id) => (it.claims[id] ?? 0) > 0);
    if (claimers.length === 0) {
      unclaimedSubtotal += line;
      unclaimedItemIds.push(it.id);
      continue;
    }
    const portions = claimers.map((id) => it.claims[id]);
    const of = portions.reduce((a, b) => a + b, 0);
    const parts = allocate(line, portions);
    claimers.forEach((id, k) => {
      itemShares[id].push({ itemId: it.id, name: it.name, amount: parts[k], portions: portions[k], of });
    });
  }

  const personSub = ids.map((id) => itemShares[id].reduce((a, s) => a + s.amount, 0));
  // Last weight is the "nobody yet" bucket so unclaimed items carry their own extras.
  const weights = [...personSub, unclaimedSubtotal];
  const d = allocate(discount, weights);
  const s = allocate(service, weights);
  const t = allocate(tax, weights);
  const n = ids.length;

  const people: PersonShare[] = ids.map((id, i) => ({
    personId: id,
    items: itemShares[id],
    subtotal: personSub[i],
    discount: d[i],
    service: s[i],
    tax: t[i],
    total: personSub[i] - d[i] + s[i] + t[i],
  }));

  return {
    subtotal,
    discount,
    service,
    tax,
    total,
    unclaimedSubtotal,
    unclaimedTotal: unclaimedSubtotal - (d[n] ?? 0) + (s[n] ?? 0) + (t[n] ?? 0),
    unclaimedItemIds,
    people,
  };
}
