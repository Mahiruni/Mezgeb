import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LedgerProvider } from "./providers";

export const metadata: Metadata = {
  title: "Mezgeb መዝገብ — Your daily business ledger",
  description: "Record sales and expenses, organize Dube credit, and prepare VAT receipts with Mezgeb, built for Ethiopian businesses.",
  applicationName: "Mezgeb",
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false }
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#001F38" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><LedgerProvider>{children}</LedgerProvider></body></html>;
}
