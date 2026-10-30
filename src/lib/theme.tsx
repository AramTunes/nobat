import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeChoice = "light" | "dark";

const KEY = "nobat.theme";

type Ctx = {
  theme: ThemeChoice;
  setTheme: (next: ThemeChoice) => void;
};

const ThemeContext = createContext<Ctx>({ theme: "light", setTheme: () => {} });

function applyTheme(theme: ThemeChoice) {
  document.documentElement.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0a0a0a" : "#f7f7f5");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("light");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const saved = localStorage.getItem(KEY);
      const next: ThemeChoice = saved === "light" || saved === "dark" ? saved : media.matches ? "dark" : "light";
      applyTheme(next);
      setThemeState(next);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const setTheme = (next: ThemeChoice) => {
    localStorage.setItem(KEY, next);
    applyTheme(next);
    setThemeState(next);
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeSwitch({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className={`grid grid-cols-2 gap-1 rounded-xl bg-paper-deep p-1 ${className}`} role="group" aria-label="حالت نمایش">
      <button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")} className={chip(theme === "light")}>
        روشن
      </button>
      <button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")} className={chip(theme === "dark")}>
        تیره
      </button>
    </div>
  );
}

function chip(on: boolean) {
  return on
    ? "min-h-11 rounded-lg bg-card text-sm font-semibold text-ink"
    : "min-h-11 rounded-lg text-sm font-semibold text-muted";
}
