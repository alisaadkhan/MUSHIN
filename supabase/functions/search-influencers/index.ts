import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractFollowers(text: string): number | null {
  const match = text.match(/(\d[\d,.]*)\s*([kKmMbB](?:illion)?)?[\s+]*(followers|subs|subscribers)/i);
  if (!match) return null;
  let num = parseFloat(match[1].replace(/,/g, ""));
  const suffix = (match[2] || "").toLowerCase();
  if (suffix === "k") num *= 1_000;
  else if (suffix === "m" || suffix === "million") num *= 1_000_000;
  else if (suffix === "b" || suffix === "billion") num *= 1_000_000_000;
  return Math.round(num);
}

function extractUsername(url: string, platform: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (platform === "youtube") {
      if (parts[0]?.startsWith("@")) return parts[0];
      if (parts[0] === "c" || parts[0] === "channel") return parts[1] || null;
      return parts[0] || null;
    }
    const name = parts[0];
    if (!name || ["p", "reel", "explore", "stories", "video", "tag", "search"].includes(name)) return null;
    return name.startsWith("@") ? name : `@${name}`;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get workspace
    const { data: workspaceId, error: wsError } = await supabase.rpc("get_user_workspace_id");
    if (wsError || !workspaceId) {
      return new Response(JSON.stringify({ error: "No workspace found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check credits
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("search_credits_remaining")
      .eq("id", workspaceId)
      .single();

    if (!workspace || workspace.search_credits_remaining <= 0) {
      return new Response(
        JSON.stringify({ error: "No search credits remaining" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse body
    const { query, platform, location } = await req.json();
    if (!query || !platform) {
      return new Response(JSON.stringify({ error: "query and platform are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build Serper query (no site: operator - Serper rejects it; domain filtering done server-side)
    const platformTerm = platform || "";
    const locationPart = "Pakistan";  // Always broad query; city used for ranking only
    const serperQuery = `${query} ${platformTerm} ${locationPart} influencer`.trim();
    console.log("Serper query:", serperQuery);

    // Call Serper
    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    if (!SERPER_API_KEY) {
      return new Response(JSON.stringify({ error: "Serper API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serperRes = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: serperQuery, num: 100, gl: "pk", hl: "en" }),
    });

    if (!serperRes.ok) {
      const errText = await serperRes.text();
      console.error("Serper API error:", errText);
      return new Response(JSON.stringify({ error: "Search API error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serperData = await serperRes.json();
    const organic = serperData.organic || [];

    // Filter by platform domain to prevent cross-platform leakage
    const domainMap: Record<string, string> = {
      instagram: "instagram.com",
      tiktok: "tiktok.com",
      youtube: "youtube.com",
    };
    const expectedDomain = domainMap[platform];
    const platformFiltered = expectedDomain
      ? organic.filter((item: any) => item.link?.includes(expectedDomain))
      : organic;

    // Three-tier soft ranking
    const PAKISTAN_KEYWORDS = [
      "pakistan", "karachi", "lahore", "islamabad", "rawalpindi", "faisalabad",
      "multan", "peshawar", "quetta", "sialkot", "gujranwala",
      "hyderabad", "bahawalpur",
      "paki", "pakistani", "isb", "lhr", "khi",
      "punjab", "sindh", "balochistan", "kpk", "khyber",
    ];

    const selectedCity = (location && location !== "All Pakistan") ? location.toLowerCase() : null;

    const tier1: any[] = [];
    const tier2: any[] = [];
    const tier3: any[] = [];
    for (const item of platformFiltered) {
      const text = ((item.title || "") + " " + (item.snippet || "")).toLowerCase();
      if (selectedCity && text.includes(selectedCity)) {
        tier1.push(item);
      } else if (PAKISTAN_KEYWORDS.some((kw) => text.includes(kw))) {
        tier2.push(item);
      } else {
        tier3.push(item);
      }
    }
    const finalResults = [...tier1, ...tier2, ...tier3].slice(0, 20);

    // Parse results
    const results = finalResults
      .map((item: any) => {
        const username = extractUsername(item.link, platform);
        if (!username) return null;
        const snippetText = (item.title || "") + " " + (item.snippet || "");
        return {
          title: item.title || "",
          link: item.link || "",
          snippet: item.snippet || "",
          username,
          platform,
          displayUrl: item.link || "",
          extracted_followers: extractFollowers(snippetText),
        };
      })
      .filter(Boolean);

    // Deduplicate by username
    const seen = new Set<string>();
    const uniqueResults = results.filter((r: any) => {
      const key = `${r.platform}:${r.username}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Use service role for writes
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Cache results
    for (const r of uniqueResults) {
      await serviceClient.from("influencers_cache").upsert(
        {
          platform: r.platform,
          username: r.username,
          data: { title: r.title, link: r.link, snippet: r.snippet, displayUrl: r.displayUrl },
        },
        { onConflict: "platform,username" }
      );
    }

    // Log search history
    await serviceClient.from("search_history").insert({
      workspace_id: workspaceId,
      query,
      platform,
      location: location || null,
      result_count: uniqueResults.length,
      filters: {},
    });

    // Deduct credit
    await serviceClient
      .from("workspaces")
      .update({ search_credits_remaining: workspace.search_credits_remaining - 1 })
      .eq("id", workspaceId);

    // Log credit usage
    await serviceClient.from("credits_usage").insert({
      workspace_id: workspaceId,
      action_type: "search",
      amount: 1,
    });

    return new Response(
      JSON.stringify({
        results: uniqueResults,
        credits_remaining: workspace.search_credits_remaining - 1,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
