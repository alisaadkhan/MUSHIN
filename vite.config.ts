import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Source maps for production error monitoring (Sentry, etc.)
    sourcemap: true,
    // Increase limit since we're now properly splitting
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — never changes, max cache lifetime
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // Query / state management
          "vendor-query": ["@tanstack/react-query"],
          // Animation library — large, only used in LandingPage
          "vendor-motion": ["framer-motion"],
          // Supabase client
          "vendor-supabase": ["@supabase/supabase-js"],
          // Radix UI / shadcn components shared across the app
          // Note: @radix-ui/react-accordion is intentionally excluded — it's
          // lazy-loaded via LandingFaq for deferred parsing on landing page.
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-tabs",
            "@radix-ui/react-select",
            "@radix-ui/react-popover",
          ],
          // Charting library — only used in Analytics/Admin pages
          "vendor-charts": ["recharts"],
        },
      },
    },
  },
}));
