import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  const isProduction = mode === "production";

  // Use the deployed backend URL for production builds, otherwise use the local server.
  const BACKEND_URL = isProduction
    ? "http://localhost:3000"
    : "http://localhost:3000";

  return {
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
    },
    plugins: [dyadComponentTagger(), react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
