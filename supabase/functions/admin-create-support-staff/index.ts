import { performPrivilegedWrite } from "../_shared/privileged_gateway.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeErrorResponse } from "../_shared/errors.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { enforceGlobalRateLimit } from "../_shared/global_rate_limit.ts";

const STAFF_EMAIL_DOMAIN = Deno.env.get("STAFF_EMAIL_DOMAIN") || "staff.mushin.local";

function staffEmail(employeeId: string): string {
  const cleaned = employeeId.trim().toLowerCase();
  return `${cleaned}@${STAFF_EMAIL_DOMAIN}`;
}

function isValidEmployeeId(employeeId: string): boolean {
  // Support "MUSHIN-1234", "SUP-01", "agent7", etc. Reject spaces and weird chars.
  const v = employeeId.trim();
  if (!v) return false;
  if (v.length < 3 || v.length > 40) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(v);
}

async function getCallerRole(serviceClient: any, userId: string): Promise<string | null> {
  const { data } = await serviceClient.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  return data?.role ?? null;
}

async function logAction(serviceClient: any, adminId: string, action: string, targetId: string, details: object) {
  await serviceClient.from("admin_audit_log").insert({ admin_user_id: adminId, action, target_user_id: targetId, details });
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const serviceClient = await performPrivilegedWrite({
    authHeader,
    action: "gateway:privileged-client-bootstrap",
    execute: async (_ctx, client) => client,
  });

  const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authErr } = await anonClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const callerRole = await getCallerRole(serviceClient, user.id);
  if (!callerRole || !["super_admin", "admin"].includes(callerRole)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const ipAddress =
      (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      null;
    const rl = await enforceGlobalRateLimit({
      userId: user.id,
      ipAddress,
      endpoint: "admin-create-support-staff",
      isAdmin: callerRole === "admin",
      isSuperAdmin: callerRole === "super_admin",
    });
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded", retry_after: rl.retryAfter }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(Math.max(1, rl.retryAfter ?? 1)),
        },
      });
    }

    const body = await req.json().catch(() => ({}));
    const employee_id = String(body.employee_id ?? "").trim();
    const password = String(body.password ?? "");
    const department = body.department ? String(body.department) : "support";
    const permissions = body.permissions && typeof body.permissions === "object" ? body.permissions : undefined;

    if (!isValidEmployeeId(employee_id)) {
      return new Response(JSON.stringify({ error: "Invalid employee_id. Use 3-40 chars: letters, numbers, _ or -." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!password || password.length < 10) {
      return new Response(JSON.stringify({ error: "Password must be at least 10 characters." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = staffEmail(employee_id);

    // Prevent duplicates by employee_id
    const { data: existingStaff } = await serviceClient
      .from("support_staff")
      .select("id, employee_id")
      .eq("employee_id", employee_id)
      .maybeSingle();
    if (existingStaff?.id) {
      return new Response(JSON.stringify({ error: "A support staff member with this employee_id already exists." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: created, error: createErr } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { staff_employee_id: employee_id, staff_department: department, staff_portal: "support" },
    });
    if (createErr || !created?.user) throw createErr || new Error("Failed to create staff identity");

    const newUserId = created.user.id;

    // Ensure role=support
    await serviceClient.from("user_roles").upsert({ user_id: newUserId, role: "support" }, { onConflict: "user_id" });

    // Create staff row
    const insertRow: Record<string, unknown> = { id: newUserId, employee_id, department };
    if (permissions) insertRow.permissions = permissions;
    await serviceClient.from("support_staff").upsert(insertRow, { onConflict: "id" });

    await logAction(serviceClient, user.id, "create_support_staff", newUserId, { employee_id, department, email, permissions });

    return new Response(JSON.stringify({ success: true, staff_user_id: newUserId, employee_id, email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return safeErrorResponse(err, "[admin-create-support-staff]", corsHeaders);
  }
});

