import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/noto-sans-ethiopic";
import "./globals.css";
import "./safe-areas.css";
import "./signature-v2.css";
import { LedgerProvider } from "./providers";
import { ServiceWorker } from "@/components/service-worker";
import { SyncProvider } from "./sync-provider";

export const metadata: Metadata = {
  title: "Mezgeb መዝገብ — Signature Edition",
  description: "Record sales and expenses, organize Dube credit, and prepare VAT receipts with Mezgeb, built for Ethiopian businesses.",
  applicationName: "Mezgeb",
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false }
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#e0e5fb" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><LedgerProvider><SyncProvider><ServiceWorker />{children}</SyncProvider></LedgerProvider></body></html>;
}
