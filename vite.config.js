import { defineConfig } from "vite";

export default defineConfig({
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
