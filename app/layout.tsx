import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["600", "800"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500", "700"] });

const description =
  "Scan the receipt, tap what everyone had, and get the fewest transfers. Tax and service split fairly, in rupiah.";

export const metadata: Metadata = {
  // Absolute base so the link-preview image URL works in WhatsApp and other apps.
  metadataBase: new URL("https://bill-splitter-kappa-three.vercel.app"),
  title: "Patungan · split the bill by what you had",
  description,
  openGraph: {
    title: "Patungan · split the bill by what you had",
    description,
    siteName: "Patungan",
    type: "website",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: "Patungan · split the bill by what you had", description },
};

export const viewport: Viewport = {
  themeColor: "#f4efe4",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable} ${jetbrains.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
