import type { Metadata } from "next";
import { HistoryClient } from "@/components/client";

export const metadata: Metadata = { title: "Your bills · Patungan" };

export default function HistoryPage() {
  return <HistoryClient />;
}
