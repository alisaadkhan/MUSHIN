import { buildCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { createPrivilegedClient, requireSystemAdmin, requireJwt } from "../_shared/privileged_gateway.ts";
import { checkRateLimit, corsHeaders as fixedCorsHeaders } from "../_shared/rate_limit.ts";
import { extractClientIp } from "../_shared/security.ts";
import { logAdminAction } from "../_shared/audit_logger.ts";

type Body = { signup_bucket?: "day" | "week" | "month" };

function json(body: unknown, status = 200, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

function bucketKey(iso: string, mode: "day" | "week" | "month") {
  const d = new Date(iso);
  if (mode === "day") return iso.slice(0, 10);
  if (mode === "month") return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  // week (Mon start)
  const day = d.getUTCDay(); // 0 Sun..6 Sat
  const delta = (day + 6) % 7; // days since Monday
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - delta);
  return monday.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  const ipAddress = extractClientIp(req.headers.get("x-forwarded-for"));
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  try {
    const rate = await checkRateLimit(ipAddress, "general", { perMin: 15, perHour: 120 });
    if (!rate.allowed) return json({ error: "Too many requests" }, 429, fixedCorsHeaders);

    const { userId: actorUserId } = await requireJwt(authHeader);
    await requireSystemAdmin(authHeader);

    const body = (await req.json().catch(() => ({}))) as Body;
    const signupBucket = body.signup_bucket ?? "week";
    if (!["day", "week", "month"].includes(signupBucket)) return validationErrorResponse("invalid signup_bucket", cors);

    const client = createPrivilegedClient();
    const since = new Date(Date.now() - 120 * 864e5).toISOString();

    const [searches, profilesCount, paddleSubs, profilesTs] = await Promise.all([
      client.from("search_history").select("id", { count: "exact", head: true }),
      client.from("profiles").select("id", { count: "exact", head: true }),
      client
        .from("paddle_subscriptions")
        .select("user_id,plan_name,status,current_period_end,cancel_at_period_end,updated_at")
        .order("updated_at", { ascending: false })
        .limit(5000),
      client.from("profiles").select("created_at").gte("created_at", since).limit(8000),
    ]);

    if (searches.error) throw searches.error;
    if (profilesCount.error) throw profilesCount.error;
    if (paddleSubs.error) throw paddleSubs.error;
    if (profilesTs.error) throw profilesTs.error;

    const planCounts: Record<string, number> = {};
    for (const s of paddleSubs.data ?? []) {
      const k = (s as any).plan_name || "unknown";
      planCounts[k] = (planCounts[k] || 0) + 1;
    }

    const signupMap: Record<string, number> = {};
    for (const row of profilesTs.data ?? []) {
      const iso = (row as any).created_at as string | undefined;
      if (!iso) continue;
      const k = bucketKey(iso, signupBucket);
      signupMap[k] = (signupMap[k] || 0) + 1;
    }

    const signupSeries = Object.entries(signupMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, signups]) => ({ period, signups }));

    await logAdminAction({
      actorUserId,
      actionType: "admin:analytics:view",
      actionDescription: "Admin viewed analytics panel",
      ipAddress,
      userAgent,
      metadata: { signup_bucket: signupBucket },
    });

    return json(
      {
        success: true,
        totalSearches: Number(searches.count ?? 0),
        totalUsers: Number(profilesCount.count ?? 0),
        planCounts,
        signupSeries,
        subscriptions: (paddleSubs.data ?? []).map((s: any) => ({
          user_id: s.user_id,
          plan_name: s.plan_name,
          status: s.status,
          current_period_end: s.current_period_end,
          cancel_at_period_end: s.cancel_at_period_end,
          email: null, // intentionally redacted (super_admin/admin can use user id)
        })),
      },
      200,
      cors,
    );
  } catch (err) {
    return safeErrorResponse(err, "[admin-analytics]", cors);
  }
});

