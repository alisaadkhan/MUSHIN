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
    // SECURITY: fail CLOSED in production. Missing rate-limit control plane must not
    // turn into an unlimited-abuse vulnerability.
    const isDev = Deno.env.get("ENVIRONMENT") === "development";
    if (isDev && error.message?.includes("function") && error.message?.includes("does not exist")) {
      console.warn("[global_rate_limit] RPC check_api_rate_limit not found (dev). Failing open.");
      return { allowed: true, retryAfter: 0, remaining: 999 };
    }
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
