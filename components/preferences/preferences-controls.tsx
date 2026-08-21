"use client";

import { LOCALES } from "@/lib/i18n/locales";
import { usePreferences } from "@/components/preferences/preferences-provider";

export function PreferencesControls({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, theme, setTheme, translationAvailable } = usePreferences();

  return (
    <div className="flex items-center gap-2" data-no-translate>
      <button
        type="button"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-current/20 bg-black/10 text-current transition hover:border-gold hover:text-gold-2"
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs">◎</span>
        <select
          aria-label="Language"
          value={locale}
          onChange={(event) => setLocale(event.target.value)}
          className={`${compact ? "max-w-32" : "max-w-44"} h-10 appearance-none rounded-full border border-current/20 bg-black/10 py-0 pl-8 pr-8 text-xs text-current`}
          title={translationAvailable === false ? "Configure Claude in Integrations to translate this language" : "Language"}
        >
          {LOCALES.map((item) => (
            <option key={item.code} value={item.code}>{item.name}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px]">⌄</span>
      </div>
    </div>
  );
}

function SunIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg>;
}

function MoonIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20 15.4A8.5 8.5 0 0 1 8.6 4a8.5 8.5 0 1 0 11.4 11.4Z"/></svg>;
}
