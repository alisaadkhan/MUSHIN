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
    // Source maps only in development — never in production (security: prevents business logic exposure via DevTools)
    // For production error monitoring, use Sentry's private source-map upload: https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/
    sourcemap: process.env.NODE_ENV !== 'production',
    // Increase chunk size limit to suppress warnings (we use code splitting)
    chunkSizeWarningLimit: 1500,
    // Fix white screen - ensure proper loading
    minify: 'esbuild',
    target: 'esnext',
    rollupOptions: {
      output: {
        // Improve caching and reduce white screen
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
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
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-tabs",
            "@radix-ui/react-select",
            "@radix-ui/react-accordion",
            "@radix-ui/react-popover",
          ],
          // Charting library — only used in Analytics/Admin pages
          "vendor-charts": ["recharts"],
        },
      },
    },
  },
}));
