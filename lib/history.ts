"use client";

import type { Bill } from "./types";

const BILLS = "patungan_bills";
const CURRENT = "patungan_current";
const QRIS = "patungan_qris";
const MAX_BILLS = 30;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function listBills(): Bill[] {
  const bills = read<Bill[]>(BILLS, []);
  return Array.isArray(bills) ? bills.sort((a, b) => b.updatedAt - a.updatedAt) : [];
}

export function getBill(id: string): Bill | undefined {
  return listBills().find((b) => b.id === id);
}

/** Only bills with at least one item are worth keeping. */
export function saveBill(bill: Bill): void {
  if (bill.items.length === 0) return;
  const others = listBills().filter((b) => b.id !== bill.id);
  const next = [bill, ...others].slice(0, MAX_BILLS);
  try {
    localStorage.setItem(BILLS, JSON.stringify(next));
  } catch {
    /* storage full or blocked: the bill still works for this visit */
  }
}

export function deleteBill(id: string): void {
  localStorage.setItem(BILLS, JSON.stringify(listBills().filter((b) => b.id !== id)));
  if (getCurrentId() === id) localStorage.removeItem(CURRENT);
}

export const getCurrentId = () => (typeof window === "undefined" ? null : localStorage.getItem(CURRENT));
export const setCurrentId = (id: string) => localStorage.setItem(CURRENT, id);

/** The payer's QRIS image stays on this device only; it is never put in a link. */
export const getQris = () => read<string | null>(QRIS, null);
export function setQris(dataUrl: string | null): boolean {
  try {
    if (dataUrl) localStorage.setItem(QRIS, JSON.stringify(dataUrl));
    else localStorage.removeItem(QRIS);
    return true;
  } catch {
    return false;
  }
}

export const clearCurrentId = () => localStorage.removeItem(CURRENT);
