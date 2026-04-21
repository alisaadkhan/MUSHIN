import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Validates if the workspace can afford an estimated API limit transaction.
 * @param workspaceId The UUID of the workspace
 * @param estimatedCost Estimation of the cost for this operation (credits or financial value)
 * @returns Response if blocked by killswitch, null if allowed.
 */
export async function enforceBudgetKillSwitch(
  workspaceId: string, 
  estimatedCost: number
): Promise<Response | null> {
  try {
    // Hard kill-switch for expensive endpoints (server-side only).
    if (Deno.env.get("KILL_SWITCH_EXPENSIVE_ENDPOINTS") === "true") {
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable.", code: "KILL_SWITCH" }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    // Attempting to fetch cost metrics 
    const { data, error } = await supabaseAdmin
      .from('workspaces') // or workspace_billing depending on schema
      .select('subscription_status')
      .eq('id', workspaceId)
      .single();

    if (error) {
       console.error("Budget check error:", error);
       // SECURITY: Fail CLOSED in production for expensive endpoints.
       const isDev = Deno.env.get("ENVIRONMENT") === "development";
       if (isDev) return null;
       return new Response(
         JSON.stringify({ error: "Service temporarily unavailable.", code: "BUDGET_CHECK_UNAVAILABLE" }),
         { status: 503, headers: { "Content-Type": "application/json" } },
       );
    }

    // Example naive budget logic. In a real system you'd read `spent_this_month` vs `budget_cap`.
    // E.g., if (data.spent_this_month + estimatedCost > data.budget_cap) ...
    // Here we just block if they are explicitly cancelled/frozen via admin rules.
    if (data.subscription_status === 'frozen' || data.subscription_status === 'suspended') {
      return new Response(
        JSON.stringify({ 
          error: "402: Payment Required. Workspace budget kill-switch activated due to account suspension." 
        }),
        { 
          status: 402, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    // Allowed
    return null;
  } catch (err) {
    console.error("Budget verification crash:", err);
    const isDev = Deno.env.get("ENVIRONMENT") === "development";
    if (isDev) return null;
    return new Response(
      JSON.stringify({ error: "Service temporarily unavailable.", code: "BUDGET_CHECK_FAILED" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}
