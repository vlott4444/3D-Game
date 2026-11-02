import { defineConfig } from "vite";
export default defineConfig({
  plugins: [
    {
      name: "world-assets-no-store",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith("/models/")) res.setHeader("Cache-Control", "no-store");
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith("/models/")) res.setHeader("Cache-Control", "no-store");
          next();
        });
      },
    },
  ],
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: { "/api": "http://127.0.0.1:" + (process.env.VITE_BACKEND_PORT || "2567") },
  },
  build: { target: "es2022" },
});
