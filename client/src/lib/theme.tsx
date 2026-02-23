import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "cyberpunk" | "glass" | "neon" | "matrix";

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const THEMES: { id: Theme; label: string; desc: string; preview: string }[] = [
  {
    id: "cyberpunk",
    label: "Cyberpunk",
    desc: "Default neon green on deep black — high-contrast terminal aesthetic.",
    preview: "linear-gradient(135deg,#080808 60%,rgba(74,222,128,0.15) 100%)",
  },
  {
    id: "glass",
    label: "Glassmorphism",
    desc: "Futuristic frosted-glass panels floating over a deep navy gradient.",
    preview: "linear-gradient(135deg,#060d1f 0%,#0d1b3a 50%,#060d1f 100%)",
  },
  {
    id: "neon",
    label: "Neon Purple",
    desc: "Electric violet-purple accent with dark backgrounds.",
    preview: "linear-gradient(135deg,#08000f 60%,rgba(168,85,247,0.2) 100%)",
  },
  {
    id: "matrix",
    label: "Matrix",
    desc: "Pale green on pitch black — classic hacker terminal look.",
    preview: "linear-gradient(135deg,#000400 60%,rgba(0,200,80,0.15) 100%)",
  },
];

export function getThemeTokens(theme: Theme) {
  switch (theme) {
    case "glass":
      return {
        accentRgb: "34,211,238",
        accent: "rgba(34,211,238,1)",
        accentFaded: (a: number) => `rgba(34,211,238,${a})`,
        bg: "#060d1f",
        cardBg: "rgba(255,255,255,0.04)",
        cardBorder: "rgba(255,255,255,0.09)",
        panelBg: "rgba(255,255,255,0.05)",
        sidebarBg: "rgba(6,13,31,0.85)",
        topbarBg: "rgba(6,13,31,0.6)",
        gridColor: "rgba(34,211,238,0.025)",
        backdropBlur: "blur(22px)",
        textPrimary: "#e2f5ff",
        textMuted: "rgba(160,210,240,0.5)",
        glassEffect: true,
      };
    case "neon":
      return {
        accentRgb: "168,85,247",
        accent: "rgba(168,85,247,1)",
        accentFaded: (a: number) => `rgba(168,85,247,${a})`,
        bg: "#07000f",
        cardBg: "rgba(0,0,0,0.4)",
        cardBorder: "rgba(168,85,247,0.2)",
        panelBg: "rgba(20,0,35,0.8)",
        sidebarBg: "rgba(7,0,15,0.95)",
        topbarBg: "rgba(0,0,0,0.55)",
        gridColor: "rgba(168,85,247,0.02)",
        backdropBlur: "blur(12px)",
        textPrimary: "#f5e8ff",
        textMuted: "rgba(200,160,240,0.5)",
        glassEffect: false,
      };
    case "matrix":
      return {
        accentRgb: "0,200,80",
        accent: "rgba(0,200,80,1)",
        accentFaded: (a: number) => `rgba(0,200,80,${a})`,
        bg: "#000400",
        cardBg: "rgba(0,10,2,0.6)",
        cardBorder: "rgba(0,200,80,0.18)",
        panelBg: "rgba(0,8,2,0.85)",
        sidebarBg: "rgba(0,4,0,0.97)",
        topbarBg: "rgba(0,4,0,0.55)",
        gridColor: "rgba(0,200,80,0.025)",
        backdropBlur: "blur(12px)",
        textPrimary: "#c8ffc0",
        textMuted: "rgba(100,200,100,0.5)",
        glassEffect: false,
      };
    default:
      return {
        accentRgb: "74,222,128",
        accent: "rgba(74,222,128,1)",
        accentFaded: (a: number) => `rgba(74,222,128,${a})`,
        bg: "#080808",
        cardBg: "rgba(0,0,0,0.3)",
        cardBorder: "rgba(74,222,128,0.2)",
        panelBg: "rgba(4,4,4,0.92)",
        sidebarBg: "rgba(4,4,4,0.92)",
        topbarBg: "rgba(0,0,0,0.5)",
        gridColor: "rgba(74,222,128,0.02)",
        backdropBlur: "blur(16px)",
        textPrimary: "#ffffff",
        textMuted: "rgba(156,163,175,0.7)",
        glassEffect: false,
      };
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      return (localStorage.getItem("wolfdeploy-theme") as Theme) || "cyberpunk";
    } catch {
      return "cyberpunk";
    }
  });

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem("wolfdeploy-theme", t); } catch {}
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
