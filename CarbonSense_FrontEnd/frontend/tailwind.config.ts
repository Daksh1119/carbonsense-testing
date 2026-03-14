import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#0bd5b0",
        "background-light": "#f5f8f8",
        "background-dark": "#0a0f18",
        "navy-muted": "#16252d",
        "navy-border": "#1e3a3a",
        "navy-deep": "#0a1614",
        "navy-card": "#162925",
        "neutral-text": "#E5E7EB",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
    },
  },
  plugins: [],
};

export default config;
