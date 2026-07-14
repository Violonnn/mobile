# DisasterLink Mobile — Security Checklist

This document explains what we fixed, what you must configure in Supabase, and how login works.

---

## What was fixed

| Gap | Fix |
|-----|-----|
| **RLS bypass** | Removed client INSERT/UPDATE on `profiles`. Only edge functions (service role) can write `pin_hash`. |
| **pin_hash leak** | Column-level grants + `profiles_public` view hide `pin_hash` from the mobile app. |
| **No login** | `/(auth)/login` screen + `verify-login` edge function with server-side bcrypt. |
| **Weak registration** | `complete-registration` trims input, validates max lengths, rejects extra JSON fields, returns generic errors. |
| **OTP abuse** | Documented Supabase Dashboard rate limits (client cooldown is UX only). |
| **PIN brute force** | `login_attempts` table locks a phone after 5 wrong PINs for 15 minutes. |
| **Advisor: mutable search_path** | `handle_profiles_updated_at` recreated with `set search_path = ''` (`20250616000000_fix_advisor_warnings.sql`). |
| **Advisor: public EXECUTE on `rls_auto_enable()`** | Same migration revokes EXECUTE from `public`, `anon`, `authenticated`. |

---

## Supabase Dashboard settings (required)

### 1. Phone OTP rate limits

Go to **Authentication → Rate Limits** (or **Auth → Settings** depending on dashboard version):

- Set a **max OTP sends per hour** per phone (e.g. 5–10).
- Enable **CAPTCHA** for OTP if available on your plan.
- The app's `OTP_MAX_SENDS_PER_SESSION` in `useRegistrationFlow.ts` is **not** a security control — it only improves UX.

### 2. Send SMS hook

Go to **Authentication → Hooks → Send SMS**:

- Point the hook URL to your deployed `iprogsms-hook` function (delivers OTP SMS via IPROG SMS).
- Copy the hook secret and set it as `SEND_SMS_HOOK_SECRET` via `supabase secrets set`.

### 3. Edge function secrets

```bash
supabase secrets set SEND_SMS_HOOK_SECRET="v1,whsec_..."
supabase secrets set IPROG_SMS_API_TOKEN="your-api-token"
# Note: the IPROG sender name is configured on the IPROG account, not via a secret.
# A custom approved sender name is required to reach Smart/TNT numbers
# (see https://www.iprogsms.com/sender-names).
```

`complete-registration` and `verify-login` use built-in env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

### 4. Leaked password protection (Free tier: not available)

Supabase's leaked-password check (Have I Been Pwned) is a **Pro+** setting. This
project is on the **Free** plan, so the Security Advisor warning
"Leaked Password Protection Disabled" is **expected and cannot be cleared** from
the dashboard.

This is acceptable here because the app's only end-user credential is a
**phone OTP + 6-digit PIN** handled by edge functions — there is no native
Supabase email/password login path in this codebase. (The
`{userId}@login.disasterlink.invalid` addresses are server-only, used so
`generateLink` can mint a session after a PIN check; users never type them.)

Caveat: any account you create **manually in the Supabase Dashboard** with an
email/password would not benefit from HIBP on Free — use unique passwords via a
password manager, or upgrade to Pro to enable the check. When enabled, it only
blocks new signups/password changes (not retroactive) and returns a distinct
error any future password UI should surface specifically.

### 5. Deploy migration + functions

```bash
cd mobile
supabase db push
supabase functions deploy iprogsms-hook
supabase functions deploy complete-registration
supabase functions deploy verify-login
```

---

## How login works now

```
Registration (first time):
  Phone → OTP (SMS via iprogsms-hook → IPROG) → verify OTP → profile + PIN
  → complete-registration (server hashes PIN with bcrypt)

Return login:
  Phone + PIN → verify-login edge function
    → server bcrypt.compare (never on client)
    → on success: admin generateLink (hidden internal email) → token_hash
    → app calls auth.verifyOtp(token_hash, type: email) → Supabase session

Why the hidden email?
  Supabase generateLink only works with email, not phone.
  At registration we store `{userId}@login.disasterlink.invalid` — users never see it.
  It exists only so the server can create a session after PIN verification.
```

**Rule for students:** Never fetch `pin_hash`. Never compare PIN in React Native. Always call `verify-login`.

---

## Manual test steps

### 1. Register end-to-end

1. Open app → **Get Started** → enter phone → OTP → profile → PIN.
2. Confirm success alert and row in Supabase **Table Editor → profiles**.

### 2. pin_hash is hidden from clients

In Supabase SQL editor (as authenticated user simulation) or from the app:

```javascript
// Should work — no pin_hash column
const { data } = await supabase.from('profiles_public').select('*').single();

// Should fail or omit pin_hash
const { error } = await supabase.from('profiles').select('pin_hash').single();
```

### 3. Direct client insert fails

```javascript
const { error } = await supabase.from('profiles').insert({
  id: user.id,
  phone: '+639...',
  pin_hash: 'hacked',
  // ...other fields
});
// Expect RLS / permission error
```

### 4. Login with correct PIN

1. Sign out (or fresh install).
2. **Login** → same phone + PIN → success → session in Auth.

### 5. Wrong PIN + rate limit

1. Enter wrong PIN 5 times → generic error each time.
2. 6th attempt → "Too many failed attempts. Try again in 15 minutes."
3. Correct PIN after lockout → still blocked until lockout expires.

---

## Security Advisor status

| Advisor item | Status |
|--------------|--------|
| Function Search Path Mutable (`handle_profiles_updated_at`) | Fixed in `20250616000000_fix_advisor_warnings.sql` |
| Public / signed-in EXECUTE on `rls_auto_enable()` | Revoked in same migration |
| Leaked Password Protection Disabled | Expected on Free plan (see Dashboard settings §4) |
| RLS Enabled No Policy on `login_attempts` | Intentional — service-role only, clients fully blocked |
| RLS Enabled No Policy on `registration_otp_sends` | Intentional — service-role only, clients fully blocked |

---

## Follow-ups (not yet implemented)

- **Weak PIN blocklist.** `isValidPin` (`supabase/functions/_shared/validation.ts`)
  only enforces `^\d{6}$`. It does not reject obviously weak PINs (`000000`,
  `123456`, repeated digits, birth-year patterns). Adding a shared reject list
  used by `complete-registration` and `reset-pin` (with matching client UX) is
  the real analog to leaked-password protection for this PIN-based architecture.
  It complements — does not replace — server bcrypt and the `login_attempts`
  lockout.

---

## File map

| File | Purpose |
|------|---------|
| `supabase/migrations/20250614000000_security_profiles_rls.sql` | RLS lockdown, view, login_attempts |
| `supabase/migrations/20250616000000_fix_advisor_warnings.sql` | Advisor fixes: search_path + revoke rls_auto_enable |
| `supabase/functions/complete-registration/` | Registration profile + bcrypt PIN |
| `supabase/functions/verify-login/` | PIN login + session token |
| `lib/login.ts` | Client login API (no PIN comparison) |
| `lib/profile.ts` | Read `profiles_public` only |
| `app/(auth)/login.tsx` | Login UI |
