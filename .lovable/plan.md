Add Follower Range Filter to Discover Page

&nbsp;

What's New

&nbsp;

Everything from the Phase 10 plan is already implemented except the Follower Range filter on the Discover page. This plan adds that single remaining feature.

&nbsp;

Changes

&nbsp;

1. Search Page -- Add Follower Range Dropdown

&nbsp;

File: src/pages/SearchPage.tsx

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Add a new state variable followerRange (default: "any")

&nbsp;

&nbsp;

&nbsp;

Add a 5th filter column (or place it in a new row below the existing filters) using the shadcn Select component

&nbsp;

&nbsp;

&nbsp;

Options: "Any", "1K - 10K", "10K - 50K", "50K - 100K", "100K+"

&nbsp;

&nbsp;

&nbsp;

Pass followerRange to the edge function call alongside query, platform, and location

&nbsp;

&nbsp;

&nbsp;

The grid changes from md:grid-cols-4 to md:grid-cols-5 to accommodate the new filter (or wraps to a second row on smaller screens)

&nbsp;

2. Edge Function -- Accept and Apply Follower Range Filter

&nbsp;

File: supabase/functions/search-influencers/index.ts

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Parse the new followerRange field from the request body

&nbsp;

&nbsp;

&nbsp;

After deduplication, if followerRange is not "any", filter results:

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

"1k-10k": keep results where extracted_followers is between 1,000 and 10,000

&nbsp;

&nbsp;

&nbsp;

"10k-50k": between 10,000 and 50,000

&nbsp;

&nbsp;

&nbsp;

"50k-100k": between 50,000 and 100,000

&nbsp;

&nbsp;

&nbsp;

"100k+": 100,000 or more

&nbsp;

&nbsp;

&nbsp;

Exclude results with no extracted_followers when a specific range is selected

&nbsp;

&nbsp;

&nbsp;

Apply this filter before returning results

&nbsp;

Files Summary

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Action

&nbsp;

&nbsp;

&nbsp;

File

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Modify

&nbsp;

&nbsp;

&nbsp;

src/pages/SearchPage.tsx -- Add follower range dropdown and pass to edge function

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Modify

&nbsp;

&nbsp;

&nbsp;

supabase/functions/search-influencers/index.ts -- Accept followerRange param and filter results

&nbsp;

Technical Notes

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

No database changes needed

&nbsp;

&nbsp;

&nbsp;

No new dependencies

&nbsp;

&nbsp;

&nbsp;

The edge function will be auto-deployed after the change

&nbsp;

&nbsp;

&nbsp;

Results with no detectable follower count are excluded when a specific range is selected, since we cannot determine if they match