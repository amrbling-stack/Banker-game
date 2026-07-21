import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the "@/*" path in tsconfig.json — Vite needs its own alias
      // entry since it doesn't read tsconfig paths at build time.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Ras El-Mal Companion",
        short_name: "Ras El-Mal",
        description: "Digital banker for the Ras El-Mal board game.",
        theme_color: "#123529",
        background_color: "#FAF6EC",
        display: "standalone",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
