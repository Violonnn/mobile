# Administrator recovery: Auth email without a valid official profile

When **Create invite** reports that an email already exists in Authentication and requires manual review, do **not** automatically delete, reset, convert, or attach that Auth user from the app.

This usually means a previous test or abandoned signup left an `auth.users` row without a legitimate active official (`mayor` / `officer`) profile.

## Goals

- Keep Auth email uniqueness intact (no second account for the same email).
- Resolve abandoned rows only through an authorized support action.
- Issue a new official invite only after the email is free or the existing account is confirmed legitimate.

## Recovery steps

1. **Confirm the request**  
   Verify with the intended official (or project lead) that this email should receive a new invite.

2. **Inspect in Supabase Dashboard**  
   - Authentication → Users: find the user by email. Note `id`, created time, last sign-in, and providers.  
   - Table Editor → `app_profiles`: look up the same `id`.  
     - No row, or role is not an active `mayor`/`officer` → treat as orphan / abandoned.  
     - Active official row → do **not** invite again; the account already exists.

3. **Decide the authorized action** (pick one; do not improvise from the client)  
   - **Orphan test account:** An authorized operator may delete the Auth user in the Dashboard (or via Admin API with service role) after confirming it is safe. Related profile rows, if any, should be cleaned only if they are clearly incomplete test data.  
   - **Legitimate official:** Do not delete. Have them sign in with the existing account, or use a different government email for a new invite.  
   - **Uncertain:** Leave the Auth user alone and escalate; never auto-convert a resident (or other) Auth identity into an official via invite.

4. **Re-issue the invite**  
   After the email is no longer present in Auth (or a different email is chosen), create a new invite from the Admin screen. The server will reject the email again if Auth still has it.

## What this flow must never do

- Automatic Auth user deletion from invite creation or registration.
- Automatic password reset or email change to “free” the address.
- Automatic role conversion (e.g. resident → officer) by consuming an invite.
- Telling an unauthenticated invite recipient whether an email or phone already exists.

## Related code

- `create_official_invite` — admin field errors + `requires_manual_review`
- `check_official_invite_identities` — shared server probe (service role)
- `official-invite-registration` Edge Function — re-checks identities; logs internal reason; returns a generic error to the recipient
