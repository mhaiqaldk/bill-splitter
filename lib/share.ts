import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { PERSON_COLORS, uid, type Bill, type Charge } from "./types";

/**
 * The whole bill travels inside the URL hash (/s#...), so it never reaches a
 * server. Compact positional arrays keep links short enough for WhatsApp.
 */
type Packed = [
  1,
  string, // title
  number, // createdAt
  [string, number][], // people: name, color
  [string, number, number, [number, number][]][], // items: name, qty, unit, claims [personIndex, portions]
  [0 | 1, number], // discount [isPct, value]
  [0 | 1, number], // service
  [0 | 1, number, string], // tax + label
  0 | 1, // service taxed
  [number, number][], // payers [personIndex, amount or -1 for "the rest"]
  string, // note
];

const packCharge = (c: Charge): [0 | 1, number] => [c.mode === "pct" ? 1 : 0, c.value];

export function encodeBill(bill: Bill): string {
  const index = new Map(bill.people.map((p, i) => [p.id, i]));
  const packed: Packed = [
    1,
    bill.title,
    bill.createdAt,
    bill.people.map((p) => [p.name, p.color]),
    bill.items.map((it) => [
      it.name,
      it.qty,
      it.unit,
      Object.entries(it.claims)
        .filter(([id, n]) => n > 0 && index.has(id))
        .map(([id, n]) => [index.get(id)!, n]),
    ]),
    packCharge(bill.discount),
    packCharge(bill.service),
    [...packCharge(bill.tax), bill.tax.label],
    bill.serviceTaxed ? 1 : 0,
    bill.payers
      .filter((p) => index.has(p.personId))
      .map((p) => [index.get(p.personId)!, p.amount ?? -1]),
    bill.note,
  ];
  return compressToEncodedURIComponent(JSON.stringify(packed));
}

// ---- decoding: the link is untrusted input, so check every field ----

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min;
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const MAX_RP = 999_999_999;

function unpackCharge(v: unknown): Charge {
  const a = arr(v, 2);
  const mode = a[0] === 1 ? "pct" : "amount";
  return { mode, value: num(a[1], 0, mode === "pct" ? 100 : MAX_RP) };
}

export function decodeBill(hash: string): Bill | null {
  try {
    const json = decompressFromEncodedURIComponent(hash.replace(/^#/, ""));
    if (!json) return null;
    const p = JSON.parse(json) as unknown[];
    if (!Array.isArray(p) || p[0] !== 1) return null;

    const people = arr(p[3], 30).map((raw) => {
      const a = arr(raw, 2);
      return { id: uid(), name: str(a[0], 40) || "Friend", color: Math.floor(num(a[1], 0, PERSON_COLORS.length - 1)) };
    });
    const items = arr(p[4], 200).map((raw) => {
      const a = arr(raw, 4);
      const claims: Record<string, number> = {};
      for (const c of arr(a[3], 30)) {
        const [pi, n] = arr(c, 2);
        const person = people[Math.floor(num(pi, 0, people.length))];
        if (person) claims[person.id] = Math.floor(num(n, 0, 99));
      }
      return {
        id: uid(),
        name: str(a[0], 80) || "Item",
        qty: Math.floor(num(a[1], 1, 999)),
        unit: Math.round(num(a[2], 0, MAX_RP)),
        claims,
      };
    });
    const taxRaw = arr(p[7], 3);
    const payers = arr(p[9], 30)
      .map((raw) => {
        const [pi, amt] = arr(raw, 2);
        const person = people[Math.floor(num(pi, 0, people.length))];
        if (!person) return null;
        return { personId: person.id, amount: amt === -1 ? null : Math.round(num(amt, 0, MAX_RP)) };
      })
      .filter((x) => x !== null);

    const createdAt = num(p[2], 0, 4102444800000) || Date.now();
    return {
      id: uid(),
      title: str(p[1], 80),
      createdAt,
      updatedAt: createdAt,
      people,
      items,
      discount: unpackCharge(p[5]),
      service: unpackCharge(p[6]),
      tax: { ...unpackCharge(taxRaw), label: str(taxRaw[2], 20) || "Tax" },
      serviceTaxed: p[8] !== 0,
      payers,
      note: str(p[10], 300),
      settled: [],
    };
  } catch {
    return null;
  }
}

export function shareUrl(bill: Bill): string {
  return `${window.location.origin}/s#${encodeBill(bill)}`;
}
