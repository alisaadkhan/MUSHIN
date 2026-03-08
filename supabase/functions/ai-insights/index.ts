import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText, extractJsonFromText } from "../_shared/huggingface.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Prompt builders (HuggingFace / Mistral-7B compatible) ───────────────────
// Each builder returns { system, user } strings for generateText().
// JSON schemas are embedded in the system prompt so Mistral returns valid JSON.

function buildSummarize(data: any): { system: string; user: string } {
  return {
    system: "You are an influencer marketing analyst. Given an influencer profile, write a concise 2-3 sentence summary highlighting strengths, niche, audience size, and engagement quality. Be direct and actionable. Return only plain text, no JSON.",
    user: `Analyze this influencer profile:\n${JSON.stringify(data).slice(0, 2000)}`,
  };
}

function buildFraudCheck(data: any): { system: string; user: string } {
  return {
    system: `You are a social media fraud detection expert. Analyze influencer metrics and return ONLY a JSON object:\n{"risk":"low","flags":[],"summary":"..."}\nrisk must be "low", "medium", or "high". Return ONLY the JSON.`,
    user: `Check this influencer for fraud indicators:\n${JSON.stringify(data).slice(0, 2000)}`,
  };
}

function buildRecommend(data: any): { system: string; user: string } {
  return {
    system: `You are a campaign strategy advisor. Return ONLY a JSON object:\n{"recommendations":[{"title":"...","description":"...","priority":"high","category":"strategy"}]}\npriority: "high","medium","low". category: "outreach","budget","timeline","strategy". 3-5 items. Return ONLY the JSON.`,
    user: `Analyze this campaign and give recommendations:\n${JSON.stringify(data).slice(0, 2000)}`,
  };
}

function buildEvaluate(data: any): { system: string; user: string } {
  return {
    system: `You are an expert influencer marketing analyst. Evaluate the influencer and return ONLY a JSON object with this exact structure:
{"overall_score":75,"engagement_rating":{"rate":2.5,"benchmark_comparison":"Above average","verdict":"Good engagement"},"authenticity":{"score":80,"risk_level":"low","flags":[],"summary":"Authentic audience"},"growth_assessment":{"pattern":"Steady organic growth","risk_flags":[]},"estimated_demographics":{"age_range":"18-34","gender_split":"55% female, 45% male","top_countries":["Pakistan","UAE"]},"niche_categories":["Lifestyle","Fashion"],"brand_safety":{"rating":"safe","flags":[]},"recommendations":["Increase posting frequency"]}
Return ONLY the JSON. Engagement benchmarks: Instagram 1-3%, TikTok 3-6%, YouTube 2-5%. Score 0-100.`,
    user: `Evaluate this influencer comprehensively:\n${JSON.stringify(data).slice(0, 2500)}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    const HUGGINGFACE_API_KEY = Deno.env.get("HUGGINGFACE_API_KEY");
    if (!HUGGINGFACE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI features are temporarily unavailable. Please try again later.", code: "AI_KEY_MISSING", status: 503 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: membership } = await adminClient
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "No workspace found", code: "NO_WORKSPACE", status: 400 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ws } = await adminClient
      .from("workspaces")
      .select("ai_credits_remaining")
      .eq("id", membership.workspace_id)
      .single();

    if (!ws || ws.ai_credits_remaining <= 0) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Upgrade your plan to continue using AI features.", code: "CREDITS_EXHAUSTED", status: 402 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, data } = await req.json();

    let promptConfig: { system: string; user: string } | null = null;
    let isSummarize = false;

    if (type === "summarize") {
      promptConfig = buildSummarize(data);
      isSummarize = true;
    } else if (type === "fraud-check") {
      promptConfig = buildFraudCheck(data);
    } else if (type === "recommend") {
      promptConfig = buildRecommend(data);
    } else if (type === "evaluate") {
      promptConfig = buildEvaluate(data);
    } else {
      return new Response(JSON.stringify({ error: "Invalid type. Use: summarize, fraud-check, recommend, evaluate" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct credit BEFORE AI call to prevent race condition double-spend.
    const { error: creditErr } = await adminClient.rpc("consume_ai_credit", { ws_id: membership.workspace_id });
    if (creditErr) {
      console.error("[ai-insights] Pre-deduction failed:", creditErr);
      return new Response(JSON.stringify({ error: "Credit deduction failed. Please try again.", code: "CREDIT_DEDUCT_FAILED", status: 500 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any;
    try {
      const rawText = await generateText(
        promptConfig.system,
        promptConfig.user,
        HUGGINGFACE_API_KEY,
        { maxTokens: isSummarize ? 256 : 600, temperature: 0.2, timeoutMs: 50_000 },
      );

      if (isSummarize) {
        result = { summary: rawText.trim() };
      } else {
        const parsed = extractJsonFromText(rawText) as any;
        result = parsed;
        if (type === "evaluate" && result && !result.error) {
          result.evaluation_version = 1;
        }
      }
    } catch (aiErr: any) {
      console.error("[ai-insights] AI call failed:", aiErr.message);
      // Restore credit on AI failure
      await adminClient.rpc("restore_ai_credit", { ws_id: membership.workspace_id }).catch(console.error);
      const isRateLimit = aiErr.message?.includes("429");
      return new Response(JSON.stringify({
        error: isRateLimit
          ? "Rate limit exceeded. Please try again in a moment."
          : "AI service error. Please try again shortly.",
        code: isRateLimit ? "RATE_LIMIT" : "AI_ERROR",
        status: isRateLimit ? 429 : 502,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Credit was already deducted before the AI call (race-condition safe).
    // Return success — if result is falsy the outer catch will handle it.
    return new Response(JSON.stringify(result ?? { error: "No result" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-insights error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg, code: "INTERNAL_ERROR", status: 500 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
