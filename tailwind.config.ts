import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      // The six-step scale defined in globals.css. Use these on /risk instead of
      // arbitrary text-[12.5px] values — half-pixel steps are invisible as
      // hierarchy under body{zoom:1.125} and only cost glyph crispness.
      fontSize: {
        micro: ["var(--fs-micro)", { lineHeight: "1.35" }],
        small: ["var(--fs-small)", { lineHeight: "1.45" }],
        body: ["var(--fs-body)", { lineHeight: "1.6" }],
        lede: ["var(--fs-lede)", { lineHeight: "1.4" }],
        h2: ["var(--fs-h2)", { lineHeight: "1.25" }],
        h1: ["var(--fs-h1)", { lineHeight: "1.15" }],
        kpi: ["var(--fs-kpi)", { lineHeight: "1.15" }],
        "kpi-lg": ["var(--fs-kpi-lg)", { lineHeight: "1.1" }],
      },
      colors: {
        ink: {
          DEFAULT: "#1a1d21", // 16.9:1 on surface
          muted: "#5c636b", //  6.08:1 — labels, captions, column headers
          // 4.83:1 on #fff and 4.55:1 on canvas — clears AA for normal text.
          // Was #8b929b (3.14:1), which failed AA everywhere it was used, and it
          // was used for every label, heading and column header in the app.
          faint: "#6b7280",
        },
        line: "#e7e9ec",
        surface: "#ffffff",
        canvas: "#f7f8fa",
        positive: "#0a7a42",
        negative: "#c23321",
        accent: "#1f4ed8",
      },
    },
  },
  plugins: [],
};

export default config;
