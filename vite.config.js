import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy /api → backend (server/) en développement et en preview, pour des
// requêtes same-origin (pas de CORS) côté navigateur.
const proxy = {
  "/api": { target: "http://localhost:4000", changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: "@", replacement: "/src" }],
  },
  server: { proxy },
  preview: { proxy },
});
