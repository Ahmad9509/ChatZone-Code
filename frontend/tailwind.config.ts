import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-bg)",
        surface: "var(--color-surface)",
        "surface-subtle": "var(--color-surface-subtle)",
        border: "var(--color-border)",
        shadow: "var(--color-shadow)",
        accent: "var(--color-accent)",
        "accent-soft": "var(--color-accent-soft)",
        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        "text-muted": "var(--color-text-muted)",
      },
      boxShadow: {
        card: "var(--shadow-soft-elevated)",
        "soft-elevated": "var(--shadow-soft-elevated)",
        "soft-pressed": "var(--shadow-soft-pressed)",
        "soft-hover": "var(--shadow-soft-hover)",
      },
      fontFamily: {
        sans: ["var(--font-primary)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        xl: "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
