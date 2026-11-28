"use client";

import { useRef, useState } from "react";
import { shrinkImage } from "@/lib/image";
import { rp } from "@/lib/money";
import { lineTotal, type BillMath } from "@/lib/split";
import { uid, type Bill, type Charge } from "@/lib/types";
import { CameraIcon, PlusIcon, XIcon } from "./icons";
import { BrandCard, Btn, Chip, MoneyInput, Sheet, Stepper } from "./ui";

type Props = {
  bill: Bill;
  math: BillMath;
  update: (fn: (b: Bill) => Bill) => void;
  notify: (m: string) => void;
  scanTotal: number | null;
  setScanTotal: (n: number | null) => void;
  onSample: () => void;
};

type ScanResponse = {
  success: boolean;
  error?: string;
  place: string;
  items: { name: string; qty: number; unit: number }[];
  discount: number;
  service: number;
  tax: number;
  taxLabel: string;
  total: number;
};

/** "2x Es teh" or "2 x Es teh" -> qty 2, name "Es teh" */
const OFFLINE_SCAN = "You're offline, and scanning needs internet. Type the items in, or scan when you're back online.";

function parseName(raw: string): { qty: number; name: string } {
  const m = raw.trim().match(/^(\d{1,3})\s*[x×]\s+(.+)$/i);
  return m ? { qty: Math.max(1, Number(m[1])), name: m[2].trim() } : { qty: 1, name: raw.trim() };
}

export function ReceiptStep({ bill, math, update, notify, scanTotal, setScanTotal, onSample }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [sheet, setSheet] = useState<null | "discount" | "service" | "tax">(null);
  const [draftName, setDraftName] = useState("");
  const [draftPrice, setDraftPrice] = useState(0);

  const hasItems = bill.items.length > 0;

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!navigator.onLine) {
      setScanError(OFFLINE_SCAN);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setScanError(null);
    setScanning(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const small = await shrinkImage(file, 1600, 0.85);
      const form = new FormData();
      form.append("image", small, "receipt.jpg");
      const res = await fetch("/api/scan", { method: "POST", body: form, signal: ac.signal });
      const data = (await res.json().catch(() => null)) as ScanResponse | null;
      if (!res.ok || !data?.success) throw new Error(data?.error ?? "The scanner couldn't read it. Type the items in.");
      const items = data.items.map((it) => ({ id: uid(), name: it.name, qty: it.qty, unit: it.unit, claims: {} }));
      update((b) => ({
        ...b,
        title: b.title || data.place,
        items: [...b.items, ...items],
        discount: data.discount ? { mode: "amount", value: data.discount } : b.discount,
        service: data.service ? { mode: "amount", value: data.service } : b.service,
        tax: data.tax ? { mode: "amount", value: data.tax, label: data.taxLabel || "Tax" } : b.tax,
      }));
      setScanTotal(data.total || null);
      notify(`Read ${items.length} item${items.length === 1 ? "" : "s"}. Check them against the receipt.`);
    } catch (e) {
      if (ac.signal.aborted) return;
      // fetch() throws a TypeError when the request never reaches the server.
      if (e instanceof TypeError) setScanError(OFFLINE_SCAN);
      else setScanError(e instanceof Error ? e.message : "Something went wrong. Type the items in.");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function addItem() {
    const { qty, name } = parseName(draftName);
    if (!name) {
      nameRef.current?.focus();
      return;
    }
    if (!draftPrice) {
      notify("Add a price for it");
      return;
    }
    update((b) => ({ ...b, items: [...b.items, { id: uid(), name, qty, unit: draftPrice, claims: {} }] }));
    setDraftName("");
    setDraftPrice(0);
    nameRef.current?.focus();
  }

  const editItem = (id: string, patch: Partial<Bill["items"][number]>) =>
    update((b) => ({ ...b, items: b.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => onFile(e.target.files?.[0])}
    />
  );

  if (scanning) {
    return (
      <Slip>
        <div className="py-14 text-center">
          <p className="font-display text-2xl font-semibold tracking-tight">Reading your receipt…</p>
          <p className="mt-1 text-sm text-ink-2">Usually 5 to 20 seconds.</p>
          <div className="reading mx-auto mt-6 h-[2px] w-40 bg-well" />
          <Btn kind="ghost" className="mt-6" onClick={() => abortRef.current?.abort()}>
            Cancel
          </Btn>
        </div>
      </Slip>
    );
  }

  if (!hasItems && !typing) {
    return (
      <BrandCard>
        {fileInput}
        <div className="px-1 py-9 text-center">
          <h2 className="font-display text-[32px] leading-tight font-extrabold tracking-[-0.03em]">Got the receipt?</h2>
          <p className="mx-auto mt-2 max-w-[280px] text-on-brand-2">
            Snap a photo and we&apos;ll read the items. Or type them in.
          </p>
          <div className="mt-7 flex flex-col items-center gap-2.5">
            <Btn onClick={() => fileRef.current?.click()} className="w-full max-w-[260px]">
              <CameraIcon /> Scan receipt
            </Btn>
            <Btn kind="outline" onClick={() => setTyping(true)} className="w-full max-w-[260px]">
              Type items
            </Btn>
          </div>
          {scanError && (
            <p className="mx-auto mt-4 max-w-[300px] rounded-xl bg-on-brand/10 px-3 py-2 text-sm">{scanError}</p>
          )}
          <Btn kind="ghost" className="mt-5" onClick={onSample}>
            Or look around with a sample bill
          </Btn>
        </div>
      </BrandCard>
    );
  }

  const chargeLabel = (name: string, c: Charge) => (c.mode === "pct" && c.value ? `${name} ${c.value}%` : name);

  return (
    <Slip>
      {fileInput}
      <div className="mb-2 flex items-center justify-between">
        <span className="num text-[11px] tracking-[0.14em] text-ink-2 uppercase">Items</span>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex h-9 items-center gap-1.5 rounded-full px-2 text-sm text-ink-2"
        >
          <CameraIcon /> {hasItems ? "Scan more" : "Scan"}
        </button>
      </div>
      {scanError && <p className="mb-2 text-sm text-stamp">{scanError}</p>}

      <ul>
        {bill.items.map((it) =>
          editing === it.id ? (
            <li key={it.id} className="fade-in -mx-2 my-1 rounded-2xl bg-well/60 p-2">
              <input
                aria-label="Item name"
                autoFocus
                value={it.name}
                onChange={(e) => editItem(it.id, { name: e.target.value.slice(0, 80) })}
                className="h-11 w-full rounded-xl bg-slip px-3 outline-none"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Stepper label="quantity" value={it.qty} min={1} max={999} onChange={(qty) => editItem(it.id, { qty })} />
                <MoneyInput
                  label="Price each"
                  value={it.unit}
                  onChange={(unit) => editItem(it.id, { unit })}
                  className="min-w-0 flex-1 !bg-slip"
                  onEnter={() => setEditing(null)}
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <button
                  className="h-9 px-2 text-sm text-stamp"
                  onClick={() => {
                    update((b) => ({ ...b, items: b.items.filter((x) => x.id !== it.id) }));
                    setEditing(null);
                    notify(`Removed ${it.name || "item"}`);
                  }}
                >
                  Remove
                </button>
                <span className="num text-sm text-ink-2">
                  {it.qty > 1 ? `${it.qty} × ${rp(it.unit)} = ` : ""}
                  {rp(lineTotal(it))}
                </span>
                <Btn kind="outline" className="!h-9 !px-4 !text-sm" onClick={() => {
                  if (!it.name.trim()) editItem(it.id, { name: "Item" });
                  setEditing(null);
                }}>
                  Done
                </Btn>
              </div>
            </li>
          ) : (
            <li key={it.id}>
              <button onClick={() => setEditing(it.id)} className="flex w-full items-baseline py-2.5 text-left">
                <span className="truncate">{it.name}</span>
                {it.qty > 1 && <span className="num ml-1.5 shrink-0 text-xs text-ink-2">×{it.qty}</span>}
                <span className="leader" />
                <span className="num shrink-0">{rp(lineTotal(it))}</span>
              </button>
            </li>
          ),
        )}
      </ul>

      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addItem();
        }}
      >
        <input
          ref={nameRef}
          aria-label="New item name"
          autoFocus={!hasItems}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value.slice(0, 80))}
          placeholder={hasItems ? "Add item" : "e.g. 2x Es teh"}
          className="h-11 min-w-0 flex-1 rounded-xl bg-well px-3 outline-none"
        />
        <MoneyInput label="Price each" value={draftPrice} onChange={setDraftPrice} className="w-[128px] shrink-0" onEnter={addItem} />
        <button
          type="submit"
          aria-label="Add item"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-paper"
        >
          <PlusIcon />
        </button>
      </form>

      {hasItems && (
        <div className="mt-5 border-t-[1.5px] border-dashed border-line pt-3 text-[15px]">
          <Line label="Subtotal" value={rp(math.subtotal)} />
          <Line
            label="Discount"
            value={math.discount ? `−${rp(math.discount)}` : "add"}
            empty={!math.discount}
            onClick={() => setSheet("discount")}
          />
          <Line
            label={chargeLabel("Service", bill.service)}
            value={math.service ? rp(math.service) : "add"}
            empty={!math.service}
            onClick={() => setSheet("service")}
          />
          <Line
            label={chargeLabel(bill.tax.label || "Tax", bill.tax)}
            value={math.tax ? rp(math.tax) : "add"}
            empty={!math.tax}
            onClick={() => setSheet("tax")}
          />
          <div className="mt-3 flex items-baseline border-t-2 border-ink pt-3">
            <span className="font-display text-xl font-semibold">Total</span>
            <span className="leader !border-transparent" />
            <span className="num text-[28px] font-bold tracking-tight">{rp(math.total)}</span>
          </div>
          {scanTotal !== null && scanTotal !== math.total && (
            <p className="mt-2 flex items-start gap-2 text-sm text-ink-2">
              <span className="flex-1">
                The receipt says <span className="num text-ink">{rp(scanTotal)}</span>. Check the items and extras until it
                matches.
              </span>
              <button aria-label="Hide this note" className="h-6 w-6 shrink-0" onClick={() => setScanTotal(null)}>
                <XIcon />
              </button>
            </p>
          )}
        </div>
      )}

      <Sheet open={sheet === "discount"} onClose={() => setSheet(null)} title="Discount">
        <ChargeEditor
          value={bill.discount}
          onChange={(discount) => update((b) => ({ ...b, discount }))}
          presets={[{ label: "None", c: { mode: "amount", value: 0 } }]}
        />
        <p className="mt-3 text-sm text-ink-2">Split in proportion to what each person ordered.</p>
      </Sheet>
      <Sheet open={sheet === "service"} onClose={() => setSheet(null)} title="Service charge">
        <ChargeEditor
          value={bill.service}
          onChange={(service) => update((b) => ({ ...b, service }))}
          presets={[
            { label: "None", c: { mode: "pct", value: 0 } },
            { label: "5%", c: { mode: "pct", value: 5 } },
            { label: "10%", c: { mode: "pct", value: 10 } },
          ]}
        />
      </Sheet>
      <Sheet open={sheet === "tax"} onClose={() => setSheet(null)} title="Tax">
        <ChargeEditor
          value={bill.tax}
          onChange={(c) => update((b) => ({ ...b, tax: { ...b.tax, ...c } }))}
          presets={[
            { label: "None", c: { mode: "pct", value: 0 }, taxLabel: "Tax" },
            { label: "PB1 10%", c: { mode: "pct", value: 10 }, taxLabel: "PB1" },
            { label: "PPN 11%", c: { mode: "pct", value: 11 }, taxLabel: "PPN" },
          ]}
          onPreset={(taxLabel) => update((b) => ({ ...b, tax: { ...b.tax, label: taxLabel } }))}
          activeLabel={bill.tax.label}
        />
        <label className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-well/60 px-4 py-3">
          <span>
            <span className="block font-medium">Service is taxed</span>
            <span className="text-sm text-ink-2">Most Indonesian receipts add tax on top of service.</span>
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-ink"
            checked={bill.serviceTaxed}
            onChange={(e) => update((b) => ({ ...b, serviceTaxed: e.target.checked }))}
          />
        </label>
        <p className="mt-3 text-sm text-ink-2">Restaurants usually charge PB1 (10%). Shops charge PPN.</p>
      </Sheet>
    </Slip>
  );
}

export function Slip({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-[22px] border border-line/70 bg-slip px-5 py-5 shadow-[0_1px_0_rgba(26,24,20,0.04),0_18px_40px_-24px_rgba(26,24,20,0.28)]">
      {children}
    </section>
  );
}

function Line({ label, value, onClick, empty }: { label: string; value: string; onClick?: () => void; empty?: boolean }) {
  const inner = (
    <>
      <span>{label}</span>
      <span className="leader" />
      <span className={empty ? "text-sm text-ink-2 underline decoration-line underline-offset-4" : "num"}>{value}</span>
    </>
  );
  return onClick ? (
    <button onClick={onClick} className="flex w-full items-baseline py-1.5 text-left text-ink-2">
      {inner}
    </button>
  ) : (
    <div className="flex items-baseline py-1.5 text-ink-2">{inner}</div>
  );
}

function ChargeEditor({
  value,
  onChange,
  presets,
  onPreset,
  activeLabel,
}: {
  value: Charge;
  onChange: (c: Charge) => void;
  presets: { label: string; c: Charge; taxLabel?: string }[];
  onPreset?: (taxLabel: string) => void;
  activeLabel?: string;
}) {
  const isPreset = (p: (typeof presets)[number]) =>
    p.c.mode === value.mode && p.c.value === value.value && (!p.taxLabel || !value.value || p.taxLabel === activeLabel);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Chip
            key={p.label}
            active={isPreset(p)}
            onClick={() => {
              onChange(p.c);
              if (p.taxLabel) onPreset?.(p.taxLabel);
            }}
          >
            {p.label}
          </Chip>
        ))}
      </div>
      <p className="mt-5 mb-2 text-sm text-ink-2">Or enter what the receipt says</p>
      <div className="flex items-center gap-2">
        <div className="flex rounded-full bg-well p-1" role="group" aria-label="Amount or percent">
          {(["amount", "pct"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={value.mode === m}
              onClick={() => onChange({ mode: m, value: 0 })}
              className={`h-9 rounded-full px-3.5 text-sm font-medium ${value.mode === m ? "bg-ink text-paper" : "text-ink-2"}`}
            >
              {m === "amount" ? "Rp" : "%"}
            </button>
          ))}
        </div>
        {value.mode === "amount" ? (
          <MoneyInput label="Amount" value={value.value} onChange={(v) => onChange({ mode: "amount", value: v })} className="flex-1" />
        ) : (
          <span className="flex flex-1 items-center rounded-xl bg-well px-3">
            <input
              aria-label="Percent"
              inputMode="decimal"
              value={value.value || ""}
              placeholder="0"
              onChange={(e) => {
                const v = parseFloat(e.target.value.replace(",", "."));
                onChange({ mode: "pct", value: Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0 });
              }}
              className="num h-11 w-full bg-transparent text-right outline-none"
            />
            <span className="num pl-1 text-sm text-ink-3">%</span>
          </span>
        )}
      </div>
    </div>
  );
}
