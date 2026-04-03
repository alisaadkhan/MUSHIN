import { isSuperAdmin, performPrivilegedWrite } from "../_shared/privileged_gateway.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const APP_URL = Deno.env.get("APP_URL") ?? "";
const corsHeaders = {
  "Access-Control-Allow-Origin": APP_URL || "https://mushin.app", // Never fall back to *
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const callerIsSuperAdmin = await isSuperAdmin(userId);

    // Service-role client for credit checks
    const adminClient = await performPrivilegedWrite({
        authHeader: req.headers.get("Authorization"),
        action: "gateway:privileged-client-bootstrap",
      endpoint: "send-outreach-email",
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        execute: async (_ctx, client) => client,
    });

    // Get user's workspace
    const { data: membership } = await adminClient
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "No workspace found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check email credits
    const { data: ws } = await adminClient
      .from("workspaces")
      .select("email_sends_remaining")
      .eq("id", membership.workspace_id)
      .single();

    if (!callerIsSuperAdmin && (!ws || ws.email_sends_remaining <= 0)) {
      return new Response(JSON.stringify({ error: "Email credits exhausted. Upgrade your plan to send more emails." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to, subject, body, from_name, reply_to, card_id, campaign_id, username, platform } =
      await req.json();

    if (!to || !subject || !body || !card_id || !campaign_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, body, card_id, campaign_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SEC-11: strip CR/LF from from_name to prevent email header injection
    const safeFromName = (from_name ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 100);
    // SEC-11: strip CR/LF from reply_to to prevent email header injection
    const safeReplyTo = reply_to
      ? reply_to.replace(/[\r\n]+/g, "").trim().slice(0, 254) || undefined
      : undefined;

    // SEC-04: Deduct credit BEFORE sending — prevents double-send race condition.
    // If email send fails we restore the credit.
    if (!callerIsSuperAdmin) {
      const { error: creditErr } = await adminClient.rpc("consume_email_credit", { ws_id: membership.workspace_id });
      if (creditErr) {
        console.error("[send-outreach-email] Credit deduction failed:", creditErr.message);
        return new Response(
          JSON.stringify({ error: "Failed to reserve email credit. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Send email via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: safeFromName ? `${safeFromName} <onboarding@resend.dev>` : "onboarding@resend.dev",
        to: [to],
        subject,
        html: body,
        reply_to: safeReplyTo,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend API error:", resendData);
      // Restore the credit since email failed to send
      if (!callerIsSuperAdmin) {
        const { error: restoreEmailErr } = await adminClient.rpc("restore_email_credit", { ws_id: membership.workspace_id });
        if (restoreEmailErr) console.error("[send-outreach-email] Credit restore failed:", restoreEmailErr.message);
      }
      // Log full Resend error server-side only — never expose internal API details to client
      console.error("[send-outreach-email] Resend failure detail:", JSON.stringify(resendData));
      return new Response(
        JSON.stringify({ error: "Failed to send email. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log in outreach_log
    const { error: logError } = await supabase.from("outreach_log").insert({
      campaign_id,
      card_id,
      username: username || "unknown",
      platform: platform || "unknown",
      method: "email",
      notes: `Email sent to ${to}`,
      email_to: to,
      email_subject: subject,
    });

    if (logError) {
      console.error("Failed to log outreach:", logError);
    }

    return new Response(
      JSON.stringify({ success: true, email_id: resendData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-outreach-email:", error);
    return new Response(JSON.stringify({ error: "Failed to send email. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
