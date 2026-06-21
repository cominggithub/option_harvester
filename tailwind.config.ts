import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        ink: {
          DEFAULT: "#1a1d21",
          muted: "#5c636b",
          faint: "#8b929b",
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
