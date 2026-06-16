import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy /api → backend (server/) en développement et en preview, pour des
// requêtes same-origin (pas de CORS) côté navigateur.
const proxy = {
  "/api": { target: "http://localhost:4000", changeOrigin: true },
  // Messagerie temps réel : proxy WebSocket vers le backend.
  "/ws": { target: "ws://localhost:4000", ws: true, changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: "@", replacement: "/src" }],
  },
  server: { proxy },
  preview: { proxy },
});
