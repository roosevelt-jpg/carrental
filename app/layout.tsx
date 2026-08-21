import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atelier Fleet — Admin",
  description: "WhatsApp sales agent for a luxury car rental business",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-ink font-sans text-cream">{children}</body>
    </html>
  );
}
