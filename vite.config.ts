import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Centralize the backend URL here. Change this if your backend port changes.
const BACKEND_URL = "https://social-bags-drum.loca.lt";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxying
      },
      "/uploads": {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
    },
    allowedHosts: ["happy-areas-dance.loca.lt"],
  },
  plugins: [dyadComponentTagger(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
