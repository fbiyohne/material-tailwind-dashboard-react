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
  build: {
    rollupOptions: {
      output: {
        // Dépendances stables isolées dans un chunk « vendor » : mis en cache
        // par le navigateur d'un déploiement à l'autre (changent rarement) et
        // allègent le bundle applicatif principal.
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom", "@heroicons/react"],
        },
      },
    },
  },
  server: { proxy },
  preview: { proxy },
});
