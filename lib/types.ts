export type Person = {
  id: string;
  name: string;
  /** index into PERSON_COLORS */
  color: number;
};

export type Item = {
  id: string;
  name: string;
  qty: number;
  /** price for one unit, whole rupiah */
  unit: number;
  /** personId -> portions (e.g. 2 of 3 sate). Even split = 1 each. */
  claims: Record<string, number>;
};

export type Charge = {
  mode: "pct" | "amount";
  value: number;
};

export type Payer = {
  personId: string;
  /** null = pays whatever the others didn't cover */
  amount: number | null;
};

export type Bill = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  people: Person[];
  items: Item[];
  discount: Charge;
  service: Charge;
  tax: Charge & { label: string };
  serviceTaxed: boolean;
  payers: Payer[];
  note: string;
  /** transfer keys "from>to" marked as paid */
  settled: string[];
};

export const PERSON_COLORS = [
  "#2F5BFF", // cobalt
  "#D6246E", // magenta
  "#E8641B", // orange
  "#0E8F80", // teal
  "#7A3FF2", // violet
  "#B98A00", // mustard
  "#1F7F45", // forest
  "#0A86C9", // sky
  "#A23B72", // plum
  "#5C6B00", // olive
] as const;

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyBill(): Bill {
  const now = Date.now();
  return {
    id: uid(),
    title: "",
    createdAt: now,
    updatedAt: now,
    people: [],
    items: [],
    discount: { mode: "amount", value: 0 },
    service: { mode: "pct", value: 0 },
    tax: { mode: "pct", value: 0, label: "Tax" },
    serviceTaxed: true,
    payers: [],
    note: "",
    settled: [],
  };
}
