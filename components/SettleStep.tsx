"use client";

import { useRef, useState } from "react";
import { getQris, setQris } from "@/lib/history";
import { blobToDataUrl, shrinkImage } from "@/lib/image";
import { rp } from "@/lib/money";
import { transferKey, type Settlement } from "@/lib/settle";
import type { BillMath, PersonShare } from "@/lib/split";
import type { Bill, Person } from "@/lib/types";
import { Slip } from "./ReceiptStep";
import { BrandCard, Btn, Dot, MoneyInput, Sheet, buzz } from "./ui";

type Props = {
  bill: Bill;
  math: BillMath;
  settlement: Settlement;
  update: (fn: (b: Bill) => Bill) => void;
  notify: (m: string) => void;
  goSplit: () => void;
  onCopyMessage: () => void;
};

export function SettleStep({ bill, math, settlement, update, notify, goSplit, onCopyMessage }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [together, setTogether] = useState(bill.payers.length > 1);
  const [qris, setQrisState] = useState<string | null>(() => getQris());
  const [qrisOpen, setQrisOpen] = useState(false);
  const qrisRef = useRef<HTMLInputElement>(null);
  const person = (id: string) => bill.people.find((p) => p.id === id);

  if (bill.people.length === 0) {
    return (
      <BrandCard>
        <div className="py-10 text-center">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Who ate?</h2>
          <p className="mt-1 text-on-brand-2">Add names and tap what they had, then come back here.</p>
          <Btn className="mt-5" onClick={goSplit}>
            Go to who had what
          </Btn>
        </div>
      </BrandCard>
    );
  }

  function togglePayer(id: string) {
    update((b) => {
      const has = b.payers.some((p) => p.personId === id);
      if (!together) return { ...b, payers: has ? [] : [{ personId: id, amount: null }] };
      let payers = has ? b.payers.filter((p) => p.personId !== id) : [...b.payers, { personId: id, amount: b.payers.length ? 0 : null }];
      // Exactly one payer covers "the rest".
      if (payers.length && !payers.some((p) => p.amount === null)) payers = [{ ...payers[0], amount: null }, ...payers.slice(1)];
      return { ...b, payers };
    });
  }

  function toggleSettled(key: string) {
    buzz();
    update((b) => ({
      ...b,
      settled: b.settled.includes(key) ? b.settled.filter((k) => k !== key) : [...b.settled, key],
    }));
  }

  async function onQris(file: File | undefined) {
    if (!file) return;
    try {
      const url = await blobToDataUrl(await shrinkImage(file, 800, 0.9));
      if (!setQris(url)) throw new Error();
      setQrisState(url);
      notify("QRIS saved on this phone");
    } catch {
      notify("Couldn't save that photo here");
    } finally {
      if (qrisRef.current) qrisRef.current.value = "";
    }
  }

  const transfers = settlement.transfers;
  const doneCount = transfers.filter((t) => bill.settled.includes(transferKey(t))).length;

  return (
    <div className="space-y-5">
      <Slip>
        <h2 className="font-display text-xl font-semibold tracking-tight">Each person</h2>
        <ul className="mt-2">
          {math.people.map((s) => {
            const p = person(s.personId)!;
            const isOpen = open === p.id;
            return (
              <li key={p.id} className="border-b border-line/60 last:border-0">
                <button
                  onClick={() => setOpen(isOpen ? null : p.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 py-3 text-left"
                >
                  <Dot person={p} size={12} />
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="leader !translate-y-0" />
                  <span className="num text-lg font-semibold">{rp(s.total)}</span>
                </button>
                {isOpen && <Breakdown share={s} taxLabel={bill.tax.label} />}
              </li>
            );
          })}
        </ul>
        {math.unclaimedItemIds.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-well/70 px-4 py-3 text-sm">
            <span>
              <span className="num">{rp(math.unclaimedTotal)}</span> of items nobody has yet.
            </span>
            <Btn kind="ghost" className="!h-7 !px-0" onClick={goSplit}>
              Claim them
            </Btn>
          </p>
        )}
      </Slip>

      <Slip>
        <h2 className="font-display text-xl font-semibold tracking-tight">Who paid the bill?</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {bill.people.map((p) => {
            const on = bill.payers.some((x) => x.personId === p.id);
            return (
              <button
                key={p.id}
                aria-pressed={on}
                onClick={() => togglePayer(p.id)}
                className={`flex h-10 items-center gap-2 rounded-full border-2 pr-3.5 pl-2.5 text-[15px] font-medium ${
                  on ? "border-ink bg-ink text-paper" : "border-line bg-slip"
                }`}
              >
                <Dot person={p} size={12} />
                {p.name}
              </button>
            );
          })}
        </div>
        {together && bill.payers.length > 0 && (
          <ul className="mt-4 space-y-2">
            {bill.payers.map((pay) => {
              const p = person(pay.personId);
              if (!p) return null;
              return (
                <li key={pay.personId} className="flex items-center gap-3">
                  <span className="flex-1 truncate">{p.name}</span>
                  {pay.amount === null ? (
                    <span className="num text-sm text-ink-2">the rest · {rp(settlement.paid[p.id] ?? 0)}</span>
                  ) : (
                    <MoneyInput
                      label={`${p.name} paid`}
                      value={pay.amount}
                      className="w-40"
                      onChange={(v) =>
                        update((b) => ({
                          ...b,
                          payers: b.payers.map((x) => (x.personId === p.id ? { ...x, amount: v } : x)),
                        }))
                      }
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {settlement.paidMismatch > 0 && (
          <p className="mt-2 text-sm text-stamp">Payments add up to {rp(settlement.paidMismatch)} more than the bill.</p>
        )}
        <Btn
          kind="ghost"
          className="mt-2 !px-0"
          onClick={() => {
            const next = !together;
            setTogether(next);
            if (!next) update((b) => ({ ...b, payers: b.payers.slice(0, 1).map((p) => ({ ...p, amount: null })) }));
          }}
        >
          {together ? "Just one person paid" : "More than one person paid?"}
        </Btn>
      </Slip>

      <Slip>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-semibold tracking-tight">Settle up</h2>
          {transfers.length > 0 && (
            <span className="num text-xs text-ink-2">
              {doneCount}/{transfers.length} paid
            </span>
          )}
        </div>
        {bill.payers.length === 0 ? (
          <p className="mt-2 text-ink-2">Pick who paid to see who owes whom.</p>
        ) : transfers.length === 0 ? (
          <p className="mt-2 text-ink-2">Nobody owes anything.</p>
        ) : (
          <>
            <ul className="mt-2">
              {transfers.map((t) => {
                const key = transferKey(t);
                const done = bill.settled.includes(key);
                return (
                  <li key={key} className="border-b border-line/60 py-3 last:border-0">
                    <span className={`flex min-w-0 items-center gap-2 ${done ? "text-ink-2" : ""}`}>
                      <Who p={person(t.from)} />
                      <span className="shrink-0 text-ink-2">pays</span>
                      <Who p={person(t.to)} />
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-3">
                      <span className={`num text-lg font-semibold ${done ? "text-ink-2 line-through decoration-1" : ""}`}>
                        {rp(t.amount)}
                      </span>
                      <button
                        onClick={() => toggleSettled(key)}
                        aria-pressed={done}
                        aria-label={done ? "Mark as not paid" : "Mark as paid"}
                        className="flex h-10 min-w-[84px] shrink-0 items-center justify-center rounded-full text-sm text-ink-2"
                      >
                        {done ? (
                          <span className="stamp">LUNAS</span>
                        ) : (
                          <span className="rounded-full border-[1.5px] border-line px-3 py-1.5">Mark paid</span>
                        )}
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
            {doneCount === transfers.length && <p className="mt-3 font-medium">Everyone&apos;s square. 🎉</p>}
          </>
        )}
      </Slip>

      <Slip>
        <h2 className="font-display text-xl font-semibold tracking-tight">Where to pay</h2>
        <textarea
          aria-label="Where to pay"
          value={bill.note}
          onChange={(e) => update((b) => ({ ...b, note: e.target.value.slice(0, 300) }))}
          placeholder="BCA 1234567890 a.n. Haiqal · GoPay 0812…"
          rows={2}
          className="mt-3 w-full resize-none rounded-xl bg-well px-3 py-2.5 outline-none"
        />
        <p className="mt-1 text-xs text-ink-2">This goes in the share link, so friends can copy it.</p>

        <input ref={qrisRef} type="file" accept="image/*" className="hidden" onChange={(e) => onQris(e.target.files?.[0])} />
        <div className="mt-4 flex items-center gap-3">
          {qris ? (
            <>
              <button onClick={() => setQrisOpen(true)} className="overflow-hidden rounded-xl border border-line" aria-label="Show QRIS">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qris} alt="Your QRIS code" className="h-16 w-16 object-cover" />
              </button>
              <div className="flex-1 text-sm">
                <p className="font-medium">QRIS</p>
                <p className="text-ink-2">Stays on this phone. Show it at the table.</p>
              </div>
              <Btn
                kind="ghost"
                onClick={() => {
                  setQris(null);
                  setQrisState(null);
                  notify("QRIS removed");
                }}
              >
                Remove
              </Btn>
            </>
          ) : (
            <>
              <Btn kind="outline" className="!h-10 !text-sm" onClick={() => qrisRef.current?.click()}>
                Add QRIS photo
              </Btn>
              <p className="flex-1 text-xs text-ink-2">Kept on this phone only, not in the link.</p>
            </>
          )}
        </div>
      </Slip>

      <div className="flex flex-col items-center gap-1 pt-1">
        <Btn kind="outline" className="w-full max-w-[320px]" onClick={onCopyMessage}>
          Copy WhatsApp message
        </Btn>
        <p className="text-center text-xs text-ink-2">Anyone with the link can see the names and amounts.</p>
      </div>

      <Sheet open={qrisOpen} onClose={() => setQrisOpen(false)} title="Scan to pay">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qris && <img src={qris} alt="Your QRIS code" className="mx-auto max-h-[60vh] rounded-2xl" />}
      </Sheet>
    </div>
  );
}

function Who({ p }: { p?: Person }) {
  if (!p) return <span>?</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Dot person={p} size={10} />
      <span className="truncate font-medium">{p.name}</span>
    </span>
  );
}

export function Breakdown({ share, taxLabel = "Tax" }: { share: PersonShare; taxLabel?: string }) {
  return (
    <div className="fade-in mb-3 ml-6 space-y-1 text-sm text-ink-2">
      {share.items.map((it) => (
        <div key={it.itemId} className="flex items-baseline">
          <span className="truncate">
            {it.name}
            {it.of > 1 && (
              <span className="num ml-1 text-xs">
                {it.portions}/{it.of}
              </span>
            )}
          </span>
          <span className="leader" />
          <span className="num">{rp(it.amount)}</span>
        </div>
      ))}
      {share.items.length === 0 && <p>Nothing claimed yet.</p>}
      {share.discount > 0 && <Row label="Discount" value={`−${rp(share.discount)}`} />}
      {share.service > 0 && <Row label="Service" value={rp(share.service)} />}
      {share.tax > 0 && <Row label={taxLabel} value={rp(share.tax)} />}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline">
      <span>{label}</span>
      <span className="leader" />
      <span className="num">{value}</span>
    </div>
  );
}
