"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { saveBill, setCurrentId } from "@/lib/history";
import { billTitle, shortDate, whatsappText } from "@/lib/message";
import { rp } from "@/lib/money";
import { settle } from "@/lib/settle";
import { decodeBill } from "@/lib/share";
import { computeBill, lineTotal } from "@/lib/split";
import { Slip } from "./ReceiptStep";
import { Breakdown } from "./SettleStep";
import { Badge, Btn, Dot, Wordmark, colorOf, copyText, useToast } from "./ui";

export default function SharedView() {
  const router = useRouter();
  const [bill] = useState(() => decodeBill(window.location.hash));
  const [me, setMe] = useState<string | null>(null);
  const toast = useToast();
  const math = useMemo(() => (bill ? computeBill(bill) : null), [bill]);
  const settlement = useMemo(() => (bill && math ? settle(bill, math) : null), [bill, math]);

  if (!bill || !math || !settlement) {
    return (
      <Shell>
        <Slip>
          <div className="py-10 text-center">
            <h1 className="font-display text-2xl font-semibold tracking-tight">This link looks incomplete</h1>
            <p className="mt-1 text-ink-2">It may have been cut off when it was pasted. Ask for the link again.</p>
            <Btn className="mt-6" onClick={() => router.push("/")}>
              Split a bill yourself
            </Btn>
          </div>
        </Slip>
      </Shell>
    );
  }

  const person = (id: string) => bill.people.find((p) => p.id === id);
  const mine = me ? math.people.find((s) => s.personId === me) : null;
  const myOut = settlement.transfers.filter((t) => t.from === me);
  const myIn = settlement.transfers.filter((t) => t.to === me);

  return (
    <Shell>
      <p className="num text-xs tracking-wide text-ink-2 uppercase">
        Shared bill · {shortDate(bill.createdAt)}
      </p>
      <h1 className="font-display mt-1 text-[34px] leading-tight font-extrabold tracking-[-0.035em]">{billTitle(bill)}</h1>
      <p className="num mt-1 text-ink-2">Total {rp(math.total)}</p>

      <Slip>
        <h2 className="font-display text-xl font-semibold tracking-tight">Which one are you?</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {bill.people.map((p) => {
            const on = me === p.id;
            return (
              <button
                key={p.id}
                aria-pressed={on}
                onClick={() => setMe(on ? null : p.id)}
                className={`flex h-10 items-center gap-2 rounded-full border-2 pr-3.5 pl-2.5 text-[15px] font-medium ${on ? "" : "border-line bg-slip"}`}
                style={on ? { borderColor: colorOf(p), background: `${colorOf(p)}14` } : undefined}
              >
                <Dot person={p} size={12} />
                {p.name}
              </button>
            );
          })}
        </div>

        {mine && (
          <div className="fade-in mt-5 border-t-[1.5px] border-dashed border-line pt-4">
            {myOut.length > 0 ? (
              myOut.map((t) => (
                <p key={t.to} className="text-lg">
                  You pay <span className="font-semibold">{person(t.to)?.name}</span>
                  <span className="num mt-1 block text-[34px] leading-tight font-bold">{rp(t.amount)}</span>
                </p>
              ))
            ) : myIn.length > 0 ? (
              <p className="text-lg">
                You get back
                <span className="num mt-1 block text-[34px] leading-tight font-bold">
                  {rp(myIn.reduce((a, t) => a + t.amount, 0))}
                </span>
              </p>
            ) : (
              <p className="text-lg">
                Your share
                <span className="num mt-1 block text-[34px] leading-tight font-bold">{rp(mine.total)}</span>
              </p>
            )}
            <p className="mt-3 mb-1 text-sm font-medium">What you had</p>
            <Breakdown share={mine} taxLabel={bill.tax.label} />
          </div>
        )}
      </Slip>

      {bill.note.trim() && (
        <Slip>
          <h2 className="font-display text-xl font-semibold tracking-tight">Where to pay</h2>
          <p className="mt-2 break-words whitespace-pre-wrap">{bill.note}</p>
          <Btn
            kind="outline"
            className="mt-3 !h-10 !text-sm"
            onClick={async () => toast.show((await copyText(bill.note)) ? "Copied" : "Couldn't copy")}
          >
            Copy
          </Btn>
        </Slip>
      )}

      {settlement.transfers.length > 0 && (
        <Slip>
          <h2 className="font-display text-xl font-semibold tracking-tight">Who pays whom</h2>
          <ul className="mt-2">
            {settlement.transfers.map((t) => (
              <li key={`${t.from}>${t.to}`} className="flex items-baseline border-b border-line/60 py-2.5 last:border-0">
                <span className="truncate">
                  {person(t.from)?.name} → {person(t.to)?.name}
                </span>
                <span className="leader" />
                <span className="num font-semibold">{rp(t.amount)}</span>
              </li>
            ))}
          </ul>
        </Slip>
      )}

      <Slip>
        <h2 className="font-display text-xl font-semibold tracking-tight">The receipt</h2>
        <ul className="mt-2">
          {bill.items.map((it) => (
            <li key={it.id} className="border-b border-line/60 py-2.5 last:border-0">
              <div className="flex items-baseline">
                <span className="truncate">{it.name}</span>
                {it.qty > 1 && <span className="num ml-1.5 shrink-0 text-xs text-ink-2">×{it.qty}</span>}
                <span className="leader" />
                <span className="num">{rp(lineTotal(it))}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {bill.people
                  .filter((p) => (it.claims[p.id] ?? 0) > 0)
                  .map((p) => (
                    <Badge key={p.id} person={p} portions={it.claims[p.id]} />
                  ))}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t-[1.5px] border-dashed border-line pt-3 text-sm text-ink-2">
          <Row label="Subtotal" value={rp(math.subtotal)} />
          {math.discount > 0 && <Row label="Discount" value={`−${rp(math.discount)}`} />}
          {math.service > 0 && <Row label="Service" value={rp(math.service)} />}
          {math.tax > 0 && <Row label={bill.tax.label || "Tax"} value={rp(math.tax)} />}
          <div className="flex items-baseline pt-1 text-base font-semibold text-ink">
            <span>Total</span>
            <span className="leader" />
            <span className="num">{rp(math.total)}</span>
          </div>
        </div>
      </Slip>

      <div className="flex flex-col items-center gap-2 pt-2">
        <Btn
          className="w-full max-w-[320px]"
          onClick={async () => {
            const ok = await copyText(whatsappText(bill, math, settlement, window.location.href));
            toast.show(ok ? "Message copied" : "Couldn't copy");
          }}
        >
          Copy WhatsApp message
        </Btn>
        <Btn
          kind="ghost"
          onClick={() => {
            saveBill({ ...bill, updatedAt: Date.now() });
            setCurrentId(bill.id);
            router.push("/");
          }}
        >
          Save a copy to my bills
        </Btn>
      </div>
      {toast.node}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[560px] px-5 pb-16">
      <header className="flex h-16 items-center justify-between">
        <Wordmark />
        <span className="text-sm text-ink-2">Split by what you had</span>
      </header>
      <div className="mt-3 space-y-5">{children}</div>
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
