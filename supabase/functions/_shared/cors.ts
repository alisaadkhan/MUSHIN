const APP_URL = Deno.env.get("APP_URL") || "https://mushin.app";
const ALLOWED_PREVIEW_ORIGINS = new Set(
  (Deno.env.get("ALLOWED_PREVIEW_ORIGINS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

function isVercelOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "vercel.app" || host.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = new Set<string>([
    APP_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...ALLOWED_PREVIEW_ORIGINS,
  ]);

  return {
    "Access-Control-Allow-Origin": allowed.has(origin) || isVercelOrigin(origin) ? origin : APP_URL,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

