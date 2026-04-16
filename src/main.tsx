import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./lib/sentry";
import { initPostHog } from "./lib/analytics";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

initSentry();
initPostHog();

/** Hide the loading screen shown in index.html — CSP-safe, runs as a module */
function hideLoadingScreen() {
  const loading = document.getElementById("loading-screen");
  if (!loading || loading.style.display === "none") return;
  loading.style.opacity = "0";
  loading.style.transition = "opacity 0.3s ease";
  setTimeout(() => { loading.style.display = "none"; }, 320);
}

function mountApp() {
  const root = document.getElementById("root");
  if (!root) {
    document.body.innerHTML = '<div style="color:white;background:#7c3aed;padding:2rem;font-family:monospace">FATAL: #root element not found in index.html</div>';
    return;
  }

  try {
    const reactRoot = createRoot(root);
    reactRoot.render(
      <>
        <App />
        <Analytics />
        <SpeedInsights />
      </>
    );
    // Hide loading screen shortly after React paints its first frame
    setTimeout(hideLoadingScreen, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    root.innerHTML = `<div style="color:white;background:#7f1d1d;padding:2rem;font-family:monospace;min-height:100vh">
      <strong style="font-size:1.25rem">React failed to mount</strong><br/><br/>${msg}
    </div>`;
    console.error('[MUSHIN] React mount failed:', err);
    hideLoadingScreen();
  }
}

// Safety fallback: force-hide loading screen after 5s regardless
setTimeout(hideLoadingScreen, 5000);

mountApp();
