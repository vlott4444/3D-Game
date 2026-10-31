import { defineConfig } from "vite";
export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: { "/api": "http://127.0.0.1:" + (process.env.VITE_BACKEND_PORT || "2567") },
  },
  build: { target: "es2022" },
});
