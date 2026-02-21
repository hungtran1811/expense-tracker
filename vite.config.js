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
          if (normalized.includes("/src/features/weeklyReview/")) return "feature-weekly-review";
          if (normalized.includes("/src/features/dashboard/")) return "feature-dashboard";
          if (normalized.includes("/src/services/api/ai")) return "feature-ai-services";
          return undefined;
        },
      },
    },
  },
});
