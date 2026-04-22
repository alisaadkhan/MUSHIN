import { validateClientEnv } from "./env";
validateClientEnv();

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./lib/sentry";
import { initPostHog } from "./lib/analytics";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

initSentry();
initPostHog();

/** Remove the initial loading screen from index.html. 
 *  Called from module scope — CSP-safe, always fires. */
function hideLoadingScreen() {
  const el = document.getElementById("loading-screen");
  if (!el) return;
  el.style.transition = "opacity 0.25s ease";
  el.style.opacity = "0";
  setTimeout(() => { el.remove(); }, 280);
}

const root = document.getElementById("root");
if (!root) {
  document.body.innerHTML =
    '<div style="color:white;background:#7c3aed;padding:2rem;font-family:monospace">FATAL: #root missing</div>';
} else {
  try {
    createRoot(root).render(
      <>
        <App />
        <Analytics />
        <SpeedInsights />
      </>
    );
    // Hide after first animation frame so React has painted
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        hideLoadingScreen();
      });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const safe = msg.replace(/[<>&]/g, (c) => ({ "<": "\u003c", ">": "\u003e", "&": "\u0026" }[c]!));
    root.innerHTML = `<div style="color:#f5f5f5;background:#1a1a1a;padding:2rem;font-family:system-ui,sans-serif;min-height:100vh;line-height:1.5">
      <strong style="font-size:1.125rem">Something went wrong</strong><br/><br/>${safe}
    </div>`;
    console.error("[MUSHIN] mount error:", err);
    hideLoadingScreen();
  }
}

// Hard fallback — never leave users stuck after 4 seconds
setTimeout(hideLoadingScreen, 4000);
