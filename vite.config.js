import { defineConfig } from "vite";

// ... nếu bạn có plugin React hay gì đó giữ nguyên

export default defineConfig({
  // plugins: [...],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000", // backend Express
        changeOrigin: true,
      },
    },
  },
});
