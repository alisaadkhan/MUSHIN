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

  return await supabase.functions.invoke<T>(functionName, {
    ...(args ?? {}),
    headers: {
      ...(args as any)?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  } as any);
}

