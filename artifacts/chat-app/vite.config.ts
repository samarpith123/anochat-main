import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  define: {
    'import.meta.env.VITE_SUPABASE_URL':      JSON.stringify(process.env.VITE_SUPABASE_URL    ?? process.env.SUPABASE_URL    ?? ''),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''),
    'import.meta.env.VITE_API_URL':           JSON.stringify(process.env.VITE_API_URL         ?? ''),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      "/api":       { target: "http://localhost:8080", changeOrigin: true },
      "/socket.io": { target: "http://localhost:8080", changeOrigin: true, ws: true },
    },
  },
});
