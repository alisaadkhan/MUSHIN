// supabase/functions/extract-creator-tags/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// AI Tag Generation Pipeline
//
// Triggered after enrichment or manually. Extracts topic tags from:
//   1. Creator bio
//   2. Post captions / hashtags
//   3. Primary niche
//   4. HuggingFace Mistral-7B AI analysis (when API key is available)
//
// Tags are stored in creator_tags AND the tags[] array in influencer_profiles.
//
// Failsafe: if HuggingFace is unavailable, falls back to pure keyword extraction.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  generateText,
  extractJsonFromText,
  extractTagsFromBio,
  normalizeTags,
} from "../_shared/huggingface.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Weights by source (higher = more authoritative) ──────────────────────────
const SOURCE_WEIGHTS: Record<string, number> = {
  ai:      0.9,
  hashtag: 0.75,
  bio:     0.6,
  niche:   0.7,
  manual:  1.0,
};

/** Stopword list — tags that provide no signal. */
const TAG_STOPWORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "is","are","was","were","be","been","has","have","had","do","does","did",
  "i","we","you","he","she","they","it","my","our","your","his","her","their",
  "this","that","these","those","here","there","what","which","who","how",
  "not","no","so","as","by","from","up","out","about","than","more","also",
  "just","very","can","will","would","could","should","may","might",
  "like","follow","subscribe","share","comment","link","bio","must",
  "per","amp","via","new","the","all","any","use","get","set","put",
]);

function cleanTag(t: string): string | null {
  const cleaned = t.toLowerCase()
    .replace(/^#/, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
  if (!cleaned || cleaned.length < 2 || cleaned.length > 40) return null;
  if (TAG_STOPWORDS.has(cleaned)) return null;
  return cleaned;
}

/** Extract tags from post captions (hashtags & repeated keywords). */
function extractTagsFromPosts(captions: string[]): string[] {
  const hashtagCounts = new Map<string, number>();
  for (const cap of captions) {
    for (const m of (cap || "").matchAll(/#([a-zA-Z0-9]+)/g)) {
      const tag = cleanTag(m[1]);
      if (tag) hashtagCounts.set(tag, (hashtagCounts.get(tag) ?? 0) + 1);
    }
  }
  // Only include hashtags that appear in ≥1 post (all unique already)
  return [...hashtagCounts.keys()].slice(0, 30);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startMs = Date.now();

  try {
    // ── Auth: accept service role (internal) or user bearer token ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isInternal = authHeader === `Bearer ${serviceKey}`;

    if (!isInternal) {
      // Validate user token
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { error } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
      if (error) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const body = await req.json();
    const { profile_id } = body;
    if (!profile_id) {
      return new Response(JSON.stringify({ error: "profile_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch creator profile ─────────────────────────────────────────────────
    const { data: profile, error: profileErr } = await serviceClient
      .from("influencer_profiles")
      .select("id, username, platform, bio, primary_niche, full_name")
      .eq("id", profile_id)
      .single();

    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch recent post captions ────────────────────────────────────────────
    const { data: posts } = await serviceClient
      .from("influencer_posts")
      .select("caption")
      .eq("profile_id", profile_id)
      .order("posted_at", { ascending: false })
      .limit(30);

    const captions = (posts || []).map((p: any) => p.caption || "").filter(Boolean);

    // ── Step 1: Keyword & hashtag extraction (always runs — failsafe) ─────────
    const bioTags       = extractTagsFromBio(profile.bio || "", profile.primary_niche || null);
    const hashtagTags   = extractTagsFromPosts(captions);
    const nicheTags     = profile.primary_niche
      ? normalizeTags([profile.primary_niche.toLowerCase()])
      : [];

    // ── Step 2: AI tag extraction (optional, requires HUGGINGFACE_API_KEY) ────
    const HF_KEY = Deno.env.get("HUGGINGFACE_API_KEY");
    let aiTags: string[] = [];

    if (HF_KEY && (profile.bio || captions.length > 0)) {
      const combinedText = [
        profile.bio || "",
        captions.slice(0, 10).join(" "),
      ].join(" ").slice(0, 2000);

      const systemPrompt = `You are a social media analyst. Extract 5-15 relevant topic tags for an influencer based on their content.
Return ONLY a JSON array of lowercase single-word or short hyphenated tags. Examples:
["tech","gaming","pakistan","karachi","food","beauty","fashion","education","fitness","music","comedy","vlogging","urdu","review","lifestyle"]
Return ONLY the JSON array, no explanation.`;

      try {
        const rawText = await generateText(
          systemPrompt,
          `Extract tags from this content:\nBio: ${profile.bio || "N/A"}\nSample posts: ${captions.slice(0, 5).join(" | ")}`,
          HF_KEY,
          { maxTokens: 150, temperature: 0.2 },
        );
        const parsed = extractJsonFromText(rawText);
        if (Array.isArray(parsed)) {
          aiTags = normalizeTags(parsed.map(String));
        }
      } catch (aiErr: any) {
        console.warn(`[extract-creator-tags] AI failed for ${profile.username}:`, aiErr.message);
        // Non-fatal: continue with keyword tags
      }
    }

    // ── Step 3: Merge all tags with weights ───────────────────────────────────
    interface TagEntry {
      tag: string;
      weight: number;
      source: "ai" | "bio" | "hashtag" | "niche";
    }

    const tagMap = new Map<string, TagEntry>();

    const mergeTag = (tag: string, source: TagEntry["source"]) => {
      const clean = cleanTag(tag);
      if (!clean) return;
      const existing = tagMap.get(clean);
      const w = SOURCE_WEIGHTS[source];
      if (!existing || w > existing.weight) {
        tagMap.set(clean, { tag: clean, weight: w, source });
      }
    };

    for (const t of aiTags)     mergeTag(t, "ai");
    for (const t of hashtagTags) mergeTag(t, "hashtag");
    for (const t of nicheTags)   mergeTag(t, "niche");
    for (const t of bioTags)     mergeTag(t, "bio");

    // Sort by weight desc, cap at 30 tags
    const finalTags = [...tagMap.values()]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 30);

    if (finalTags.length === 0) {
      return new Response(JSON.stringify({ success: true, tags: [], message: "No tags extracted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Step 4: Upsert into creator_tags table ────────────────────────────────
    const tagRows = finalTags.map(({ tag, weight, source }) => ({
      creator_id: profile_id,
      platform:   profile.platform,
      tag,
      weight,
      source,
    }));

    const { error: upsertErr } = await serviceClient
      .from("creator_tags")
      .upsert(tagRows, { onConflict: "creator_id,tag" });

    if (upsertErr) {
      console.error("[extract-creator-tags] creator_tags upsert failed:", upsertErr.message);
    }

    // ── Step 5: Update tags[] array in influencer_profiles (denormalized cache) ─
    const tagStringArray = finalTags.map(t => t.tag);
    await serviceClient
      .from("influencer_profiles")
      .update({ tags: tagStringArray })
      .eq("id", profile_id);

    // Also update influencers_cache for search ranking
    await serviceClient
      .from("influencers_cache")
      .update({ tags: tagStringArray })
      .eq("platform", profile.platform)
      .eq("username", profile.username);

    const elapsedMs = Date.now() - startMs;
    console.log(`[extract-creator-tags] ${profile.platform}/${profile.username}: ${finalTags.length} tags in ${elapsedMs}ms`);

    return new Response(JSON.stringify({
      success: true,
      tags: tagStringArray,
      count: finalTags.length,
      sources: {
        ai:      aiTags.length,
        hashtag: hashtagTags.length,
        bio:     bioTags.length,
        niche:   nicheTags.length,
      },
      elapsed_ms: elapsedMs,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[extract-creator-tags] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
