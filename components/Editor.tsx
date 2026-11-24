"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { clearCurrentId, getBill, getCurrentId, saveBill, setCurrentId } from "@/lib/history";
import { billTitle, shortDate, whatsappText } from "@/lib/message";
import { rp } from "@/lib/money";
import { sampleBill } from "@/lib/sample";
import { settle } from "@/lib/settle";
import { shareUrl } from "@/lib/share";
import { computeBill } from "@/lib/split";
import { emptyBill, type Bill } from "@/lib/types";
import { ArrowIcon, ShareIcon } from "./icons";
import { ReceiptStep } from "./ReceiptStep";
import { SettleStep } from "./SettleStep";
import { SplitStep } from "./SplitStep";
import { BrandCard, Btn, Dot, Wordmark, copyText, useToast } from "./ui";

type Step = "receipt" | "split" | "settle";
const STEPS: { key: Step; label: string; next?: string }[] = [
  { key: "receipt", label: "Receipt", next: "Next: who had what" },
  { key: "split", label: "Who had what", next: "Next: settle up" },
  { key: "settle", label: "Settle up" },
];

/** Grow a textarea to fit its text, so long bill names wrap instead of hiding. */
function fitHeight(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function initialBill(): Bill {
  const id = getCurrentId();
  return (id && getBill(id)) || emptyBill();
}

export default function Editor() {
  const [bill, setBill] = useState<Bill>(initialBill);
  const [step, setStep] = useState<Step>("receipt");
  const [scanTotal, setScanTotal] = useState<number | null>(null);
  const toast = useToast();
  const math = useMemo(() => computeBill(bill), [bill]);
  const settlement = useMemo(() => settle(bill, math), [bill, math]);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => fitHeight(titleRef.current), [bill.title]);

  useEffect(() => {
    saveBill(bill);
    if (bill.items.length) setCurrentId(bill.id);
  }, [bill]);

  const update = useCallback((fn: (b: Bill) => Bill) => setBill((b) => ({ ...fn(b), updatedAt: Date.now() })), []);

  const go = (s: Step) => {
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function newBill() {
    clearCurrentId();
    setBill(emptyBill());
    setScanTotal(null);
    go("receipt");
    toast.show(bill.items.length ? "Saved the last one in History" : "Fresh bill");
  }

  function ready(): boolean {
    if (!bill.items.length) {
      toast.show("Add some items first");
      return false;
    }
    if (!bill.people.length) {
      toast.show("Add who's splitting first");
      return false;
    }
    return true;
  }

  async function share() {
    if (!ready()) return;
    const url = shareUrl(bill);
    const text = whatsappText(bill, math, settlement);
    if (navigator.share) {
      try {
        await navigator.share({ title: billTitle(bill), text, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    toast.show((await copyText(url)) ? "Link copied. Paste it in your group chat." : "Couldn't copy the link");
  }

  async function copyMessage() {
    if (!ready()) return;
    const ok = await copyText(whatsappText(bill, math, settlement, shareUrl(bill)));
    toast.show(ok ? "Message copied, link included" : "Couldn't copy");
  }

  const idx = STEPS.findIndex((s) => s.key === step);
  const current = STEPS[idx];
  const primary = current.next
    ? { label: current.next, icon: <ArrowIcon />, onClick: () => go(STEPS[idx + 1].key) }
    : { label: "Share with friends", icon: <ShareIcon />, onClick: share };
  const isSample = bill.title.startsWith("Sample:");

  return (
    <div className="mx-auto max-w-[1060px] px-5 pb-40 lg:pb-20">
      <header className="flex h-16 items-center justify-between">
        <Wordmark />
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/history" className="flex h-9 items-center rounded-full px-3 text-ink-2">
            History
          </Link>
          <button onClick={newBill} className="h-9 rounded-full border-[1.5px] border-ink px-3.5 font-medium">
            New bill
          </button>
        </nav>
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <main className="min-w-0">
          <div className="mt-3 mb-5">
            <textarea
              aria-label="Bill name"
              rows={1}
              ref={titleRef}
              value={bill.title}
              onChange={(e) => {
                update((b) => ({ ...b, title: e.target.value.replace(/\n/g, " ").slice(0, 80) }));
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())}
              placeholder="Name this bill"
              className="font-display block w-full resize-none overflow-hidden bg-transparent text-[34px] leading-[1.08] font-extrabold tracking-[-0.035em] outline-none placeholder:text-ink-3/70 sm:text-[44px]"
            />
            <p className="num mt-1 text-xs tracking-wide text-ink-2 uppercase">
              {shortDate(bill.createdAt)} · {bill.items.length} item{bill.items.length === 1 ? "" : "s"} ·{" "}
              {bill.people.length} {bill.people.length === 1 ? "person" : "people"}
              {isSample && " · sample data"}
            </p>
          </div>

          <ol className="mb-5 grid grid-cols-3 gap-1 border-b border-line" aria-label="Steps">
            {STEPS.map((s, i) => (
              <li key={s.key}>
                <button
                  onClick={() => go(s.key)}
                  aria-current={s.key === step ? "step" : undefined}
                  className={`-mb-px flex h-11 w-full items-center gap-1.5 border-b-2 text-left text-[13px] sm:text-sm ${
                    s.key === step ? "border-brand font-semibold" : "border-transparent text-ink-2"
                  }`}
                >
                  <span className="num text-[11px]">{i + 1}</span>
                  <span className="truncate">{s.label}</span>
                </button>
              </li>
            ))}
          </ol>

          {step === "receipt" && (
            <ReceiptStep
              bill={bill}
              math={math}
              update={update}
              notify={toast.show}
              scanTotal={scanTotal}
              setScanTotal={setScanTotal}
              onSample={() => {
                setBill(sampleBill());
                toast.show("Sample bill loaded. It's marked as sample.");
              }}
            />
          )}
          {step === "split" && <SplitStep bill={bill} math={math} update={update} notify={toast.show} />}
          {step === "settle" && (
            <SettleStep
              bill={bill}
              math={math}
              settlement={settlement}
              update={update}
              notify={toast.show}
              goSplit={() => go("split")}
              onCopyMessage={copyMessage}
            />
          )}

        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-6 mt-[88px]">
            <Summary
              bill={bill}
              math={math}
              settlement={settlement}
              action={
                bill.items.length > 0 ? (
                  <Btn onClick={primary.onClick} className="mt-5 w-full">
                    {primary.label} {primary.icon}
                  </Btn>
                ) : null
              }
            />
          </div>
        </aside>
      </div>

      {bill.items.length > 0 && (
        <div className="on-brand fixed inset-x-0 bottom-0 z-40 rounded-t-[22px] bg-brand px-5 pt-3.5 pb-[max(14px,env(safe-area-inset-bottom))] text-on-brand lg:hidden">
          <div className="mx-auto flex max-w-[560px] items-center gap-4">
            <div className="min-w-0">
              <p className="text-[11px] tracking-wide text-on-brand-2 uppercase">Total</p>
              <p className="num truncate text-lg font-bold">{rp(math.total)}</p>
            </div>
            <Btn onClick={primary.onClick} className="ml-auto !px-5">
              {primary.label} {primary.icon}
            </Btn>
          </div>
        </div>
      )}
      {toast.node}
    </div>
  );
}

function Summary({
  bill,
  math,
  settlement,
  action,
}: {
  bill: Bill;
  math: ReturnType<typeof computeBill>;
  settlement: ReturnType<typeof settle>;
  action: React.ReactNode;
}) {
  const person = (id: string) => bill.people.find((p) => p.id === id);
  return (
    <BrandCard className="!p-6">
      <p className="num text-[11px] tracking-[0.14em] text-on-brand-2 uppercase">Total</p>
      <p className="num text-[36px] font-bold tracking-tight">{rp(math.total)}</p>
      {bill.people.length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-on-brand/15 pt-4">
          {math.people.map((s) => {
            const p = person(s.personId)!;
            return (
              <li key={p.id} className="flex items-center gap-2.5">
                <Dot person={p} size={10} ring />
                <span className="truncate">{p.name}</span>
                <span className="leader !translate-y-0" />
                <span className="num">{rp(s.total)}</span>
              </li>
            );
          })}
          {math.unclaimedItemIds.length > 0 && (
            <li className="flex items-center gap-2.5 text-on-brand-2">
              <span className="h-2.5 w-2.5 rounded-full border border-on-brand-2" />
              <span>Nobody yet</span>
              <span className="leader !translate-y-0" />
              <span className="num">{rp(math.unclaimedTotal)}</span>
            </li>
          )}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-on-brand-2">Each person&apos;s share shows up here as you go.</p>
      )}
      {settlement.transfers.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-on-brand/15 pt-4 text-sm">
          {settlement.transfers.map((t) => (
            <li key={`${t.from}>${t.to}`} className="flex items-baseline">
              <span className="truncate">
                {person(t.from)?.name} → {person(t.to)?.name}
              </span>
              <span className="leader" />
              <span className="num">{rp(t.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      {action}
    </BrandCard>
  );
}
