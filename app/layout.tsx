import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import { getAppBaseUrl } from "@/lib/env";
import { PreferencesProvider } from "@/components/preferences/preferences-provider";
import { getLocale, LOCALE_COOKIE, THEME_COOKIE, type ThemePreference } from "@/lib/i18n/locales";
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
  title: "Business administration",
  description: "WhatsApp sales agent administration",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const theme: ThemePreference = cookieStore.get(THEME_COOKIE)?.value === "light" ? "light" : "dark";
  const locale = getLocale(cookieStore.get(LOCALE_COOKIE)?.value ?? "en");
  return (
    <html
      lang={locale.code}
      dir={locale.rtl ? "rtl" : "ltr"}
      data-theme={theme}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${outfit.variable} ${cormorant.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full bg-ink font-sans text-cream">
        <PreferencesProvider initialLocale={locale.code} initialTheme={theme}>
          {children}
        </PreferencesProvider>
      </body>
    </html>
  );
}
