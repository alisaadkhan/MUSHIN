// supabase/functions/_shared/huggingface.ts
// HuggingFace Inference API utilities
// ─────────────────────────────────────────────────────────────────────────────
// Models:
//   Text generation : mistralai/Mistral-7B-Instruct-v0.2
//   Embeddings      : BAAI/bge-large-en-v1.5  (1024-dim)
//
// Failsafe design: every exported function throws on unrecoverable errors
// so callers can catch and fall back to non-AI paths.
// ─────────────────────────────────────────────────────────────────────────────

const HF_API      = "https://api-inference.huggingface.co/models";
const TEXT_MODEL  = "mistralai/Mistral-7B-Instruct-v0.2";
const EMBED_MODEL = "BAAI/bge-large-en-v1.5";

// ─── JSON extraction ──────────────────────────────────────────────────────────
/** Extract the first valid JSON object or array from LLM free-text output.
 *  Handles markdown code fences, leading prose, and trailing text. */
export function extractJsonFromText(text: string): unknown {
  // Try fenced code block (```json ... ```)
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)```/);
  const candidate = fenced ? fenced[1].trim() : text.trim();

  // Find the first { or [ and work from there
  const objStart  = candidate.indexOf("{");
  const arrStart  = candidate.indexOf("[");
  const hasObj    = objStart >= 0;
  const hasArr    = arrStart >= 0;

  if (!hasObj && !hasArr) throw new Error("No JSON structure found in model output");

  const useObj = hasObj && (!hasArr || objStart < arrStart);
  const start  = useObj ? objStart : arrStart;
  const end    = useObj ? candidate.lastIndexOf("}") : candidate.lastIndexOf("]");

  if (end < start) throw new Error("Malformed JSON in model output");

  return JSON.parse(candidate.slice(start, end + 1));
}

// ─── Prompt formatting ────────────────────────────────────────────────────────
/** Format a user+system message for Mistral-7B-Instruct's special tokens. */
function formatMistralPrompt(system: string, user: string): string {
  // Mistral-7B-Instruct chat template: <s>[INST] {instruction} [/INST]
  // System instructions are embedded inside the [INST] block.
  return `<s>[INST] ${system.trim()}\n\n${user.trim()} [/INST]`;
}

// ─── Text generation ──────────────────────────────────────────────────────────
/** Generate text using Mistral-7B-Instruct-v0.2.
 *  Prompts the model to return JSON; caller should use extractJsonFromText().
 *  @throws if the API returns a non-OK status or an unexpected format. */
export async function generateText(
  system: string,
  user: string,
  apiKey: string,
  options: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
): Promise<string> {
  const prompt     = formatMistralPrompt(system, user);
  const timeoutMs  = options.timeoutMs ?? 45_000;
  const controller = new AbortController();
  const tid        = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${HF_API}/${TEXT_MODEL}`, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens:  options.maxTokens  ?? 512,
          temperature:     options.temperature ?? 0.2,
          return_full_text: false,
          do_sample:        true,
          repetition_penalty: 1.1,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      // HF returns 503 when the model is loading (cold start) — caller may retry
      throw new Error(`HuggingFace text API ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();

    // HF inference API wraps output as [{ generated_text: "..." }]
    if (Array.isArray(data) && data[0]?.generated_text != null) {
      return data[0].generated_text as string;
    }
    if (typeof data?.generated_text === "string") {
      return data.generated_text;
    }
    throw new Error(`Unexpected HuggingFace response shape: ${JSON.stringify(data).slice(0, 200)}`);
  } finally {
    clearTimeout(tid);
  }
}

// ─── Embeddings ───────────────────────────────────────────────────────────────
/** Generate a 1024-dimensional embedding using BAAI/bge-large-en-v1.5.
 *  @throws if the API returns a non-OK status or unexpected shape. */
export async function generateEmbedding(
  text: string,
  apiKey: string,
  timeoutMs = 30_000,
): Promise<number[]> {
  const controller = new AbortController();
  const tid        = setTimeout(() => controller.abort(), timeoutMs);

  // BGE models work best when text <= 512 tokens; truncate for safety
  const truncated = text.slice(0, 2000);

  try {
    const res = await fetch(`${HF_API}/${EMBED_MODEL}`, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body:   JSON.stringify({ inputs: truncated }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`HuggingFace embedding API ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();

    // BGE returns either [[...floats...]] or [...floats...] directly
    if (Array.isArray(data)) {
      if (Array.isArray(data[0])) return data[0] as number[];      // nested
      if (typeof data[0] === "number") return data as number[];     // flat
    }
    throw new Error(`Unexpected embedding response: ${JSON.stringify(data).slice(0, 100)}`);
  } finally {
    clearTimeout(tid);
  }
}

// ─── Niche / tag constants ────────────────────────────────────────────────────
export const STOPWORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "is","are","was","were","be","been","has","have","had","do","does","did",
  "i","we","you","he","she","they","it","my","our","your","his","her","their",
  "this","that","these","those","here","there","what","which","who","how",
  "not","no","so","as","by","from","up","out","about","than","more","also",
  "just","very","can","will","would","could","should","may","might",
]);

/** Normalise tags: lowercase, remove stopwords, deduplicate, sort by length desc. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
    if (!t || t.length < 2 || t.length > 40) continue;
    if (STOPWORDS.has(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.sort((a, b) => b.length - a.length);
}

/** Extract rough keyword tags from free-form bio text (failsafe, no AI needed). */
export function extractTagsFromBio(bio: string, niche: string | null): string[] {
  const TOPIC_KEYWORDS: Record<string, string[]> = {
    tech:       ["tech","technology","software","coding","programming","developer","ai","digital","gadget","app","startup","iot","cloud","cybersecurity"],
    gaming:     ["gaming","gamer","game","esports","streamer","twitch","playstation","xbox","pc","console","minecraft","fortnite"],
    fitness:    ["fitness","gym","workout","exercise","training","health","nutrition","diet","yoga","running","cardio","muscle","bodybuilding"],
    beauty:     ["beauty","makeup","skincare","cosmetics","lipstick","foundation","glam","highlighter","blush","contour","eyeshadow"],
    fashion:    ["fashion","style","ootd","clothing","outfit","wear","brand","luxury","designer","streetwear","vintage"],
    food:       ["food","recipe","cooking","chef","restaurant","foodie","cuisine","baking","breakfast","lunch","dinner","dessert","biryani"],
    travel:     ["travel","trip","tour","adventure","explore","destination","hotel","flight","holiday","vacation","backpacking"],
    education:  ["education","learning","student","teacher","study","university","school","knowledge","tutorial","course","academic"],
    cricket:    ["cricket","icc","psl","batting","bowling","wicket","match","test","odi","t20"],
    music:      ["music","song","singer","artist","album","lyrics","rap","pop","rnb","dj","producer","sound"],
    comedy:     ["comedy","funny","humor","memes","jokes","standup","skit","viral","entertainment","trending"],
    lifestyle:  ["lifestyle","daily","routine","vlog","life","family","home","motivation","inspiration"],
    finance:    ["finance","money","investing","stocks","crypto","business","entrepreneur","startup","economy","wealth"],
    sports:     ["sports","football","hockey","basketball","athletics","player","match","championship","cup"],
    vlogging:   ["vlog","vlogger","daily","diary","day","life","experience","behind","scenes"],
    pakistan:   ["pakistan","pakistani","psl","karachi","lahore","islamabad","multan","peshawar","urdu","pk"],
  };

  const text    = (bio + " " + (niche || "")).toLowerCase();
  const found   = new Set<string>();

  // Hashtag extraction
  for (const m of text.matchAll(/#([a-z0-9]+)/g)) found.add(m[1]);

  // Keyword matching
  for (const [tag, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) found.add(tag);
  }

  return normalizeTags([...found]);
}
