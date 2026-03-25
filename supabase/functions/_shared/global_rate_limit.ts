import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type GlobalRateLimitInput = {
  userId?: string | null;
  ipAddress?: string | null;
  endpoint: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
};

export type GlobalRateLimitResult = {
  allowed: boolean;
  retryAfter: number;
  remaining: number;
  reason?: string;
};

export async function enforceGlobalRateLimit(input: GlobalRateLimitInput): Promise<GlobalRateLimitResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const client = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.rpc("check_api_rate_limit", {
    p_user_id: input.userId ?? null,
    p_ip_address: input.ipAddress ?? null,
    p_endpoint: input.endpoint,
    p_is_admin: Boolean(input.isAdmin),
    p_is_super_admin: Boolean(input.isSuperAdmin),
  });

  if (error) {
    throw error;
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  return {
    allowed: Boolean(payload.allowed),
    retryAfter: Number(payload.retry_after ?? 0),
    remaining: Number(payload.remaining ?? 0),
    reason: typeof payload.reason === "string" ? payload.reason : undefined,
  };
}
