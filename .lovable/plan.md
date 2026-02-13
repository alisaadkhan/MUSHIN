### **Document Overview**

This review plan consolidates the original fixes for location and platform filtering with an expanded Pakistan keyword list to significantly improve match rates for Pakistan‑based influencers. All changes are server‑side, require no frontend modifications, and are ready for implementation.

---

## **🔍 Issues Found (Original Diagnosis)**


| **Issue**                               | **Identified**                                                                                         | **Impact**                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| **Location ignored for "All Pakistan"** | Line 97 sets `locationPart = ""` when location is "All Pakistan", omitting the location term entirely. | No location bias → global results dominate.      |
| **No** `gl` **(geolocation) parameter** | Serper API call lacks `gl: "pk"` to bias results toward Pakistan.                                      | Google does not prioritize Pakistan.             |
| **No server‑side filtering**            | Raw Serper results returned without checking for Pakistan‑related keywords.                            | Non‑Pakistan profiles (Singapore, US) are shown. |
| **Platform leakage in URL parsing**     | `extractUsername` does not verify that the result URL belongs to the selected platform's domain.       | YouTube links appear in Instagram searches.      |


---

## **🛠️ Proposed Changes (Server‑Side Only)**

All modifications are to be made in `supabase/functions/search-influencers/index.ts`.

### **A. Add Geolocation Parameter to Serper Request**

Include `gl: "pk"` in the request body to bias results toward Pakistan:

typescript

```
body: {
  q: serperQuery,
  num: 30,               // increased from 20 for better filtering pool
  gl: "pk",              // country bias
  hl: "en"
}
```

### **B. Correct Location Term Construction**

Replace the existing `locationPart` logic (line 97) to always include a location term:

typescript

```
// Before:
const locationPart = location && location !== "All Pakistan" ? location : "";

// After:
const locationPart = location === "All Pakistan" ? "Pakistan" : (location || "Pakistan");
```

- Ensures `"Pakistan"` is used for "All Pakistan", city name for specific cities, and `"Pakistan"` as fallback.

### **C. Filter Results by Platform Domain**

Prevent cross‑platform leakage by validating the result URL against the selected platform’s domain:

typescript

```
const domainMap = {
  instagram: "instagram.com",
  tiktok: "tiktok.com",
  youtube: "youtube.com",
};
const expectedDomain = domainMap[platform];
const platformFiltered = data.organic.filter(item => 
  item.link.includes(expectedDomain)
);
```

### **D. Enhanced Pakistan Keyword Filtering (Soft Filter)**

Prioritize results that mention Pakistan or its cities using an **expanded keyword list** to catch more location variations. Keep the existing two‑pass logic that separates Pakistan‑matched results from others, then combines them (Pakistan‑first) and pads with non‑matching results up to a limit of 20.

#### **Updated Keyword List**

typescript

```
const PAKISTAN_KEYWORDS = [
  // Major cities (original + additions)
  "karachi", "lahore", "islamabad", "rawalpindi", "faisalabad",
  "multan", "peshawar", "quetta", "sialkot", "gujranwala",
  "hyderabad", "bahawalpur",

  // Common abbreviations and variations
  "paki", "pakistani", "isb", "lhr", "khi",

  // Regional terms
  "punjab", "sindh", "balochistan", "kpk", "khyber"
];
```

#### **Filtering Logic (Unchanged)**

typescript

```
const withLocation = [];
const withoutLocation = [];

for (const item of platformFiltered) {
  const text = (item.title + " " + item.snippet).toLowerCase();
  if (PAKISTAN_KEYWORDS.some(kw => text.includes(kw))) {
    withLocation.push(item);
  } else {
    withoutLocation.push(item);
  }
}

// Combine, putting Pakistan‑matched first, then pad with others up to 20
const finalResults = [...withLocation, ...withoutLocation].slice(0, 20);
```

- The logic remains identical; only the keyword list is expanded to improve recall.

### **E. Increase Fetch Limit to 30**

Already implemented in step A (`num: 30`) to provide a larger candidate pool for filtering.

---

## **📊 Summary of Edge Function Changes**


| **Change**                                   | **Purpose**                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| Add `gl: "pk"`                               | Bias Serper results toward Pakistan.                                         |
| Always include location term                 | Ensure query contains `"Pakistan"` or city name.                             |
| Validate result URLs against platform domain | Eliminate cross‑platform leakage.                                            |
| Expand Pakistan keyword list                 | Catch more location variations (cities, abbreviations, regions).             |
| Soft location filtering                      | Prioritize Pakistan‑matched results, pad with others to avoid empty results. |
| Increase `num` to 30                         | Provide more candidates for effective filtering.                             |


---

## **✅ Validation Plan (Testing Checklist)**

After implementation, verify the following:

1. **"All Pakistan" search** – e.g., `"gaming"` on Instagram → all displayed results should contain at least one of the expanded keywords in title or snippet. No Singapore/US profiles.
2. **Specific city search** – e.g., `"food blogger"` on Instagram with location `"Karachi"` → results should mention `"Karachi"` prominently.
3. **Platform isolation** – Instagram search returns only `instagram.com` links; TikTok only `tiktok.com`; YouTube only `youtube.com`.
4. **Low‑result scenario** – Niche query like `"handmade pottery"` → if few Pakistan‑matched results exist, non‑matching results should appear (padding), but Pakistan‑matched ones first.
5. **Keyword coverage** – Test with queries that should match `"quetta"`, `"punjab"`, `"isb"` etc., to ensure expanded list works.
6. **Credits & logging** – Confirm credits deduct, search history logs, and cache updates as before.

  
