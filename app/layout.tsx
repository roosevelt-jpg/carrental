import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import { getAppBaseUrl } from "@/lib/env";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getAppBaseUrl()),
  title: "Atelier Fleet — Admin",
  description: "WhatsApp sales agent for a luxury car rental business",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${cormorant.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full bg-ink font-sans text-cream">{children}</body>
    </html>
  );
}
