import { rp } from "./money";
import type { BillMath } from "./split";
import type { Settlement } from "./settle";
import type { Bill } from "./types";

export function billTitle(bill: Bill): string {
  return bill.title.trim() || "Shared bill";
}

export function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** A plain WhatsApp-friendly summary. */
export function whatsappText(bill: Bill, math: BillMath, settlement: Settlement, link?: string): string {
  const name = (id: string) => bill.people.find((p) => p.id === id)?.name ?? "?";
  const lines = [`🧾 *${billTitle(bill)}* · ${shortDate(bill.createdAt)}`, `Total ${rp(math.total)}`, ""];
  if (settlement.transfers.length) {
    for (const t of settlement.transfers) lines.push(`${name(t.from)} → ${name(t.to)}: *${rp(t.amount)}*`);
  } else {
    for (const s of math.people) lines.push(`${name(s.personId)}: ${rp(s.total)}`);
  }
  if (bill.note.trim()) lines.push("", `Pay to: ${bill.note.trim()}`);
  if (link) lines.push("", `Details: ${link}`);
  return lines.join("\n");
}
