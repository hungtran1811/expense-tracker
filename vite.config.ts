import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  // Relative base so Electron file:// and Capacitor WebView resolve assets.
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    proxy: {
      "/.netlify/functions": {
        target: "http://localhost:8899",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = String(id || "").replaceAll("\\", "/");
          if (normalized.includes("/node_modules/firebase/")) return "vendor-firebase";
          if (normalized.includes("/node_modules/")) return "vendor";
          if (normalized.includes("/src/features/")) return "features";
          return undefined;
        },
      },
    },
  },
});
