/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#05070a",
          900: "#0a0e14",
          850: "#0e131b",
          800: "#131a24",
          700: "#1b2430",
          600: "#26313f",
          500: "#3a4759",
        },
        accent: {
          DEFAULT: "#3b82f6",
          dim: "#1d4ed8",
        },
        status: {
          ok: "#22c55e",
          risk: "#f59e0b",
          critical: "#ef4444",
          info: "#38bdf8",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
      },
    },
  },
  plugins: [],
};
