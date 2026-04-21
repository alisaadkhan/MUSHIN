import { supabase } from "@/integrations/supabase/client";

type InvokeArgs = Parameters<typeof supabase.functions.invoke>[1];

/**
 * Invoke a Supabase edge function with an explicit user JWT.
 * This avoids intermittent 401s when the client hasn't attached the
 * Authorization header yet (race during session hydration / redirects).
 */
export async function invokeEdgeAuthed<T = any>(
  functionName: string,
  args?: InvokeArgs,
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

  // Use direct fetch so we ALWAYS have status + response body (supabase-js sometimes
  // collapses non-2xx into a generic error without exposing the response payload).
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      ...(args as any)?.headers,
    },
    body: (args as any)?.body ? JSON.stringify((args as any).body) : undefined,
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

