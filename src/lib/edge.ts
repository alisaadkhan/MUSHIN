import { supabase } from "@/integrations/supabase/client";

type InvokeArgs = Parameters<typeof supabase.functions.invoke>[1];

/**
 * Invoke a Supabase Edge Function with only the anon (publishable) key.
 * Use for intentionally public endpoints (e.g. password auth rate limiting before sign-in).
 */
export async function invokeEdgePublic<T = unknown>(
  functionName: string,
  body?: Record<string, unknown>,
): Promise<{ data: T | null; error: { message: string; status?: number; body?: unknown } | null }> {
  const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const res = await fetch(base, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
    },
    body: JSON.stringify(body ?? {}),
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { error: text?.trim() || `Non-JSON response (${res.status})` };
  }

  const j = json as Record<string, unknown> | null;

  if (!res.ok) {
    const msg =
      (typeof j?.error === "string" && j.error.trim() ? j.error : null) ??
      (text?.trim() ? text.trim().slice(0, 280) : null) ??
      `Request failed (${res.status})`;

    return {
      data: null,
      error: { message: msg, status: res.status, body: j },
    };
  }

  return { data: json as T, error: null };
}

export type InvokeEdgeAuthedOptions = InvokeArgs & {
  /** Default POST. Use GET for functions that only implement GET (e.g. admin-get-audit-log). */
  method?: "GET" | "POST";
  /** Appended to function URL for GET (?a=b) */
  search?: string | Record<string, string>;
};

/**
 * Invoke a Supabase edge function with an explicit user JWT.
 * This avoids intermittent 401s when the client hasn't attached the
 * Authorization header yet (race during session hydration / redirects).
 */
export async function invokeEdgeAuthed<T = any>(
  functionName: string,
  args?: InvokeEdgeAuthedOptions,
): Promise<{ data: T; error: any }> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;

  // Fail loudly if there is no session yet (prevents confusing "Unauthorized" loops).
  if (!token) {
    return {
      data: null as unknown as T,
      error: {
        message: "No active session. Please sign in at /admin/login.",
        status: 401,
        context: { status: 401, body: { error: "No active session. Please sign in at /admin/login." } },
      },
    };
  }

  const method = (args as InvokeEdgeAuthedOptions | undefined)?.method ?? "POST";
  let search = "";
  const q = (args as InvokeEdgeAuthedOptions | undefined)?.search;
  if (q) {
    if (typeof q === "string") {
      search = q.startsWith("?") ? q : `?${q}`;
    } else {
      const u = new URLSearchParams(q);
      search = `?${u.toString()}`;
    }
  }

  // Use direct fetch so we ALWAYS have status + response body (supabase-js sometimes
  // collapses non-2xx into a generic error without exposing the response payload).
  const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;
  const url = method === "GET" ? `${base}${search}` : base;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const res = await fetch(url, {
    method,
    headers: {
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      ...(args as any)?.headers,
    },
    body:
      method === "POST" && (args as any)?.body
        ? JSON.stringify((args as any).body)
        : undefined,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { error: text || `Non-JSON response (${res.status})` };
  }

  if (!res.ok) {
    const fallbackMsg =
      (typeof json?.error === "string" && json.error.trim() ? json.error : null) ??
      (text?.trim() ? text.trim().slice(0, 280) : null) ??
      `Edge Function error (${res.status})`;

    return {
      data: null as unknown as T,
      error: {
        message: fallbackMsg,
        status: res.status,
        context: { status: res.status, body: json },
      },
    };
  }

  return { data: json as T, error: null };
}

