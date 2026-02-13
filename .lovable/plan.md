

# Reset Test Account Password

## What
Update the password for `test-phase1@influenceiq.test` to `Test1234!` so you can log in and test the search functionality.

## How
Create a temporary backend function that uses the admin API to set the new password, invoke it once, then remove it.

## Steps

1. Create a one-time edge function `reset-test-password` that:
   - Uses the service role key to call `auth.admin.updateUserById()`
   - Sets the password to `Test1234!` for the existing user
2. Deploy and invoke the function to reset the password
3. Delete the temporary function after use
4. You can then sign in at `/auth` with:
   - **Email:** `test-phase1@influenceiq.test`
   - **Password:** `Test1234!`

