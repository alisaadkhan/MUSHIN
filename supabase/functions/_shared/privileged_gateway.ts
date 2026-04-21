import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceGlobalRateLimit } from "./global_rate_limit.ts";
import { getSecret } from "./secrets.ts";

export type WorkspaceRole = "owner" | "admin" | "member";

export type AuthContext = {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
};

function getRequiredEnv(name: string): string {
  const value = getSecret(name, { endpoint: "_shared/privileged_gateway", required: false });
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseUrl(): string {
  return getRequiredEnv("SUPABASE_URL");
}

export function getServiceRoleKey(): string {
  return getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function createPrivilegedClient() {
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createUserClient(authHeader: string) {
  // Prefer anon key for normal user-scoped Auth calls, but fall back to
  // service role if SUPABASE_ANON_KEY isn't available in this runtime.
  // This prevents privileged endpoints from failing with 500 due to missing env.
  let key: string;
  try {
    key = getRequiredEnv("SUPABASE_ANON_KEY");
  } catch {
    key = getServiceRoleKey();
  }

  return createClient(getSupabaseUrl(), key, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireJwt(authHeader: string | null): Promise<{ userId: string; token: string }> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.replace("Bearer ", "");
  const userClient = createUserClient(authHeader);
  const { data: { user }, error } = await userClient.auth.getUser(token);

  if (error || !user) throw new Error("Unauthorized");
  return { userId: user.id, token };
}

export async function requireWorkspaceMembership(
  userId: string,
  requestedWorkspaceId?: string | null,
): Promise<{ workspaceId: string; role: WorkspaceRole }> {
  const privilegedClient = createPrivilegedClient();

  const { data: memberships, error } = await privilegedClient
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId);

  if (error || !memberships || memberships.length === 0) {
    throw new Error("Workspace access denied");
  }

  const target = requestedWorkspaceId
    ? memberships.find((m: any) => m.workspace_id === requestedWorkspaceId)
    : memberships[0];

  if (!target) throw new Error("Workspace access denied");

  return {
    workspaceId: target.workspace_id,
    role: (target.role ?? "member") as WorkspaceRole,
  };
}

export function requireRole(role: WorkspaceRole, allowed: WorkspaceRole[]) {
  if (!allowed.includes(role)) {
    throw new Error("Forbidden");
  }
}

export function sanitizeUuid(input: string | null | undefined): string | null {
  if (!input) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input)
    ? input
    : null;
}

export async function logPrivilegedOperation(params: {
  actorUserId: string;
  action: string;
  workspaceId?: string;
  targetUserId?: string;
  details?: Record<string, unknown>;
}) {
  const privilegedClient = createPrivilegedClient();
  await privilegedClient.from("admin_audit_log").insert({
    admin_user_id: params.actorUserId,
    action: params.action,
    target_user_id: params.targetUserId ?? null,
    details: {
      workspace_id: params.workspaceId ?? null,
      ...(params.details ?? {}),
    },
  });
}

export async function performPrivilegedRead<T>(args: {
  authHeader: string | null;
  requestedWorkspaceId?: string | null;
  allowedRoles?: WorkspaceRole[];
  action: string;
  endpoint?: string;
  ipAddress?: string | null;
  execute: (ctx: AuthContext, client: ReturnType<typeof createPrivilegedClient>) => Promise<T>;
}): Promise<T> {
  const { userId } = await requireJwt(args.authHeader ?? null);
  try {
    const superAdmin = await isSuperAdmin(userId);
    const rateLimit = await enforceGlobalRateLimit({
      userId,
      ipAddress: args.ipAddress ?? null,
      endpoint: args.endpoint ?? args.action,
      isAdmin: true,
      isSuperAdmin: superAdmin,
    });
    if (!rateLimit.allowed) {
      throw new Error(`Rate limit exceeded. Retry after ${rateLimit.retryAfter}s`);
    }
  } catch (rateErr) {
    const isDev = Deno.env.get("ENVIRONMENT") === "development";
    if (isDev) {
      console.warn(
        "[privileged_gateway] global rate-limit unavailable, continuing fail-open (dev only):",
        rateErr,
      );
    } else {
      // SECURITY: do not allow privileged (admin/system) endpoints to bypass
      // rate limiting when the control plane is unhealthy.
      throw new Error("Rate limit unavailable");
    }
  }

  const membership = await requireWorkspaceMembership(userId, args.requestedWorkspaceId);
  if (args.allowedRoles?.length) {
    requireRole(membership.role, args.allowedRoles);
  }

  const ctx: AuthContext = { userId, workspaceId: membership.workspaceId, role: membership.role };
  const client = createPrivilegedClient();
  const result = await args.execute(ctx, client);

  await logPrivilegedOperation({
    actorUserId: userId,
    action: args.action,
    workspaceId: membership.workspaceId,
    details: { mode: "privileged_read" },
  });

  return result;
}

export async function performPrivilegedWrite<T>(args: {
  authHeader: string | null;
  requestedWorkspaceId?: string | null;
  allowedRoles?: WorkspaceRole[];
  action: string;
  endpoint?: string;
  ipAddress?: string | null;
  execute: (ctx: AuthContext, client: ReturnType<typeof createPrivilegedClient>) => Promise<T>;
}): Promise<T> {
  const { userId } = await requireJwt(args.authHeader ?? null);
  try {
    const superAdmin = await isSuperAdmin(userId);
    const rateLimit = await enforceGlobalRateLimit({
      userId,
      ipAddress: args.ipAddress ?? null,
      endpoint: args.endpoint ?? args.action,
      isAdmin: true,
      isSuperAdmin: superAdmin,
    });
    if (!rateLimit.allowed) {
      throw new Error(`Rate limit exceeded. Retry after ${rateLimit.retryAfter}s`);
    }
  } catch (rateErr) {
    const isDev = Deno.env.get("ENVIRONMENT") === "development";
    if (isDev) {
      console.warn(
        "[privileged_gateway] global rate-limit unavailable, continuing fail-open (dev only):",
        rateErr,
      );
    } else {
      // SECURITY: do not allow privileged (admin/system) endpoints to bypass
      // rate limiting when the control plane is unhealthy.
      throw new Error("Rate limit unavailable");
    }
  }

  const membership = await requireWorkspaceMembership(userId, args.requestedWorkspaceId);
  if (args.allowedRoles?.length) {
    requireRole(membership.role, args.allowedRoles);
  }

  const ctx: AuthContext = { userId, workspaceId: membership.workspaceId, role: membership.role };
  const client = createPrivilegedClient();
  const result = await args.execute(ctx, client);

  await logPrivilegedOperation({
    actorUserId: userId,
    action: args.action,
    workspaceId: membership.workspaceId,
    details: { mode: "privileged_write" },
  });

  return result;
}

export async function executeWorkspaceMutation<T>(args: {
  authHeader: string | null;
  requestedWorkspaceId?: string | null;
  allowedRoles?: WorkspaceRole[];
  action: string;
  execute: (workspaceId: string, client: ReturnType<typeof createPrivilegedClient>) => Promise<T>;
}): Promise<T> {
  return performPrivilegedWrite({
    authHeader: args.authHeader,
    requestedWorkspaceId: args.requestedWorkspaceId,
    allowedRoles: args.allowedRoles,
    action: args.action,
    execute: async (ctx, client) => args.execute(ctx.workspaceId, client),
  });
}

export async function executeCreditMutation(args: {
  authHeader: string | null;
  requestedWorkspaceId?: string | null;
  action: "consume_search_credit" | "consume_ai_credit" | "consume_email_credit" | "consume_enrichment_credit";
}) {
  return executeWorkspaceMutation({
    authHeader: args.authHeader,
    requestedWorkspaceId: args.requestedWorkspaceId,
    allowedRoles: ["owner", "admin", "member"],
    action: `credit:${args.action}`,
    execute: async (workspaceId, client) => {
      const { error } = await client.rpc(args.action, { ws_id: workspaceId });
      if (error) throw error;
      return { success: true };
    },
  });
}

export function requireInternalGatewaySecret(req: Request) {
  const secret = getRequiredEnv("INTERNAL_GATEWAY_SECRET");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${secret}`) {
    throw new Error("Unauthorized");
  }
}

export async function requireSystemAdmin(authHeader: string | null): Promise<{ userId: string }> {
  const { userId } = await requireJwt(authHeader);
  const privilegedClient = createPrivilegedClient();

  const { data, error } = await privilegedClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["system_admin", "super_admin"]);

  if (error || !data || data.length === 0) {
    throw new Error("Forbidden");
  }

  return { userId };
}

export async function isSuperAdmin(userId: string): Promise<boolean> {
  const privilegedClient = createPrivilegedClient();
  const { data, error } = await privilegedClient
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function hasUnlimitedCredits(authHeader: string | null): Promise<boolean> {
  const { userId } = await requireJwt(authHeader);
  return isSuperAdmin(userId);
}

type AuditMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

async function appendSystemAuditLog(args: {
  actorUserId: string;
  targetUserId?: string | null;
  workspaceId?: string | null;
  actionType: string;
  actionDescription: string;
  details?: AuditMeta;
}) {
  const privilegedClient = createPrivilegedClient();
  const { error } = await privilegedClient.rpc("append_system_audit_log", {
    p_actor_user_id: args.actorUserId,
    p_target_user_id: args.targetUserId ?? null,
    p_workspace_id: args.workspaceId ?? null,
    p_action_type: args.actionType,
    p_action_description: args.actionDescription,
    p_ip_address: args.details?.ipAddress ?? null,
    p_user_agent: args.details?.userAgent ?? null,
    p_metadata_json: args.details?.metadata ?? {},
  });

  if (error) throw error;
}

export type AdminCreditType = "search" | "ai" | "email" | "enrichment";

export async function adminAdjustCredits(args: {
  authHeader: string | null;
  workspaceId: string;
  creditType: AdminCreditType;
  amountDelta?: number;
  mode?: "adjust" | "set";
  newBalance?: number;
  reason: string;
  idempotencyKey?: string;
  targetUserId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const { userId } = await requireSystemAdmin(args.authHeader);

  if (!sanitizeUuid(args.workspaceId)) {
    throw new Error("Invalid workspaceId");
  }
  const mode = args.mode ?? "adjust";
  if (mode === "adjust") {
    if (!Number.isInteger(args.amountDelta) || (args.amountDelta ?? 0) === 0) {
      throw new Error("amountDelta must be a non-zero integer for adjust mode");
    }
  } else if (mode === "set") {
    if (!Number.isInteger(args.newBalance) || (args.newBalance ?? -1) < 0) {
      throw new Error("newBalance must be a non-negative integer for set mode");
    }
  } else {
    throw new Error("Invalid mode");
  }

  const client = createPrivilegedClient();

  if (!args.targetUserId || !sanitizeUuid(args.targetUserId)) {
    throw new Error("targetUserId is required for ledger credit mutations");
  }

  const { data: mutationResult, error: mutationError } = await client.rpc("admin_mutate_user_credits_ledger", {
    p_target_user_id: args.targetUserId,
    p_workspace_id: args.workspaceId,
    p_credit_type: args.creditType,
    p_mode: mode,
    p_delta: mode === "adjust" ? args.amountDelta ?? null : null,
    p_new_balance: mode === "set" ? args.newBalance ?? null : null,
    p_reason: args.reason,
    p_actor_user_id: userId,
    p_idempotency_key: args.idempotencyKey ?? null,
    p_metadata: {
      ip_address: args.ipAddress ?? null,
      user_agent: args.userAgent ?? null,
    },
  });
  if (mutationError) throw mutationError;

  await appendSystemAuditLog({
    actorUserId: userId,
    targetUserId: args.targetUserId ?? null,
    workspaceId: args.workspaceId,
    actionType: mode === "set" ? "admin:credits:set" : "admin:credits:adjust",
    actionDescription: "System admin adjusted workspace credits",
    details: {
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      metadata: {
        credit_type: args.creditType,
        amount_delta: mode === "adjust" ? args.amountDelta ?? null : null,
        new_balance_target: mode === "set" ? args.newBalance ?? null : null,
        reason: args.reason,
        mutation_result: mutationResult,
        idempotency_key: args.idempotencyKey ?? null,
      },
    },
  });

  return {
    success: true,
    workspaceId: args.workspaceId,
    creditType: args.creditType,
    mode,
    result: mutationResult,
  };
}

export async function adminSetPlan(args: {
  authHeader: string | null;
  workspaceId: string;
  newPlan: string;
  reason: string;
  targetUserId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const { userId } = await requireSystemAdmin(args.authHeader);
  if (!sanitizeUuid(args.workspaceId)) throw new Error("Invalid workspaceId");

  const client = createPrivilegedClient();
  const { data: existingWorkspace, error: existingError } = await client
    .from("workspaces")
    .select("id, plan")
    .eq("id", args.workspaceId)
    .single();
  if (existingError || !existingWorkspace) throw new Error("Workspace not found");

  const previousPlan = existingWorkspace.plan;

  const { error: updateWorkspaceError } = await client
    .from("workspaces")
    .update({ plan: args.newPlan })
    .eq("id", args.workspaceId);
  if (updateWorkspaceError) throw updateWorkspaceError;

  const nowIso = new Date().toISOString();
  const { error: subscriptionError } = await client
    .from("subscriptions")
    .upsert(
      {
        workspace_id: args.workspaceId,
        plan: args.newPlan,
        status: "active",
        stripe_customer_id: `admin-override-${args.workspaceId}`,
        stripe_subscription_id: null,
        current_period_start: nowIso,
        current_period_end: null,
        cancel_at_period_end: false,
        updated_at: nowIso,
      },
      { onConflict: "workspace_id" },
    );
  if (subscriptionError) throw subscriptionError;

  await appendSystemAuditLog({
    actorUserId: userId,
    targetUserId: args.targetUserId ?? null,
    workspaceId: args.workspaceId,
    actionType: "admin:plan:override",
    actionDescription: "System admin changed workspace plan",
    details: {
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      metadata: {
        previous_plan: previousPlan,
        new_plan: args.newPlan,
        reason: args.reason,
      },
    },
  });

  return {
    success: true,
    workspaceId: args.workspaceId,
    previousPlan,
    newPlan: args.newPlan,
  };
}

export async function createRestorePoint(args: {
  authHeader: string | null;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const { userId } = await requireSystemAdmin(args.authHeader);
  const client = createPrivilegedClient();
  const { data, error } = await client.rpc("create_restore_point", {
    p_snapshot_description: args.description,
    p_snapshot_metadata: args.metadata ?? {},
  });
  if (error) throw error;

  await appendSystemAuditLog({
    actorUserId: userId,
    actionType: "admin:restore_point:create",
    actionDescription: "System restore point created from admin endpoint",
    details: {
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      metadata: {
        restore_point_id: data,
        description: args.description,
      },
    },
  });

  return { success: true, restorePointId: data };
}

export async function listRestorePoints(args: {
  authHeader: string | null;
  limit?: number;
}) {
  await requireSystemAdmin(args.authHeader);
  const client = createPrivilegedClient();
  const { data, error } = await client.rpc("list_restore_points", {
    p_limit: args.limit ?? 50,
  });
  if (error) throw error;
  return { success: true, restorePoints: data ?? [] };
}

export async function restoreFromSnapshot(args: {
  authHeader: string | null;
  restorePointId: string;
  reason: string;
  dryRun?: boolean;
  confirmationToken?: string;
  requestConfirmationOnly?: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const { userId } = await requireSystemAdmin(args.authHeader);
  if (!sanitizeUuid(args.restorePointId)) throw new Error("Invalid restorePointId");

  const client = createPrivilegedClient();

  if (args.requestConfirmationOnly) {
    const { data, error } = await client.rpc("request_restore_confirmation", {
      p_restore_point_id: args.restorePointId,
    });
    if (error) throw error;

    await appendSystemAuditLog({
      actorUserId: userId,
      actionType: "admin:restore:confirmation_requested",
      actionDescription: "Restore confirmation token requested",
      details: {
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
        metadata: { restore_point_id: args.restorePointId },
      },
    });

    return {
      success: true,
      restorePointId: args.restorePointId,
      confirmationToken: data,
      confirmationRequested: true,
    };
  }

  if (!args.confirmationToken) {
    throw new Error("confirmationToken is required to execute restore");
  }

  const { data: result, error } = await client.rpc("restore_from_snapshot", {
    p_restore_point_id: args.restorePointId,
    p_confirmation_token: args.confirmationToken,
    p_reason: args.reason,
    p_dry_run: args.dryRun ?? true,
  });
  if (error) throw error;

  await appendSystemAuditLog({
    actorUserId: userId,
    actionType: (args.dryRun ?? true) ? "admin:restore:dry_run" : "admin:restore:executed",
    actionDescription: (args.dryRun ?? true)
      ? "Restore dry run completed"
      : "Restore executed",
    details: {
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      metadata: {
        restore_point_id: args.restorePointId,
        reason: args.reason,
        result,
      },
    },
  });

  return { success: true, result };
}

export async function getAdminAuditLogs(args: {
  authHeader: string | null;
  limit?: number;
  actorUserId?: string;
  workspaceId?: string;
  actionType?: string;
}) {
  await requireSystemAdmin(args.authHeader);
  const client = createPrivilegedClient();

  let query = client
    .from("system_audit_logs")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(Math.min(Math.max(args.limit ?? 100, 1), 500));

  if (args.actorUserId && sanitizeUuid(args.actorUserId)) {
    query = query.eq("actor_user_id", args.actorUserId);
  }
  if (args.workspaceId && sanitizeUuid(args.workspaceId)) {
    query = query.eq("workspace_id", args.workspaceId);
  }
  if (args.actionType) {
    query = query.eq("action_type", args.actionType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return { success: true, logs: data ?? [] };
}
