# Soft Ranking for City-Specific Searches

## Problem

When a user picks a specific city like "Karachi", the query includes that city name, but Google snippets rarely mention it -- so most results get deprioritized and the user sees very few hits.

## Changes (Server-side only)

### File: `supabase/functions/search-influencers/index.ts`

**A. Always use "Pakistan" in the Serper query, regardless of city selection**

The selected city will only influence result ranking, not the query itself:

```text
// Current:
const locationPart = location === "All Pakistan" ? "Pakistan" : (location || "Pakistan");

// New:
const locationPart = "Pakistan";  // Always broad query; city used for ranking only
```

**B. Increase `num` from 50 to 100**

Larger candidate pool before filtering/ranking.

**C. Replace two-tier filtering with three-tier soft ranking**

After platform domain filtering, classify results into:

- **Tier 1**: Title/snippet contains the selected city name (e.g., "Karachi")
- **Tier 2**: Title/snippet contains any Pakistan keyword ("pakistan", "lahore", "punjab", etc.) but not the selected city
- **Tier 3**: No location indicators at all

Combine as `[...tier1, ...tier2, ...tier3].slice(0, 20)`.

When location is "All Pakistan", Tier 1 and Tier 2 merge (any Pakistan keyword = top tier).

**D. No changes to**: credit deduction, caching, search history logging, platform domain filtering, username extraction, or deduplication.

## Technical Detail

```text
// Determine the selected city (null if "All Pakistan")
const selectedCity = (location && location !== "All Pakistan") ? location.toLowerCase() : null;

// After platform domain filtering, rank into tiers
const tier1 = [];  // matches selected city
const tier2 = [];  // matches any Pakistan keyword but not selected city
const tier3 = [];  // no location match

for (const item of platformFiltered) {
  const text = ((item.title || "") + " " + (item.snippet || "")).toLowerCase();
  if (selectedCity && text.includes(selectedCity)) {
    tier1.push(item);
  } else if (PAKISTAN_KEYWORDS.some(kw => text.includes(kw))) {
    tier2.push(item);
  } else {
    tier3.push(item);
  }
}

const finalResults = [...tier1, ...tier2, ...tier3].slice(0, 20);
```

When `selectedCity` is null (All Pakistan), nothing goes to tier1 and all Pakistan-keyword matches land in tier2 -- same behavior as today.  
**City name as part of a larger word** – unlikely for Pakistani cities (e.g., "Karachi" is distinct).

- **Case‑insensitive matching** – the code already uses `.toLowerCase()`, so it's fine.
- **Performance** – filtering 100 items is trivial; no issue.