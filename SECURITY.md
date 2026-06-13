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

---

## Supabase Dashboard settings (required)

### 1. Phone OTP rate limits

Go to **Authentication → Rate Limits** (or **Auth → Settings** depending on dashboard version):

- Set a **max OTP sends per hour** per phone (e.g. 5–10).
- Enable **CAPTCHA** for OTP if available on your plan.
- The app's `OTP_MAX_SENDS_PER_SESSION` in `useRegistrationFlow.ts` is **not** a security control — it only improves UX.

### 2. Send SMS hook

Go to **Authentication → Hooks → Send SMS**:

- Point the hook URL to your deployed `unisms-hook` function.
- Copy the hook secret and set it as `SEND_SMS_HOOK_SECRET` via `supabase secrets set`.

### 3. Edge function secrets

```bash
supabase secrets set SEND_SMS_HOOK_SECRET="v1,whsec_..."
supabase secrets set UNISMS_API_SECRET_KEY="your-api-secret-key"
# Optional — only if UniSMS approved a custom sender ID for your business:
# supabase secrets set UNISMS_SENDER_ID="YourBrand"
```

`complete-registration` and `verify-login` use built-in env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

### 4. Deploy migration + functions

```bash
cd mobile
supabase db push
supabase functions deploy unisms-hook
supabase functions deploy complete-registration
supabase functions deploy verify-login
```

---

## How login works now

```
Registration (first time):
  Phone → OTP (SMS via unisms-hook) → verify OTP → profile + PIN
  → complete-registration (server hashes PIN with bcrypt)

Return login:
  Phone + PIN → verify-login edge function
    → server bcrypt.compare (never on client)
    → on success: admin generateLink (hidden internal email) → token_hash
    → app calls auth.verifyOtp(token_hash, type: email) → Supabase session

Why the hidden email?
  Supabase generateLink only works with email, not phone.
  At registration we store `{userId}@login.disasterlink.local` — users never see it.
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

## File map

| File | Purpose |
|------|---------|
| `supabase/migrations/20250614000000_security_profiles_rls.sql` | RLS lockdown, view, login_attempts |
| `supabase/functions/complete-registration/` | Registration profile + bcrypt PIN |
| `supabase/functions/verify-login/` | PIN login + session token |
| `lib/login.ts` | Client login API (no PIN comparison) |
| `lib/profile.ts` | Read `profiles_public` only |
| `app/(auth)/login.tsx` | Login UI |
