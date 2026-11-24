"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { groupDigits, parseRp } from "@/lib/money";
import { PERSON_COLORS, type Person } from "@/lib/types";

export const colorOf = (p: Pick<Person, "color">) => PERSON_COLORS[p.color % PERSON_COLORS.length];

export function Dot({ person, size = 10 }: { person: Pick<Person, "color">; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: colorOf(person) }}
    />
  );
}

/** A small initial in the person's colour, used to mark who had an item. */
export function Badge({ person, portions }: { person: Person; portions?: number }) {
  return (
    <span
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] leading-none font-semibold text-white"
      style={{ background: colorOf(person) }}
      title={person.name}
    >
      {person.name.slice(0, 1).toUpperCase()}
      {portions && portions > 1 ? <span className="ml-0.5 opacity-80">×{portions}</span> : null}
    </span>
  );
}

export function Wordmark() {
  return (
    <Link href="/" className="font-display text-[22px] font-extrabold tracking-[-0.04em]">
      patungan<span className="text-ink-3">.</span>
    </Link>
  );
}

export function Btn({
  children,
  onClick,
  kind = "solid",
  className = "",
  disabled,
  type = "button",
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "solid" | "outline" | "ghost";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  "aria-label"?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100";
  const kinds = {
    solid: "bg-ink text-paper h-12 px-6 text-[15px]",
    outline: "border-[1.5px] border-ink h-11 px-5 text-[15px]",
    ghost: "h-9 px-3 text-sm text-ink-2 underline decoration-line underline-offset-4",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${kinds[kind]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

/** Rupiah input: types digits, shows "48.500". */
export function MoneyInput({
  value,
  onChange,
  placeholder = "0",
  className = "",
  autoFocus,
  label,
  onEnter,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  label: string;
  onEnter?: () => void;
}) {
  return (
    <span className={`flex items-center rounded-xl bg-well px-3 ${className}`}>
      <span className="num pr-1 text-sm text-ink-3">Rp</span>
      <input
        aria-label={label}
        inputMode="numeric"
        autoFocus={autoFocus}
        value={groupDigits(value)}
        placeholder={placeholder}
        onChange={(e) => onChange(parseRp(e.target.value))}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        className="num h-11 w-full min-w-0 bg-transparent text-right outline-none"
      />
    </span>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  return (
    <span className="inline-flex items-center rounded-full bg-well" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`Less ${label}`}
        className="h-9 w-9 rounded-full text-lg disabled:opacity-30"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <span className="num w-6 text-center text-sm">{value}</span>
      <button
        type="button"
        aria-label={`More ${label}`}
        className="h-9 w-9 rounded-full text-lg disabled:opacity-30"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </span>
  );
}

export function Chip({
  active,
  onClick,
  children,
  className = "",
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 rounded-full border-[1.5px] px-3.5 text-sm font-medium transition ${
        active ? "border-ink bg-ink text-paper" : "border-line bg-slip text-ink"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/** Bottom sheet on phones, centred card on desktop. Esc and backdrop close it. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-label={title}>
      <button aria-label="Close" className="fade-in absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="sheet-in relative w-full max-w-md rounded-t-3xl bg-slip p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
          <button onClick={onClose} className="h-9 rounded-full px-3 text-sm text-ink-2" aria-label="Close">
            Done
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2600);
  }, []);
  const node = msg ? (
    <div
      role="status"
      className="fade-in pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex justify-center px-4 lg:bottom-8"
    >
      <span className="rounded-full bg-ink px-4 py-2.5 text-sm text-paper shadow-lg">{msg}</span>
    </div>
  ) : null;
  return { show, node };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const buzz = () => {
  // Android only; browsers block it until the person has tapped the page.
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  navigator.vibrate(8);
};
