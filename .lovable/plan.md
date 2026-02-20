

# Fix: Onboarding Redirect Loop (Token Refresh Storm)

## Problem

After logging in and reaching the onboarding page, the user gets redirected back to `/auth`. This happens because:

1. Login triggers many concurrent token refresh requests
2. Some hit the 429 rate limit and fail
3. Failed refreshes fire `onAuthStateChange` with a null session
4. The current handler blindly sets `user = null` on any null session
5. `ProtectedRoute` sees `!user` and redirects to `/auth`

## Root Cause

In `src/contexts/AuthContext.tsx`, the `onAuthStateChange` handler does not check the `_event` parameter. It treats all null sessions the same, including temporary refresh failures.

## Fix

**File:** `src/contexts/AuthContext.tsx`

Update the `onAuthStateChange` callback to:
- Use the `event` parameter (currently ignored as `_event`)
- Only clear user/profile/session on an explicit `SIGNED_OUT` event
- For all other events with a valid session, update normally
- Ignore null sessions from non-signout events (e.g., failed token refreshes)

```typescript
// Before (broken):
async (_event, newSession) => {
  setSession(newSession);
  setUser(newSession?.user ?? null);
  if (newSession?.user && newSession.user.email_confirmed_at) {
    setTimeout(() => fetchProfileAndWorkspace(newSession.user.id), 0);
  } else {
    setProfile(null);
    setWorkspace(null);
  }
  setLoading(false);
}

// After (fixed):
async (event, newSession) => {
  if (event === 'SIGNED_OUT') {
    setSession(null);
    setUser(null);
    setProfile(null);
    setWorkspace(null);
    setLoading(false);
    return;
  }

  if (newSession) {
    setSession(newSession);
    setUser(newSession.user);
    if (newSession.user.email_confirmed_at) {
      setTimeout(() => fetchProfileAndWorkspace(newSession.user.id), 0);
    }
  }
  setLoading(false);
}
```

This single change prevents token refresh failures (429s) from wiping the user state and causing the redirect loop.

## Files

| Action | File |
|--------|------|
| Modify | `src/contexts/AuthContext.tsx` -- Fix onAuthStateChange to only clear state on SIGNED_OUT |

## Testing

After the fix:
1. Log in with `alisaad75878@gmail.com`
2. Reach onboarding page
3. Fill in name, click Continue through all steps
4. Click "Go to Dashboard" -- should navigate to `/dashboard` without redirecting to `/auth`

