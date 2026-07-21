import type { Config } from "tailwindcss";

// Palette lifted from the physical Ras El-Mal kit itself (deep ledger-green
// cover, gold foil title, cream card stock) rather than a generic AI
// default — this is the game's own visual identity, reused intentionally.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ledger: {
          950: "#0c231b",
          900: "#123529",
          800: "#1a4d3a",
          700: "#235e46",
        },
        parchment: {
          50: "#FAF6EC",
          100: "#F3ECD9",
          200: "#E9DEBF",
        },
        gold: {
          400: "#D4AF6A",
          500: "#C0973F",
          600: "#A67A2E",
        },
        rose: {
          600: "#9C3B3B",
        },
      },
      fontFamily: {
        display: ["'Cormorant Garamond'", "Georgia", "serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        card: "10px",
      },
    },
  },
  plugins: [],
} satisfies Config;
