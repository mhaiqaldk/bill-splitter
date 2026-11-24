import { emptyBill, uid, type Bill } from "./types";

/** A labelled sample so first-time visitors can see the whole flow. */
export function sampleBill(): Bill {
  const b = emptyBill();
  const [a, s, r, d] = ["Haiqal", "Sari", "Raka", "Dewi"].map((name, color) => ({ id: uid(), name, color }));
  const claim = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, 1]));
  return {
    ...b,
    title: "Sample: Warung Sate Pak Kumis",
    people: [a, s, r, d],
    items: [
      { id: uid(), name: "Sate ayam (10 tusuk)", qty: 3, unit: 35000, claims: { [a.id]: 1, [s.id]: 1, [r.id]: 1 } },
      { id: uid(), name: "Sate kambing", qty: 1, unit: 55000, claims: claim(r.id) },
      { id: uid(), name: "Nasi putih", qty: 4, unit: 6000, claims: claim(a.id, s.id, r.id, d.id) },
      { id: uid(), name: "Sop buntut", qty: 1, unit: 68000, claims: claim(d.id) },
      { id: uid(), name: "Es teh manis", qty: 3, unit: 8000, claims: claim(a.id, s.id, d.id) },
      { id: uid(), name: "Es jeruk", qty: 1, unit: 12000, claims: claim(r.id) },
      { id: uid(), name: "Kerupuk", qty: 2, unit: 5000, claims: claim(a.id, s.id, r.id, d.id) },
    ],
    service: { mode: "pct", value: 5 },
    tax: { mode: "pct", value: 10, label: "PB1" },
    serviceTaxed: true,
    payers: [{ personId: a.id, amount: null }],
    note: "BCA 1234567890 a.n. Haiqal (sample)",
  };
}
