"use client";

import { useState } from "react";
import { rp } from "@/lib/money";
import { lineTotal, type BillMath } from "@/lib/split";
import { PERSON_COLORS, uid, type Bill, type Person } from "@/lib/types";
import { XIcon } from "./icons";
import { Slip } from "./ReceiptStep";
import { Badge, Btn, Dot, Sheet, Stepper, buzz, colorOf } from "./ui";

type Props = {
  bill: Bill;
  math: BillMath;
  update: (fn: (b: Bill) => Bill) => void;
  notify: (m: string) => void;
};

function nextColor(people: Person[]): number {
  const used = new Set(people.map((p) => p.color));
  for (let i = 0; i < PERSON_COLORS.length; i++) if (!used.has(i)) return i;
  return people.length % PERSON_COLORS.length;
}

export function SplitStep({ bill, math, update, notify }: Props) {
  const [active, setActive] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [portionsFor, setPortionsFor] = useState<string | null>(null);
  const activePerson = bill.people.find((p) => p.id === active) ?? null;

  function addPeople() {
    const names = draft
      .split(/[,\n]/)
      .map((s) => s.trim().slice(0, 40))
      .filter(Boolean);
    if (!names.length) return;
    const people = [...bill.people];
    const added: Person[] = [];
    for (const name of names) {
      if (people.length >= 30) break;
      if (people.some((p) => p.name.toLowerCase() === name.toLowerCase())) continue;
      const p = { id: uid(), name, color: nextColor(people) };
      people.push(p);
      added.push(p);
    }
    if (!added.length) {
      notify("They're already in");
      return;
    }
    update((b) => ({ ...b, people }));
    setDraft("");
    if (!active || added.length === 1) setActive(added[0].id);
  }

  function removePerson(id: string) {
    const p = bill.people.find((x) => x.id === id);
    update((b) => ({
      ...b,
      people: b.people.filter((x) => x.id !== id),
      payers: b.payers.filter((x) => x.personId !== id),
      items: b.items.map((it) => {
        const claims = { ...it.claims };
        delete claims[id];
        return { ...it, claims };
      }),
    }));
    setActive(null);
    notify(`Removed ${p?.name ?? "them"}`);
  }

  function toggle(itemId: string) {
    if (!activePerson) {
      notify(bill.people.length ? "Pick a name first, then tap what they had" : "Add a name first");
      return;
    }
    buzz();
    update((b) => ({
      ...b,
      items: b.items.map((it) => {
        if (it.id !== itemId) return it;
        const claims = { ...it.claims };
        if (claims[activePerson.id]) delete claims[activePerson.id];
        else claims[activePerson.id] = 1;
        return { ...it, claims };
      }),
    }));
  }

  function giveRest() {
    if (!activePerson) return;
    const n = math.unclaimedItemIds.length;
    update((b) => ({
      ...b,
      items: b.items.map((it) =>
        math.unclaimedItemIds.includes(it.id) ? { ...it, claims: { [activePerson.id]: 1 } } : it,
      ),
    }));
    notify(`Gave ${n} item${n === 1 ? "" : "s"} to ${activePerson.name}`);
  }

  const portionItem = bill.items.find((it) => it.id === portionsFor);

  return (
    <div className="space-y-5">
      <Slip>
        <h2 className="font-display text-xl font-semibold tracking-tight">Who&apos;s in?</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {bill.people.map((p) => {
            const on = p.id === active;
            return (
              <span key={p.id} className="relative">
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setActive(on ? null : p.id)}
                  className={`flex h-10 items-center gap-2 rounded-full border-2 pr-3.5 pl-2.5 text-[15px] font-medium transition ${
                    on ? "pr-9" : "border-line bg-slip"
                  }`}
                  style={on ? { borderColor: colorOf(p), background: `${colorOf(p)}14` } : undefined}
                >
                  <Dot person={p} size={14} />
                  {p.name}
                </button>
                {on && (
                  <button
                    aria-label={`Remove ${p.name}`}
                    onClick={() => removePerson(p.id)}
                    className="absolute top-1/2 right-1 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-2"
                  >
                    <XIcon />
                  </button>
                )}
              </span>
            );
          })}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addPeople();
          }}
        >
          <input
            aria-label="Add names"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 400))}
            placeholder={bill.people.length ? "Add another name" : "Names, e.g. Sari, Raka, Dewi"}
            className="h-11 min-w-0 flex-1 rounded-xl bg-well px-3 outline-none"
            autoFocus={bill.people.length === 0}
          />
          <Btn kind="outline" type="submit" className="!h-11">
            Add
          </Btn>
        </form>
      </Slip>

      <Slip>
        <div className="flex min-h-9 items-center justify-between gap-3">
          <p className="text-[15px] text-ink-2">
            {activePerson ? (
              <>
                Tapping for{" "}
                <span className="font-semibold" style={{ color: colorOf(activePerson) }}>
                  {activePerson.name}
                </span>
                . Tap again to undo.
              </>
            ) : bill.people.length ? (
              "Pick a name, then tap what they had."
            ) : (
              "Add everyone who ate first."
            )}
          </p>
        </div>

        {bill.items.length === 0 ? (
          <p className="py-6 text-center text-ink-2">No items yet. Add them in step 1.</p>
        ) : (
          <ul className="mt-2">
            {bill.items.map((it) => {
              const claimers = bill.people.filter((p) => (it.claims[p.id] ?? 0) > 0);
              const mine = activePerson && (it.claims[activePerson.id] ?? 0) > 0;
              const canPortion = bill.people.length > 0 && (claimers.length > 1 || it.qty > 1);
              return (
                <li key={it.id} className="relative border-b border-line/60 last:border-0">
                  <span
                    aria-hidden
                    className="absolute top-2 bottom-2 -left-5 w-[3px] rounded-r transition"
                    style={{ background: mine ? colorOf(activePerson!) : "transparent" }}
                  />
                  <button
                    onClick={() => toggle(it.id)}
                    aria-pressed={!!mine}
                    className="block w-full py-3 text-left"
                  >
                    <span className="flex items-baseline">
                      <span className={`truncate ${mine ? "font-semibold" : ""}`}>{it.name}</span>
                      {it.qty > 1 && <span className="num ml-1.5 shrink-0 text-xs text-ink-2">×{it.qty}</span>}
                      <span className="leader" />
                      <span className="num shrink-0">{rp(lineTotal(it))}</span>
                    </span>
                    <span className="mt-1.5 flex min-h-5 flex-wrap gap-1 pr-20">
                      {claimers.length ? (
                        claimers.map((p) => <Badge key={p.id} person={p} portions={it.claims[p.id]} />)
                      ) : (
                        <span className="text-xs text-ink-2">nobody yet</span>
                      )}
                    </span>
                  </button>
                  {canPortion && (
                    <button
                      onClick={() => setPortionsFor(it.id)}
                      className="absolute right-0 bottom-2 h-8 rounded-full px-2 text-xs text-ink-2 underline decoration-line underline-offset-4"
                    >
                      Portions
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {bill.items.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t-[1.5px] border-dashed border-line pt-3 text-sm">
            {math.unclaimedItemIds.length ? (
              <>
                <span className="text-ink-2">
                  {math.unclaimedItemIds.length} item{math.unclaimedItemIds.length === 1 ? "" : "s"} nobody has yet ·{" "}
                  <span className="num">{rp(math.unclaimedSubtotal)}</span>
                </span>
                {activePerson && (
                  <Btn kind="ghost" className="!px-0" onClick={giveRest}>
                    Give the rest to {activePerson.name}
                  </Btn>
                )}
              </>
            ) : (
              <span className="font-medium">Everything&apos;s claimed ✓</span>
            )}
          </div>
        )}
      </Slip>

      <Sheet open={!!portionItem} onClose={() => setPortionsFor(null)} title={portionItem?.name ?? "Portions"}>
        {portionItem && (
          <>
            <p className="mb-3 text-sm text-ink-2">
              How much did each person have? E.g. 2 of 3 sate. The price splits by these portions.
            </p>
            <ul className="space-y-1">
              {bill.people.map((p) => {
                const n = portionItem.claims[p.id] ?? 0;
                const share = math.people.find((s) => s.personId === p.id)?.items.find((x) => x.itemId === portionItem.id);
                return (
                  <li key={p.id} className="flex items-center gap-3 py-1">
                    <Dot person={p} size={12} />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="num w-24 text-right text-sm text-ink-2">{share ? rp(share.amount) : ""}</span>
                    <Stepper
                      label={`portions for ${p.name}`}
                      value={n}
                      onChange={(v) =>
                        update((b) => ({
                          ...b,
                          items: b.items.map((it) => {
                            if (it.id !== portionItem.id) return it;
                            const claims = { ...it.claims };
                            if (v > 0) claims[p.id] = v;
                            else delete claims[p.id];
                            return { ...it, claims };
                          }),
                        }))
                      }
                    />
                  </li>
                );
              })}
            </ul>
            <Btn
              kind="outline"
              className="mt-4 w-full"
              onClick={() =>
                update((b) => ({
                  ...b,
                  items: b.items.map((it) =>
                    it.id === portionItem.id
                      ? { ...it, claims: Object.fromEntries(b.people.map((p) => [p.id, 1])) }
                      : it,
                  ),
                }))
              }
            >
              Everyone shared it equally
            </Btn>
          </>
        )}
      </Sheet>
    </div>
  );
}
