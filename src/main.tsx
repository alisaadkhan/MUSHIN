import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./lib/sentry";
import { initPostHog } from "./lib/analytics";

initSentry();
initPostHog();

function mountApp() {
  const root = document.getElementById("root");
  if (!root) {
    document.body.innerHTML = '<div style="color:white;background:#7c3aed;padding:2rem;font-family:monospace">FATAL: #root element not found in index.html</div>';
    return;
  }
  try {
    createRoot(root).render(<App />);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    root.innerHTML = `<div style="color:white;background:#7f1d1d;padding:2rem;font-family:monospace;min-height:100vh">
      <strong style="font-size:1.25rem">React failed to mount</strong><br/><br/>${msg}
    </div>`;
    console.error('[MUSHIN] React mount failed:', err);
  }
}

mountApp();
