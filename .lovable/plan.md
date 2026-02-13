
# Fix: "Add to List" Crashes App (White Screen)

## Root Cause

When an influencer is added to a list, the success toast at line 152 of `SearchPage.tsx` renders a `<Link>` component from `react-router-dom`. Toasts render via a portal outside the React Router tree, so `<Link>` cannot access the router context and throws:

```text
Cannot destructure property 'basename' of 'React2.useContext(...)' as it is null
```

This crashes the entire app with a white screen.

## Fix

Replace the `<Link>` in the toast description with a plain `<a>` tag or just plain text. Since we want the user to navigate to the list, we can use a regular anchor tag or `window.location`.

### File: `src/pages/SearchPage.tsx` (line ~150-155)

**Before:**
```tsx
description: (
  <span>
    Added to <Link to={`/lists/${listId}`} className="underline font-medium">{listName}</Link>
  </span>
),
```

**After:**
```tsx
description: (
  <span>
    Added to <a href={`/lists/${listId}`} className="underline font-medium">{listName}</a>
  </span>
),
```

Using a plain `<a>` tag avoids the Router context dependency while still giving the user a clickable link to their list. This will cause a full page navigation rather than a client-side route, but since it's a toast link (rarely clicked), this is perfectly acceptable.

## After Fix: Re-test

After applying this one-line fix, the full flow should work:
1. Search for "gaming" on Instagram/Karachi
2. Add result to a new list -- toast appears without crash
3. Save search -- works
4. Verify Lists, Saved Searches, History, and Dashboard pages all show live data
