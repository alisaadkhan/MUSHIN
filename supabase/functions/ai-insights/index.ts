import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

function buildSummarizeMessages(data: any) {
  return {
    messages: [
      { role: "system", content: "You are an influencer marketing analyst. Given an influencer's profile data, write a concise 2-3 sentence summary highlighting their strengths, niche, audience size, and engagement quality. Be direct and actionable." },
      { role: "user", content: `Analyze this influencer profile:\n${JSON.stringify(data)}` },
    ],
  };
}

function buildFraudCheckMessages(data: any) {
  return {
    messages: [
      { role: "system", content: "You are a social media fraud detection expert. Analyze the influencer metrics provided and identify any red flags indicating fake followers, engagement manipulation, or suspicious patterns." },
      { role: "user", content: `Check this influencer for fraud indicators:\n${JSON.stringify(data)}` },
    ],
    tools: [{
      type: "function",
      function: {
        name: "fraud_analysis",
        description: "Return a fraud risk assessment for the influencer",
        parameters: {
          type: "object",
          properties: {
            risk: { type: "string", enum: ["low", "medium", "high"] },
            flags: { type: "array", items: { type: "string" } },
            summary: { type: "string" },
          },
          required: ["risk", "flags", "summary"],
          additionalProperties: false,
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "fraud_analysis" } },
  };
}

function buildRecommendMessages(data: any) {
  return {
    messages: [
      { role: "system", content: "You are a campaign strategy advisor. Given the current state of an influencer marketing campaign, provide 3-5 actionable recommendations to improve campaign performance." },
      { role: "user", content: `Analyze this campaign and give recommendations:\n${JSON.stringify(data)}` },
    ],
    tools: [{
      type: "function",
      function: {
        name: "campaign_recommendations",
        description: "Return actionable campaign recommendations",
        parameters: {
          type: "object",
          properties: {
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  priority: { type: "string", enum: ["high", "medium", "low"] },
                  category: { type: "string", enum: ["outreach", "budget", "timeline", "strategy"] },
                },
                required: ["title", "description", "priority", "category"],
                additionalProperties: false,
              },
            },
          },
          required: ["recommendations"],
          additionalProperties: false,
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "campaign_recommendations" } },
  };
}

function buildEvaluateMessages(data: any) {
  const systemPrompt = `You are an expert influencer marketing analyst. Evaluate the influencer based on all available data. Consider:

- Engagement rate benchmarks per platform: Instagram ~1-3%, TikTok ~3-6%, YouTube ~2-5%
- Authenticity: analyze follower-to-engagement ratios for suspicious patterns
- Demographics: infer likely audience age range, gender split, and top countries from content niche, language, and bio clues
- Niche: classify into relevant categories based on bio and content
- Brand safety: scan bio/snippet for controversial content, profanity, or risky topics
- Composite score: 40% engagement quality, 30% authenticity, 20% content quality/relevance, 10% growth signals

Be analytical but fair. If data is limited, note that in your assessment and provide best estimates.`;

  return {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Evaluate this influencer comprehensively:\n${JSON.stringify(data)}` },
    ],
    tools: [{
      type: "function",
      function: {
        name: "influencer_evaluation",
        description: "Return a comprehensive influencer evaluation with scores and analysis",
        parameters: {
          type: "object",
          properties: {
            overall_score: { type: "integer", description: "Composite score 0-100" },
            engagement_rating: {
              type: "object",
              properties: {
                rate: { type: "number", description: "Engagement rate as percentage" },
                benchmark_comparison: { type: "string", description: "e.g. 'Above average', 'Below benchmark'" },
                verdict: { type: "string", description: "Brief assessment of engagement quality" },
              },
              required: ["rate", "benchmark_comparison", "verdict"],
              additionalProperties: false,
            },
            authenticity: {
              type: "object",
              properties: {
                score: { type: "integer", description: "Authenticity score 0-100" },
                risk_level: { type: "string", enum: ["low", "medium", "high"] },
                flags: { type: "array", items: { type: "string" }, description: "Suspicious pattern flags" },
                summary: { type: "string" },
              },
              required: ["score", "risk_level", "flags", "summary"],
              additionalProperties: false,
            },
            growth_assessment: {
              type: "object",
              properties: {
                pattern: { type: "string", description: "Growth pattern description" },
                risk_flags: { type: "array", items: { type: "string" } },
              },
              required: ["pattern", "risk_flags"],
              additionalProperties: false,
            },
            estimated_demographics: {
              type: "object",
              properties: {
                age_range: { type: "string", description: "e.g. '18-34'" },
                gender_split: { type: "string", description: "e.g. '60% female, 40% male'" },
                top_countries: { type: "array", items: { type: "string" }, description: "Top 3-5 likely countries" },
              },
              required: ["age_range", "gender_split", "top_countries"],
              additionalProperties: false,
            },
            niche_categories: { type: "array", items: { type: "string" }, description: "2-5 niche categories" },
            brand_safety: {
              type: "object",
              properties: {
                rating: { type: "string", enum: ["safe", "caution", "risk"] },
                flags: { type: "array", items: { type: "string" } },
              },
              required: ["rating", "flags"],
              additionalProperties: false,
            },
            recommendations: { type: "array", items: { type: "string" }, description: "3-5 actionable recommendations" },
          },
          required: ["overall_score", "engagement_rating", "authenticity", "growth_assessment", "estimated_demographics", "niche_categories", "brand_safety", "recommendations"],
          additionalProperties: false,
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "influencer_evaluation" } },
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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      return new Response(JSON.stringify({ error: "No workspace found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ws } = await adminClient
      .from("workspaces")
      .select("ai_credits_remaining")
      .eq("id", membership.workspace_id)
      .single();

    if (!ws || ws.ai_credits_remaining <= 0) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Upgrade your plan to continue using AI features." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, data } = await req.json();

    let config: { messages: any[]; tools?: any[]; tool_choice?: any };

    if (type === "summarize") {
      config = buildSummarizeMessages(data);
    } else if (type === "fraud-check") {
      config = buildFraudCheckMessages(data);
    } else if (type === "recommend") {
      config = buildRecommendMessages(data);
    } else if (type === "evaluate") {
      config = buildEvaluateMessages(data);
    } else {
      return new Response(JSON.stringify({ error: "Invalid type. Use: summarize, fraud-check, recommend, evaluate" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: any = { model: MODEL, messages: config.messages };
    if (config.tools) body.tools = config.tools;
    if (config.tool_choice) body.tool_choice = config.tool_choice;

    const aiRes = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const choice = aiData.choices?.[0];

    let result: any;

    if (type === "summarize") {
      result = { summary: choice?.message?.content || "Unable to generate summary." };
    } else {
      const toolCall = choice?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try {
          result = JSON.parse(toolCall.function.arguments);
        } catch {
          result = { error: "Failed to parse AI response" };
        }
      } else {
        result = { content: choice?.message?.content || "No response" };
      }
    }

    // Decrement AI credits
    await adminClient
      .from("workspaces")
      .update({ ai_credits_remaining: ws.ai_credits_remaining - 1 })
      .eq("id", membership.workspace_id)
      .gt("ai_credits_remaining", 0);

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-insights error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
