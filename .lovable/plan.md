

# Phase 1 Completion: Settings, Onboarding, and Minor Enhancements

## Overview
Create the Settings page, Onboarding flow, update ProtectedRoute with onboarding gate and profile-loading timeout, and add `refreshProfile` to AuthContext. Incorporates all the minor enhancements: profile fetch failure handling, settings merging, password edge cases, avatar validation, and onboarding redirect guard.

## No Database Changes Required
All needed columns exist: `profiles.onboarding_completed`, `profiles.full_name`, `profiles.avatar_url`, `workspaces.settings` (JSONB).

## Files to Modify

### 1. `src/contexts/AuthContext.tsx`
- Add `profileError` boolean state -- set to `true` if `fetchProfileAndWorkspace` catches an error
- Add `refreshProfile()` method that re-calls `fetchProfileAndWorkspace(user.id)` and resets `profileError`
- Expose `refreshProfile` and `profileError` in the context interface and provider value

### 2. `src/components/auth/ProtectedRoute.tsx`
- Pull `profile`, `profileError`, `refreshProfile`, and `workspace` from `useAuth()`
- After auth loading resolves:
  - If `user` exists, email verified, but `profile === null` and no `profileError` -- show spinner (profile still loading)
  - If `profileError` -- show "Failed to load profile" message with a "Retry" button calling `refreshProfile()`
  - If `profile.onboarding_completed === false` and path is not `/onboarding` -- redirect to `/onboarding`
  - Otherwise render children

### 3. `src/App.tsx`
Add two new routes:
- `/onboarding` -- wrapped in `ProtectedRoute`, full-screen (no `AppLayout`)
- `/settings` -- wrapped in `ProtectedRoute` + `AppLayout`

## Files to Create

### 4. `src/pages/Onboarding.tsx`
Full-screen multi-step flow with `AuroraBackground`:

**Guard:** If `profile.onboarding_completed` is already `true`, redirect to `/` immediately.

**Step 1 -- Name and Company:**
- Full name input (required, pre-filled from `profile.full_name` if set)
- Company/brand name (optional)

**Step 2 -- Preferences:**
- Primary platform: button group (Instagram, TikTok, YouTube)
- Use case: button group (Brand partnerships, Talent management, Market research)

**Step 3 -- Complete:**
- Success message, "Go to Dashboard" button

**On completion:**
1. Update `profiles` with `full_name` and `onboarding_completed: true`
2. Merge workspace settings (fetch current `settings` first, spread new values on top, then update)
3. `await refreshProfile()`
4. `navigate("/")`

### 5. `src/pages/Settings.tsx`
Tabbed page inside AppLayout:

**Profile Tab:**
- Full name input
- Avatar URL input with simple URL validation (must start with `http://` or `https://`)
- Email (read-only from `user.email`)
- Save button: updates `profiles` table, then calls `refreshProfile()`
- Success/error toasts

**Security Tab:**
- New password + confirm password (no current password field)
- Update button: calls `updatePassword()` from context
- Handles edge cases: password mismatch (client-side check), weak password and session-expired errors (from Supabase, shown via toast)
- User stays logged in after success

## Technical Details

### Profile Fetch Failure Handling
```text
AuthContext:
  profileError state (boolean, default false)
  fetchProfileAndWorkspace:
    try { fetch... } 
    catch { setProfileError(true) }
  refreshProfile:
    setProfileError(false)
    await fetchProfileAndWorkspace(user.id)

ProtectedRoute:
  if (profileError) -> show error card with Retry button
```

### Workspace Settings Merging
```text
// In Onboarding Step 2 completion:
1. Fetch current: SELECT settings FROM workspaces WHERE id = workspace_id
2. Merge: { ...currentSettings, primary_platform, use_case }
3. Update: UPDATE workspaces SET settings = merged WHERE id = workspace_id
```

### ProtectedRoute Decision Flow
```text
loading?                    -> spinner
no user?                    -> /auth
needsEmailVerification?     -> /auth?verify=required (except /update-password)
profileError?               -> error card + retry
profile === null?           -> spinner (still loading)
!onboarding_completed?      -> /onboarding (except /onboarding itself)
else                        -> render children
```

### Avatar URL Validation
Simple check before saving: if non-empty, must match `/^https?:\/\/.+/`. Show toast if invalid.

## E2E Testing Checklist
1. Sign up -> verification notice
2. Click "Resend email" on verification notice -> success toast
3. Sign in with wrong password -> error toast
4. Sign in with unverified email -> verification notice
5. Forgot password -> success toast
6. Visit `/` logged out -> redirect `/auth`
7. Visit `/auth` logged in -> redirect `/`
8. First login (onboarding incomplete) -> redirect `/onboarding`
9. Complete onboarding -> dashboard, revisiting `/onboarding` redirects to `/`
10. Settings: update name -> reflected in sidebar UserMenu
11. Settings: update password (weak password) -> error toast
12. Settings: update password (valid) -> success toast, stays logged in
13. Settings: invalid avatar URL -> validation toast
14. Sign out -> redirect `/auth`
