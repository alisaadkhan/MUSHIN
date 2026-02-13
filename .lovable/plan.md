

# Authentication Flow — Revised Implementation

## Overview
Complete email/password + Google OAuth authentication with all edge cases handled: resend verification, redirect-when-logged-in, recovery token handling, and robust error states.

## Database Changes

Single migration adding the `get_user_workspace` RPC:

```sql
CREATE OR REPLACE FUNCTION get_user_workspace()
RETURNS TABLE (workspace_id UUID, role TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT workspace_id, role::TEXT FROM workspace_members WHERE user_id = auth.uid() LIMIT 1;
$$;
```

## Files to Create

### 1. `src/contexts/AuthContext.tsx`
- `onAuthStateChange` set up BEFORE `getSession`
- State: `user`, `session`, `profile`, `workspace`, `loading`, `needsEmailVerification`
- Methods: `signUp`, `signIn`, `signInWithGoogle`, `signOut`, `resetPassword`, `updatePassword`, `resendVerificationEmail`
- `resendVerificationEmail(email)` calls `supabase.auth.resend({ type: 'signup', email })`
- `needsEmailVerification` computed as `!!user && !user.email_confirmed_at`
- Profile and workspace fetched after confirmed login, with error handling (fallback to null, app still renders)
- Profile/workspace cached in state, only re-fetched on auth state change
- Google OAuth redirect handled automatically by the `onAuthStateChange` listener (no manual navigation after `signInWithOAuth`)

### 2. `src/pages/Auth.tsx`
Four modes: `sign-in`, `sign-up`, `forgot-password`, `verification-notice`
- **Redirect if authenticated:** `useEffect` checks `user` from context; if logged in and email confirmed, navigate to `/`
- **Sign In mode:** email + password, Google button, "Forgot password?" link, toggle to sign up. On `email_not_confirmed` error, switch to verification-notice mode with resend option
- **Sign Up mode:** email + password + confirm password, Google button, toggle to sign in. On success, switch to verification-notice mode
- **Forgot Password mode:** email field, sends reset link with `redirectTo: window.location.origin + '/update-password'`, back-to-sign-in link
- **Verification Notice mode:** message "Check your email", resend button calling `resendVerificationEmail(email)`, back-to-sign-in link
- Glass card centered on `AuroraBackground`, no sidebar, logo at top
- All errors via toast, loading spinners on buttons

### 3. `src/pages/UpdatePassword.tsx`
- New password + confirm password form in glass card with aurora background
- Calls `supabase.auth.updateUser({ password })`
- If user has no recovery session (not in a password reset flow), redirect to `/`
- Success toast then redirect to dashboard

### 4. `src/components/auth/ProtectedRoute.tsx`
- Loading state: centered spinner
- No session: redirect to `/auth`
- Has user but `needsEmailVerification`: redirect to `/auth?verify=required`
- Otherwise: render children
- Special case: `/update-password` route will NOT check email confirmation (recovery sessions may not have confirmed email)

### 5. `src/components/auth/UserMenu.tsx`
- Avatar with initials fallback + user email/name
- Dropdown: "Settings" link, "Sign Out" action
- Glass-card styling in sidebar footer

## Files to Modify

### 6. `src/App.tsx`
- Wrap in `AuthProvider`
- `/auth` route outside `AppLayout` (no sidebar)
- `/update-password` route with a simpler guard (authenticated but no email-confirmation check)
- All other routes wrapped in `ProtectedRoute` inside `AppLayout`

### 7. `src/components/layout/AppSidebar.tsx`
- Replace static credits footer section with `UserMenu` component below the credits bar

## Google OAuth
Configure via Lovable Cloud's social login tool (generates `src/integrations/lovable/` automatically). Auth page calls `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`.

## Error Handling Summary

| Scenario | Behavior |
|---|---|
| Wrong password | Toast: "Invalid login credentials" |
| Unverified email login attempt | Switch to verification-notice mode with resend option |
| Expired reset link | Toast: "Link expired, request a new one" |
| Profile fetch fails | Profile set to null, app still loads with fallback display |
| Workspace fetch fails | Workspace set to null, dashboard shows setup prompt |
| Visit `/auth` while logged in | Auto-redirect to `/` |
| Visit protected route while logged out | Redirect to `/auth` |

