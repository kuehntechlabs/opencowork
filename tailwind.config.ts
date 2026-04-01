import type { Config } from "tailwindcss";

export default {
  content: ["./src/renderer/**/*.{html,tsx,ts}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "var(--color-surface)",
          secondary: "var(--color-surface-secondary)",
          tertiary: "var(--color-surface-tertiary)",
          hover: "var(--color-surface-hover)",
        },
        border: {
          DEFAULT: "var(--color-border)",
          secondary: "var(--color-border-secondary)",
        },
        text: {
          DEFAULT: "var(--color-text)",
          secondary: "var(--color-text-secondary)",
          tertiary: "var(--color-text-tertiary)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          text: "var(--color-accent-text)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
