import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { createPrivilegedClient, requireJwt, requireWorkspaceMembership } from "../_shared/privileged_gateway.ts";

function json(corsHeaders: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function sanitizeText(input: unknown, max = 2000): string {
  return String(input ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, max);
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(corsHeaders, { error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");

  try {
    const { userId, token } = await requireJwt(authHeader);
    const membership = await requireWorkspaceMembership(userId, null);

    const body = await req.json().catch(() => ({}));
    const subject = sanitizeText(body.subject, 160);
    const description = sanitizeText(body.description, 4000);
    const priority = sanitizeText(body.priority, 20) || "medium";
    const category = sanitizeText(body.category, 30) || "general";

    if (!subject || !description) {
      return json(corsHeaders, { error: "subject and description are required" }, 400);
    }

    const admin = createPrivilegedClient();
    const { data: created, error: insertErr } = await admin
      .from("support_tickets")
      .insert({
        user_id: userId,
        workspace_id: membership.workspaceId,
        subject,
        description,
        priority,
        category,
        status: "open",
      })
      .select("id,ticket_number,created_at")
      .single();

    if (insertErr) throw insertErr;

    // Best-effort: send confirmation email via Resend if configured
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader ?? "" } },
      });
      const { data: u, error: uErr } = await userClient.auth.getUser(token);
      const email = uErr ? null : (u.user?.email ?? null);
      if (email) {
        const ticketNo = created?.ticket_number ?? created?.id?.slice(0, 8);
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "MUSHIN Support <support@mushin.app>",
            to: [email],
            subject: `Support ticket received (#${ticketNo})`,
            html: `
              <div style="font-family:Inter,system-ui,Segoe UI,Arial;line-height:1.55">
                <p>Hi,</p>
                <p>Your support request has been registered.</p>
                <p><b>Ticket:</b> #${ticketNo}</p>
                <p><b>Subject:</b> ${subject}</p>
                <p>Our team will respond as soon as possible.</p>
                <p style="color:#666;font-size:12px">Do not reply to this email.</p>
              </div>
            `,
          }),
        }).catch(() => null);
      }
    }

    return json(corsHeaders, { success: true, ticket: created });
  } catch (err: any) {
    console.error("[support-create-ticket] error:", err?.message ?? err);
    return json(corsHeaders, { error: "Internal error" }, 500);
  }
});

