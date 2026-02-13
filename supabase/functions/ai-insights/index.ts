import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, data } = await req.json();

    let messages: any[];
    let tools: any[] | undefined;
    let tool_choice: any | undefined;

    if (type === "summarize") {
      messages = [
        { role: "system", content: "You are an influencer marketing analyst. Given an influencer's profile data, write a concise 2-3 sentence summary highlighting their strengths, niche, audience size, and engagement quality. Be direct and actionable." },
        { role: "user", content: `Analyze this influencer profile:\n${JSON.stringify(data)}` },
      ];
    } else if (type === "fraud-check") {
      messages = [
        { role: "system", content: "You are a social media fraud detection expert. Analyze the influencer metrics provided and identify any red flags indicating fake followers, engagement manipulation, or suspicious patterns. Consider follower-to-engagement ratios, average views vs followers, and any anomalies." },
        { role: "user", content: `Check this influencer for fraud indicators:\n${JSON.stringify(data)}` },
      ];
      tools = [{
        type: "function",
        function: {
          name: "fraud_analysis",
          description: "Return a fraud risk assessment for the influencer",
          parameters: {
            type: "object",
            properties: {
              risk: { type: "string", enum: ["low", "medium", "high"], description: "Overall fraud risk level" },
              flags: { type: "array", items: { type: "string" }, description: "List of specific red flags found" },
              summary: { type: "string", description: "Brief overall assessment" },
            },
            required: ["risk", "flags", "summary"],
            additionalProperties: false,
          },
        },
      }];
      tool_choice = { type: "function", function: { name: "fraud_analysis" } };
    } else if (type === "recommend") {
      messages = [
        { role: "system", content: "You are a campaign strategy advisor. Given the current state of an influencer marketing campaign (stages, influencer counts, budget, timeline, outreach stats), provide 3-5 actionable recommendations to improve campaign performance. Be specific and prioritize by impact." },
        { role: "user", content: `Analyze this campaign and give recommendations:\n${JSON.stringify(data)}` },
      ];
      tools = [{
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
                    title: { type: "string", description: "Short recommendation title" },
                    description: { type: "string", description: "Detailed explanation" },
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
      }];
      tool_choice = { type: "function", function: { name: "campaign_recommendations" } };
    } else {
      return new Response(JSON.stringify({ error: "Invalid type. Use: summarize, fraud-check, recommend" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: any = { model: MODEL, messages };
    if (tools) body.tools = tools;
    if (tool_choice) body.tool_choice = tool_choice;

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
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }), {
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
      // fraud-check or recommend — extract tool call
      const toolCall = choice?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try {
          result = JSON.parse(toolCall.function.arguments);
        } catch {
          result = { error: "Failed to parse AI response" };
        }
      } else {
        // Fallback to content
        result = { content: choice?.message?.content || "No response" };
      }
    }

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
