/**
 * Client-side environment validation. Runs once at startup (main.tsx).
 * Only public (VITE_*) variables belong here — never import secrets.
 */
const REQUIRED = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"] as const;

export function validateClientEnv(): void {
  const missing: string[] = [];
  for (const key of REQUIRED) {
    const v = import.meta.env[key];
    if (v == null || String(v).trim() === "") {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `[MUSHIN] Missing required environment variables: ${missing.join(", ")}. ` +
        "Set them in your hosting provider or .env.local and redeploy.",
    );
  }
}
