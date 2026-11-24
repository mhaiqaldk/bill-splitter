"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteBill, listBills, saveBill, setCurrentId } from "@/lib/history";
import { billTitle, shortDate } from "@/lib/message";
import { rp } from "@/lib/money";
import { computeBill } from "@/lib/split";
import { uid, type Bill } from "@/lib/types";
import { Slip } from "./ReceiptStep";
import { Btn, Dot, Sheet, Wordmark, useToast } from "./ui";

export default function History() {
  const router = useRouter();
  const [bills, setBills] = useState<Bill[]>(() => listBills());
  const [confirm, setConfirm] = useState<Bill | null>(null);
  const toast = useToast();

  const open = (b: Bill) => {
    setCurrentId(b.id);
    router.push("/");
  };

  function duplicate(b: Bill) {
    const now = Date.now();
    const copy: Bill = {
      ...b,
      id: uid(),
      title: b.title ? `${b.title} (copy)` : "",
      createdAt: now,
      updatedAt: now,
      settled: [],
    };
    saveBill(copy);
    setBills(listBills());
    toast.show("Copied. Same people and items, nothing marked paid.");
  }

  return (
    <div className="mx-auto max-w-[640px] px-5 pb-16">
      <header className="flex h-16 items-center justify-between">
        <Wordmark />
        <Btn kind="outline" className="!h-9 !px-3.5 !text-sm" onClick={() => router.push("/")}>
          Back to bill
        </Btn>
      </header>
      <h1 className="font-display mt-3 text-[34px] font-extrabold tracking-[-0.035em]">Your bills</h1>
      <p className="mb-5 text-sm text-ink-2">Saved on this device only. The latest 30 are kept.</p>

      {bills.length === 0 ? (
        <Slip>
          <div className="py-10 text-center">
            <h2 className="font-display text-2xl font-semibold tracking-tight">No bills yet</h2>
            <p className="mt-1 text-ink-2">Split your first one and it&apos;ll wait here.</p>
            <Btn className="mt-5" onClick={() => router.push("/")}>
              Start a bill
            </Btn>
          </div>
        </Slip>
      ) : (
        <ul className="space-y-3">
          {bills.map((b) => {
            const math = computeBill(b);
            return (
              <li key={b.id}>
                <Slip>
                  <button onClick={() => open(b)} className="block w-full text-left">
                    <span className="flex items-baseline gap-3">
                      <span className="truncate text-lg font-semibold">{billTitle(b)}</span>
                      <span className="leader" />
                      <span className="num font-semibold">{rp(math.total)}</span>
                    </span>
                    <span className="mt-1.5 flex items-center gap-2 text-sm text-ink-2">
                      <span className="num text-xs">{shortDate(b.createdAt)}</span>
                      <span className="flex -space-x-0.5">
                        {b.people.slice(0, 8).map((p) => (
                          <Dot key={p.id} person={p} size={10} />
                        ))}
                      </span>
                      <span className="truncate">{b.people.map((p) => p.name).join(", ") || "No people yet"}</span>
                    </span>
                  </button>
                  <div className="mt-3 flex gap-1 border-t border-line/60 pt-2">
                    <Btn kind="ghost" className="!px-2" onClick={() => duplicate(b)}>
                      Duplicate
                    </Btn>
                    <Btn kind="ghost" className="!px-2 !text-stamp" onClick={() => setConfirm(b)}>
                      Delete
                    </Btn>
                  </div>
                </Slip>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title="Delete this bill?">
        <p className="text-ink-2">
          “{confirm ? billTitle(confirm) : ""}” will be gone from this device. Links you already shared keep working.
        </p>
        <div className="mt-5 flex gap-2">
          <Btn kind="outline" className="flex-1" onClick={() => setConfirm(null)}>
            Keep it
          </Btn>
          <Btn
            className="flex-1 !bg-stamp"
            onClick={() => {
              if (!confirm) return;
              deleteBill(confirm.id);
              setBills(listBills());
              setConfirm(null);
              toast.show("Deleted");
            }}
          >
            Delete
          </Btn>
        </div>
      </Sheet>
      {toast.node}
    </div>
  );
}
