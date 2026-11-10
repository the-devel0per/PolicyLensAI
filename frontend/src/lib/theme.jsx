import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const KEY = "pl-theme";
const COLORS = { dark: "#0c0a1d", light: "#f5f4fd" };
const ThemeContext = createContext(null);

const stored = () => {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => (document.documentElement.dataset.theme === "light" ? "light" : "dark"));
  const [explicit, setExplicit] = useState(() => stored() !== null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.getElementById("theme-color-meta")?.setAttribute("content", COLORS[theme]);
  }, [theme]);

  // Follow the OS until the person picks a theme themselves.
  useEffect(() => {
    if (explicit) return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setTheme(mq.matches ? "light" : "dark");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [explicit]);

  // Always print on the light palette so the PDF is readable and ink-friendly.
  useEffect(() => {
    let before = null;
    const onBefore = () => {
      before = document.documentElement.dataset.theme;
      document.documentElement.dataset.theme = "light";
    };
    const onAfter = () => {
      if (before) document.documentElement.dataset.theme = before;
      before = null;
    };
    window.addEventListener("beforeprint", onBefore);
    window.addEventListener("afterprint", onAfter);
    return () => {
      window.removeEventListener("beforeprint", onBefore);
      window.removeEventListener("afterprint", onAfter);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setExplicit(true);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage unavailable: theme still applies for this session */
    }
  }, [theme]);

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
