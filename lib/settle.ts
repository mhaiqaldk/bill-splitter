import type { Bill } from "./types";
import type { BillMath } from "./split";

export type Transfer = { from: string; to: string; amount: number };

export type Settlement = {
  paid: Record<string, number>;
  /** paid amounts that don't match the bill total (only when every payer has a fixed amount) */
  paidMismatch: number;
  transfers: Transfer[];
};

export const transferKey = (t: Transfer) => `${t.from}>${t.to}`;

/** How much each payer covered. One payer may be "the rest" (amount null). */
export function paidBy(bill: Bill, total: number): { paid: Record<string, number>; mismatch: number } {
  const paid: Record<string, number> = {};
  const valid = bill.payers.filter((p) => bill.people.some((x) => x.id === p.personId));
  const fixed = valid.filter((p) => p.amount !== null);
  const fixedSum = fixed.reduce((a, p) => a + (p.amount ?? 0), 0);
  const rest = valid.find((p) => p.amount === null);
  for (const p of fixed) paid[p.personId] = (paid[p.personId] ?? 0) + (p.amount ?? 0);
  if (rest) paid[rest.personId] = (paid[rest.personId] ?? 0) + Math.max(0, total - fixedSum);
  const covered = Object.values(paid).reduce((a, b) => a + b, 0);
  return { paid, mismatch: valid.length ? covered - total : 0 };
}

/**
 * Fewest transfers in practice: repeatedly let the person who owes the most pay
 * the person who is owed the most. Exact to the rupiah.
 */
export function settle(bill: Bill, math: BillMath): Settlement {
  const { paid, mismatch } = paidBy(bill, math.total);
  if (Object.keys(paid).length === 0) return { paid, paidMismatch: 0, transfers: [] };

  const balance = new Map<string, number>();
  for (const share of math.people) balance.set(share.personId, (paid[share.personId] ?? 0) - share.total);

  const creditors = [...balance].filter(([, b]) => b > 0).map(([id, b]) => ({ id, b }));
  const debtors = [...balance].filter(([, b]) => b < 0).map(([id, b]) => ({ id, b: -b }));
  const transfers: Transfer[] = [];

  while (creditors.length && debtors.length) {
    creditors.sort((a, b) => b.b - a.b);
    debtors.sort((a, b) => b.b - a.b);
    const c = creditors[0];
    const d = debtors[0];
    const amount = Math.min(c.b, d.b);
    if (amount > 0) transfers.push({ from: d.id, to: c.id, amount });
    c.b -= amount;
    d.b -= amount;
    if (c.b === 0) creditors.shift();
    if (d.b === 0) debtors.shift();
  }

  return { paid, paidMismatch: mismatch, transfers };
}
