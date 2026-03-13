import { createPrivilegedClient } from "./privileged_gateway.ts";

type BaseLogArgs = {
  actionType: string;
  actionDescription: string;
  actorUserId?: string | null;
  targetUserId?: string | null;
  workspaceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

async function appendAuditLog(args: BaseLogArgs) {
  const client = createPrivilegedClient();
  const { error } = await client.rpc("append_system_audit_log", {
    p_actor_user_id: args.actorUserId ?? null,
    p_target_user_id: args.targetUserId ?? null,
    p_workspace_id: args.workspaceId ?? null,
    p_action_type: args.actionType,
    p_action_description: args.actionDescription,
    p_ip_address: args.ipAddress ?? null,
    p_user_agent: args.userAgent ?? null,
    p_metadata_json: args.metadata ?? {},
  });

  if (error) throw error;
}

export async function logUserAction(args: BaseLogArgs & { actorUserId: string }) {
  await appendAuditLog(args);
}

export async function logAdminAction(args: BaseLogArgs & { actorUserId: string }) {
  await appendAuditLog(args);
}

export async function logSystemAction(args: BaseLogArgs) {
  await appendAuditLog(args);
}
