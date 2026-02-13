

# Pre-Phase 2: Create Test User, Verify Phase 1, Then Plan Phase 2

## Step 1: Create a Verified Test User

Use Supabase admin API or SQL to create a user with a confirmed email for testing:
- Email: `test-phase1@influenceiq.test`
- Password: `TestPass123!`
- Set `email_confirmed_at` to current timestamp so the user can log in immediately

## Step 2: Test the Full Flow

Log in with the test user and verify:

1. **Onboarding gate**: After login, user is redirected to `/onboarding` (since `onboarding_completed` is `false`)
2. **Onboarding Step 1**: Enter full name and company name, proceed to next step
3. **Onboarding Step 2**: Select platform and use case preferences, proceed
4. **Onboarding Step 3**: See completion screen, click "Go to Dashboard"
5. **Dashboard**: Verify user lands on `/` after onboarding
6. **Onboarding re-access blocked**: Navigating to `/onboarding` redirects back to `/`
7. **Settings Profile tab**: Update full name, save, verify it reflects in sidebar
8. **Settings avatar validation**: Enter invalid URL, verify error toast
9. **Settings Security tab**: Update password, verify success toast
10. **Sign out**: Verify redirect to `/auth`

## Step 3: Confirm Database State

After testing, verify via SQL queries:
- `profiles.onboarding_completed = true`
- `profiles.full_name` updated
- `workspaces.settings` contains platform and use case preferences

## Step 4: Plan Phase 2

Once Phase 1 is fully verified, present a comprehensive Phase 2 plan. Phase 2 will likely cover the core product features:
- Influencer search/discovery with API integration
- List management (create, add influencers, manage)
- Saved searches functionality
- Search history tracking
- Credits system integration
- Dashboard with real data

