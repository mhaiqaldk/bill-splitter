import type { Metadata } from "next";
import { SharedClient } from "@/components/client";

export const metadata: Metadata = {
  title: "Your share · Patungan",
  description: "See what you owe and who to pay.",
  robots: { index: false },
};

export default function SharedPage() {
  return <SharedClient />;
}
