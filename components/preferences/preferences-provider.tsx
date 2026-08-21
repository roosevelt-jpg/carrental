"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getLocale,
  LOCALE_COOKIE,
  THEME_COOKIE,
  type ThemePreference,
} from "@/lib/i18n/locales";

type PreferencesContextValue = {
  locale: string;
  setLocale: (locale: string) => void;
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  translationAvailable: boolean | null;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);
const originalText = new WeakMap<Text, string>();

export function PreferencesProvider({
  children,
  initialLocale,
  initialTheme,
}: {
  children: ReactNode;
  initialLocale: string;
  initialTheme: ThemePreference;
}) {
  const [locale, setLocaleState] = useState(initialLocale);
  const [theme, setThemeState] = useState<ThemePreference>(initialTheme);
  const [translationAvailable, setTranslationAvailable] = useState<boolean | null>(null);

  const setTheme = useCallback((value: ThemePreference) => {
    setThemeState(value);
    document.documentElement.dataset.theme = value;
    document.cookie = `${THEME_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
    localStorage.setItem(THEME_COOKIE, value);
  }, []);

  const setLocale = useCallback((value: string) => {
    const selected = getLocale(value);
    setLocaleState(selected.code);
    document.documentElement.lang = selected.code;
    document.documentElement.dir = selected.rtl ? "rtl" : "ltr";
    document.cookie = `${LOCALE_COOKIE}=${selected.code}; path=/; max-age=31536000; samesite=lax`;
    localStorage.setItem(LOCALE_COOKIE, selected.code);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let applying = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const translate = async () => {
      if (applying || cancelled) return;
      const nodes = collectTextNodes();
      applying = true;
      for (const node of nodes) {
        const source = originalText.get(node);
        if (source !== undefined && node.data !== source) node.data = source;
      }

      if (locale === "en") {
        setTranslationAvailable(null);
        applying = false;
        return;
      }

      const unique = [...new Set(nodes.map((node) => originalText.get(node) ?? node.data))];
      const translated = new Map<string, string>();
      try {
        for (let index = 0; index < unique.length; index += 40) {
          const texts = unique.slice(index, index + 40);
          const response = await fetch("/api/i18n/translate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ locale, texts }),
          });
          const body = (await response.json()) as { translations?: string[] };
          if (!response.ok || !body.translations) throw new Error("Translation unavailable");
          texts.forEach((text, offset) => translated.set(text, body.translations?.[offset] ?? text));
        }
        if (!cancelled) {
          for (const node of nodes) {
            const source = originalText.get(node) ?? node.data;
            node.data = translated.get(source) ?? source;
          }
          setTranslationAvailable(true);
        }
      } catch {
        if (!cancelled) setTranslationAvailable(false);
      } finally {
        applying = false;
      }
    };

    const schedule = () => {
      if (applying) return;
      clearTimeout(timer);
      timer = setTimeout(translate, 180);
    };
    const observer = new MutationObserver(schedule);
    document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((root) => {
      observer.observe(root, { childList: true, subtree: true });
    });
    void translate();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, theme, setTheme, translationAvailable }),
    [locale, setLocale, theme, setTheme, translationAvailable],
  );
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider");
  return value;
}

function collectTextNodes() {
  const nodes: Text[] = [];
  const roots = document.querySelectorAll<HTMLElement>("[data-i18n]");
  roots.forEach((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        const text = node.textContent?.trim() ?? "";
        if (
          !parent ||
          parent.closest("[data-no-translate]") ||
          ["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA", "SELECT", "OPTION"].includes(parent.tagName) ||
          text.length < 2 ||
          text.length > 500 ||
          !/[A-Za-z]/.test(text) ||
          /^[-+\d\s.,:()%/]+$/.test(text)
        ) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node = walker.nextNode();
    while (node) {
      const textNode = node as Text;
      if (!originalText.has(textNode)) originalText.set(textNode, textNode.data);
      nodes.push(textNode);
      node = walker.nextNode();
    }
  });
  return nodes;
}
