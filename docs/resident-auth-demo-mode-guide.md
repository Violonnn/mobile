# Resident Auth Demo Mode Guide

## Purpose

Use a **development-only demo mode** while migrating or polishing the resident sign-up and forgot-PIN screens. Demo mode lets you exercise the real UI, field validation, loading states, resend countdown, navigation, alerts, and completion popups **without sending SMS, creating Supabase users, changing PINs, or calling the registration/reset Edge Functions**.

It is a UI-testing tool only. It must never be enabled in a production build or used as an authentication shortcut.

## What the current app does

| Flow | Steps | Real external operations that demo mode must prevent |
| --- | --- | --- |
| Registration | Phone -> OTP -> Account information -> PIN | OTP status check, OTP SMS request, OTP verification, profile completion |
| Forgot PIN | Phone -> OTP -> New PIN | OTP SMS request, OTP verification, PIN reset |

The current registration screen is `app/(auth)/register.tsx`. Its logic lives in `hooks/useRegistrationFlow.ts` and calls `lib/registration.ts`.

The current forgot-PIN screen is `app/(auth)/forgot-password.tsx`. Its logic lives in `hooks/useForgotPasswordFlow.ts` and calls `lib/resetPin.ts`.

Do **not** replace the screen components or remove their validation. Instead, switch only the external operations at the boundary where the hooks call the registration/reset helpers.

## Scope: what stays real and what is simulated

### Keep real

- Phone number formatting and validation.
- Carrier-prefix validation and its messages.
- OTP length validation (six digits).
- OTP resend button, cooldown display, request limit display, loading indicators, and error layout.
- Registration details validation: names, birth month/year, age 18+, barangay, and terms acceptance.
- PIN validation: numeric-only, six digits, and matching confirmation.
- Existing screen transitions, back behavior, keyboard behavior, and the final navigation/modal experience.

### Simulate

- `fetchRegistrationOtpStatus` in registration.
- `requestRegistrationOtp` / `requestPasswordResetOtp`.
- `verifyRegistrationOtp` / `verifyPasswordResetOtp`.
- `completeRegistrationProfile`.
- `submitNewPin` and reset-session sign-out.
- Any screen data that normally requires a signed-in Supabase user.

### Never do in demo mode

- Send a real SMS or invoke the SMS/OTP Edge Function.
- Call `supabase.auth.verifyOtp`, `complete-registration`, or `reset-pin`.
- Write to Supabase Auth, database tables, Storage, or AsyncStorage as if a real account had been created.
- Use a service-role key, change RLS policies, or weaken production validation.
- Ship a fixed demo OTP in a production build.

## Recommended design

Create one local-only setting such as `EXPO_PUBLIC_DEMO_AUTH_MODE=true` for the development environment. The value is not a secret; it is a safety switch. The app must treat demo mode as allowed only when both conditions are true:

1. The build is a development build/local Expo session; and
2. `EXPO_PUBLIC_DEMO_AUTH_MODE` is explicitly `true`.

Use a small, single-purpose demo-auth adapter (or equivalent helper) behind the existing auth helpers. It returns the same result shapes as the real helper functions. The hooks and screen components should not need separate demo-only branches scattered through their UI code.

### Suggested demo outcomes

| Action | Demo result | UI expected to remain visible |
| --- | --- | --- |
| Request OTP | Success, one simulated send, 60-second cooldown | Send/loading state, OTP screen, resend state |
| Verify OTP `123456` | Success | Move to details/new-PIN screen |
| Verify any other complete OTP | Error: `Invalid or expired OTP. Please try again.` | OTP error state |
| Resend OTP | Success until the existing three-send UI limit | Cooldown and count/limit behavior |
| Complete registration | Success with no write | Existing route to `/(main)/home?welcome=1` and its welcome modal |
| Reset PIN | Success with no write | Existing `PIN updated` alert and login navigation |

The registration success experience should be tested by preserving the existing route to `/(main)/home` with `welcome=1`; this is what triggers the app’s current welcome modal. Do not invent a separate demo success popup.

## Implementation specification

This section is the handoff checklist for implementation. It intentionally describes the structure and acceptance criteria without changing the app code in this document.

### 1. Demo-mode contract

Use the following fixed contract so the feature is safe and predictable.

| Item | Requirement |
| --- | --- |
| Local environment switch | `EXPO_PUBLIC_DEMO_AUTH_MODE=true` |
| Runtime safety guard | Demo mode is true only when `__DEV__` is true **and** the environment switch is exactly `true` |
| Production behavior | Always false, even if a release environment accidentally contains the public flag |
| Demo OTP | `123456`; it is usable only after the runtime safety guard passes |
| Demo phone | Any number that passes the existing phone validator; use `917 555 0101` in the supplied fixtures |
| External effects | None: no SMS, Supabase Auth, Edge Function, table, Storage, or PIN write |
| Visible indication | A persistent `DEMO AUTH` banner includes `OTP: 123456` and states that SMS/Supabase writes are disabled |

The public environment value is not a secret and must not be relied upon as a security boundary. `__DEV__` is the mandatory second guard that prevents the demo path from being reachable in a release build.

### 2. One adapter boundary; no UI forks

Implementers should add one focused auth-mode module, for example `lib/demoAuth.ts`, rather than spreading `if (demo)` checks through screen components. It should expose:

- Whether demo auth is currently enabled.
- The fixed demo OTP and normal success/error outcomes.
- Simulated OTP status and send metadata.
- Simulated registration completion and PIN-reset completion.
- Optional instrumentation that records attempted external auth operations during testing.

The screen files `app/(auth)/register.tsx` and `app/(auth)/forgot-password.tsx` should continue rendering the same components and calling the same hook actions. Do not add demo-specific screen layouts, alternate validations, or duplicate submission handlers.

### 3. Exact integration points

Only these existing call paths are eligible for simulation. Every other production validation and user-visible state should remain intact.

| Existing location | Live behavior | Demo-mode behavior | Required returned behavior |
| --- | --- | --- | --- |
| `hooks/useRegistrationFlow.ts` → `fetchRegistrationOtpStatus` | Reads server OTP/registration state | Local status only | No existing registration error; zero sends; zero cooldown on first open |
| `hooks/useRegistrationFlow.ts` → `requestRegistrationOtp` | Calls `request-registration-otp` | Increment local demo send count | Success, send count 1–3, 60-second cooldown |
| `hooks/useRegistrationFlow.ts` → `verifyRegistrationOtp` | Calls `supabase.auth.verifyOtp` | Compare entered OTP with `123456` | Success only for `123456`; otherwise the normal invalid/expired error |
| `hooks/useRegistrationFlow.ts` → `completeRegistrationProfile` | Calls `complete-registration` | Return local success | Preserve the current home route with `welcome=1`; create no account/profile |
| `hooks/useForgotPasswordFlow.ts` → `requestPasswordResetOtp` | Calls shared OTP Edge Function | Increment local demo send count | Same generic sent-message and cooldown UX |
| `hooks/useForgotPasswordFlow.ts` → `verifyPasswordResetOtp` | Calls `supabase.auth.verifyOtp` | Compare entered OTP with `123456` | Success only for `123456`; do not mint a Supabase session |
| `hooks/useForgotPasswordFlow.ts` → `submitNewPin` | Calls `reset-pin` | Return local success | Preserve the current `PIN updated` alert and login route; change no PIN |
| `hooks/useForgotPasswordFlow.ts` cleanup → `endResetSession` | Signs out reset session | No-op | No external action; preserve component cleanup |

The adapter must return the same result shapes the existing helpers expect, including error strings and OTP metadata. This avoids changing the hooks’ UI state management.

### 4. Local state rules

The demo state is a temporary front-end state machine, not a fake backend.

- Start each flow with `sendCount = 0`, `verified = false`, and no reset/auth session.
- A valid simulated send increments `sendCount`, clears the entered OTP, and starts the existing 60-second cooldown.
- Permit at most the existing three sends in one flow session. Restarting/refreshing a preview begins a fresh simulated session unless the implementation deliberately preserves it for a specific test.
- A successful OTP verification marks only the current local flow as verified. It must not authenticate the app or unlock protected real data.
- Successful registration is allowed only after the local OTP verification; successful reset is allowed only after the local reset verification.
- Leaving a flow clears its local demo verification state.

### 5. Fixture-data boundary

Keep fixtures separate from production data access, for example in `lib/fixtures/demoResident.ts`. The fixture module must contain only fictional values and plain TypeScript data; it must not import Supabase or make network calls.

Provide these named fixtures:

| Fixture name | Purpose | Values |
| --- | --- | --- |
| `residentHappyPath` | Complete registration and post-registration UI | Juan Santos Dela Cruz; phone `09175550101`; June 1998; Poblacion Ward I; fictional PIN `246810` |
| `residentEmpty` | Required-field and empty state | All strings empty, month `null`, terms false |
| `residentUnderage` | Age validation | Same profile with December 2012 |
| `residentInvalidName` | Name validation | First name `Juan3` |
| `otpValid` | Successful verification | OTP `123456` |
| `otpInvalid` | OTP error state | OTP `000000` |
| `pinMismatch` | PIN validation | PIN `123456`, confirmation `654321` |
| `resetHappyPath` | Forgot-PIN completion UI | Same fictional phone; new PIN `135790` |

Do not call the values “seeded database data.” They are local UI fixtures and must never be inserted into Supabase by demo mode.

### 6. Development-only screen preview

Add a preview route only if rapid visual review is needed. A suitable route is `app/dev/ui-preview.tsx`, but it must be guarded by the same `__DEV__` check and must render nothing/use an unavailable route in release builds.

The preview menu should open each item independently; it must not require completing a previous screen. Each entry must still use the production component and existing styles, but may provide a fixture and an initial state through a narrowly scoped preview wrapper.

| Preview item | Initial state | What it proves |
| --- | --- | --- |
| Registration phone | Empty and valid-phone variants | Formatting, supported-carrier validation, disabled/enabled CTA |
| Registration OTP | Empty, incorrect, and resend-cooldown variants | OTP boxes, error copy, loading and resend layout |
| Registration details | Empty, invalid, underage, and happy-path variants | Field errors, dropdowns, legal modal, keyboard/scroll layout |
| Registration PIN | Short, mismatch, submitting, and valid variants | PIN rules and submit treatment |
| Registration completion | Existing home route with `welcome=1` | The existing welcome modal after simulated completion |
| Forgot-PIN phone | Valid-phone variant | Generic message and phone behavior |
| Forgot-PIN OTP | Incorrect and valid variants | Shared OTP UI and error state |
| Forgot-PIN PIN | Mismatch, submitting, and success variants | Existing PIN-updated alert and login navigation |

The preview menu must never navigate into a real authenticated portal with an invented Supabase session. Screens that require an authenticated user need their own explicit fixture/preview wrapper or must remain out of the auth preview scope.

### 7. Required UI/UX acceptance criteria

The implementation is acceptable only when all statements below are true.

- The exact existing registration and forgot-PIN layouts, validation messages, loading controls, back navigation, keyboard handling, and shared components are retained.
- Invalid phone, OTP, account-detail, and PIN inputs fail before any simulated or live operation is selected.
- With demo mode enabled, `123456` reaches all later screens and completion UI; `000000` shows the normal OTP error.
- Registration completes through the current `/(main)/home?welcome=1` route so the existing welcome modal is visible.
- Forgot PIN displays the current generic sent-message alert and current `PIN updated` alert on simulated success.
- The user can inspect every listed preview state without a SIM card, phone registration, or API quota use.
- Demo mode is visually obvious at all times and cannot be mistaken for a live account session.
- A local restart resets the simulated state predictably.
- With demo mode disabled, none of the demo values, routes, banners, or shortcuts influence the live flow.

### 8. Zero-network and zero-write verification

Use this test before relying on demo mode for UI migration.

1. Enable demo mode and restart the app.
2. Clear the Metro console/network log, then perform a full registration happy path and a full forgot-PIN happy path.
3. Confirm that there are no calls to the Supabase Auth OTP endpoint and no invocations of `request-registration-otp`, `complete-registration`, or `reset-pin`.
4. Confirm no outgoing SMS is received and no IPROG/SMS usage changes.
5. Confirm Supabase Auth has no new user and the relevant profile/PIN data did not change.
6. Repeat with an invalid OTP and validation failures; confirm the UI errors appear without a network call.
7. Disable demo mode, restart the app, and perform one approved live test to prove that real calls resume only then.

If any network call or write occurs while the banner says Demo Auth, stop using the feature and treat it as a defect.

### 9. Test coverage to add when code is implemented

Add focused automated tests beside the existing test suite for the following logic; UI visual testing remains manual unless an approved UI test framework is introduced.

- Demo mode is false when `__DEV__` is false, regardless of environment text.
- Demo mode is true only when both required conditions are met.
- Valid/invalid OTP outcomes are deterministic.
- Simulated send counts/cooldowns observe the existing limit.
- Registration/reset final operations do not invoke Supabase in demo mode.
- Real helpers are selected with demo mode off.
- The release build has no reachable preview menu or Demo Auth banner.

### 10. Release gate and rollback

Before a real SMS test, beta build, or production release:

1. Set/remove the local flag so demo mode is false.
2. Restart/rebuild the app and confirm the Demo Auth banner and preview menu are absent.
3. Run typecheck, lint, existing unit tests, and the focused demo-mode tests.
4. Run one controlled real registration and one controlled real forgot-PIN test using an approved test number.
5. Confirm server rate limits, OTP delivery, completion, logout/reset behavior, and the post-registration welcome modal.
6. Review the production bundle configuration: no fixture data, demo OTP, or preview route is reachable.

If a regression is found, disable only the local demo flag or remove the development preview from the branch. Do not weaken OTP verification, RLS, rate limits, or server-side validation as a workaround.

## Seeded data

All values below are fictional. Do not use a real resident’s data.

### Primary happy-path registration profile

| Field | Value |
| --- | --- |
| Phone input | `917 555 0101` |
| Formatted phone shown by app | `0917 555 0101` |
| Demo OTP | `123456` |
| Last name | `Dela Cruz` |
| First name | `Juan` |
| Middle name | `Santos` |
| Birth month | `June` |
| Birth year | `1998` |
| Barangay | `Poblacion Ward I` |
| Agree to terms | Yes, accept through the legal modal |
| PIN | `246810` |
| Confirm PIN | `246810` |

`917` is an existing supported Globe/TM prefix in the app validator, so it reaches the simulated send action while keeping validation real.

### Forgot-PIN happy path

| Field | Value |
| --- | --- |
| Phone input | `917 555 0101` |
| Demo OTP | `123456` |
| New PIN | `135790` |
| Confirm new PIN | `135790` |

### Validation test data

| Screen/state | Input | Expected result |
| --- | --- | --- |
| Phone required | Empty | Get OTP remains unavailable or shows the normal required message after submission |
| Phone too short | `917 555 01` | `Enter a 10-digit mobile number` |
| Too many digits | `917 555 01012` | Input is constrained/normal validation is retained |
| Unsupported/invalid prefix | `800 555 0101` | `Enter a valid Philippine mobile number` |
| Real but delivery-unsupported carrier | `908 555 0101` | `Not supported yet. Try Globe, TM, or DITO` |
| Incomplete OTP | `12345` | `Enter the complete 6-digit OTP.` |
| Incorrect OTP | `000000` | `Invalid or expired OTP. Please try again.` |
| OTP resend limit | Request/resend three times | Existing too-many-requests state/message |
| Missing account details | Leave required fields empty | Field errors and `Please fill in all required fields.` |
| Name characters | First name `Juan3` | `First name can only contain letters.` |
| Under age | Birth month `December`, birth year `2012` | `You must be 18 years or older to register.` |
| Terms not accepted | Complete all details but do not accept | `You must agree to the Terms & Conditions.` |
| Short PIN | PIN `12345` | `PIN must be 6 digits.` |
| PIN mismatch | PIN `123456`, confirmation `654321` | `PINs do not match. Please try again.` |

## Procedure: disarm the real logic

Perform this only on a local development branch/build.

1. Confirm the app is running as a development build or local Expo session. Do not use a release/production build.
2. Set the local environment flag `EXPO_PUBLIC_DEMO_AUTH_MODE=true`. Keep this only in a local, ignored environment file; do not place it in a committed production environment file.
3. Restart Metro/Expo completely so the environment value is reloaded.
4. At the existing auth helper boundary, make demo mode return local outcomes instead of performing network/auth calls:
   - Registration: replace the status check, send, verification, and profile-completion results with simulated results.
   - Forgot PIN: replace send, verification, PIN reset, and reset-session cleanup with simulated results.
5. Preserve the existing timing state: return one simulated send, apply the existing 60-second cooldown, and preserve the three-send UI limit. This keeps the resend UI realistic without a server request.
6. Accept only `123456` as the demo verification code. Any other six-digit value must return the normal invalid/expired code error. An incomplete code must still be handled by the existing UI validation before this point.
7. For registration completion, return success without creating an Auth user/profile. Continue through the existing success route: `/(main)/home?welcome=1`.
8. For forgot-PIN completion, return success without updating any PIN. Preserve the current success alert, then continue to the existing login route.
9. Show a small, unmissable local banner such as `DEMO AUTH — SMS and Supabase writes are disabled. OTP: 123456`. It should be impossible to overlook in screenshots or manual testing.
10. If viewing authenticated screens is required after registration, use a separate local preview session plus fixture data. Do not pretend the demo OTP created a real Supabase session.

## Viewing all screens without repeating the flow

Demo OTP removes the SMS dependency, but a screen-preview entry point is best for rapid migration work.

1. Add a development-only preview menu/route that can open each sign-up step and forgot-PIN step directly.
2. Give each previewed step the seeded values above, while keeping fields editable.
3. Include presets for happy, empty, invalid, loading, and server-error visual states.
4. Keep destructive buttons simulated in preview mode. For example, a registration success action shows the existing welcome route/modal but creates nothing.
5. Do not expose this menu in a production build or link to it from production navigation.

Suggested preview list:

- Registration — phone, empty and valid
- Registration — OTP, empty / incorrect / valid
- Registration — details, empty / underage / valid
- Registration — PIN, mismatch / valid
- Registration — completion welcome modal
- Forgot PIN — phone, valid
- Forgot PIN — OTP, incorrect / valid
- Forgot PIN — new PIN, mismatch / valid
- Forgot PIN — `PIN updated` success alert

## Test checklist

### Registration

- [ ] Enter the seeded supported phone number and request an OTP. No SMS arrives and no network call is made.
- [ ] Confirm OTP screen, cooldown, resend button, and loading feedback look correct.
- [ ] Enter `000000` and check the normal error state.
- [ ] Enter `123456` and verify that the details screen opens.
- [ ] Test all details validation rows in the table above.
- [ ] Complete the profile using the seed data.
- [ ] Test short and mismatched PINs.
- [ ] Submit matching PINs and confirm the current home welcome modal appears.
- [ ] Confirm Supabase Auth and profile data have not changed.

### Forgot PIN

- [ ] Enter the seeded phone number and request an OTP. Confirm the current generic sent-message alert appears.
- [ ] Enter `000000`, then `123456`.
- [ ] Test short/mismatched new PINs.
- [ ] Submit matching new PINs and confirm the current `PIN updated` alert and login navigation.
- [ ] Confirm no account password/PIN was actually changed in Supabase.

### Safety check

- [ ] Search debug logs/network inspector: no call reaches `request-registration-otp`, `complete-registration`, or `reset-pin` while demo mode is active.
- [ ] Confirm a clearly visible Demo Auth banner exists.
- [ ] Confirm a production build cannot enable demo mode even if a public environment value is changed.

## Procedure: arm the real logic again

Before testing delivery with a real phone/SIM, reverse the configuration; do not remove validation or modify server safeguards.

1. Finish and save all migration UI work.
2. Set `EXPO_PUBLIC_DEMO_AUTH_MODE=false` or remove the local demo-mode setting.
3. Restart Metro/Expo completely. An environment change does not reliably apply to an already-running bundle.
4. Verify that the demo banner and preview menu are absent.
5. Verify the real implementations are again selected:
   - Registration uses `fetchRegistrationOtpStatus`, `requestRegistrationOtp`, `verifyRegistrationOtp`, and `completeRegistrationProfile`.
   - Forgot PIN uses `requestPasswordResetOtp`, `verifyPasswordResetOtp`, and `submitNewPin`.
6. Use one approved test SIM/phone number with a supported carrier. The current client validator accepts Globe/TM and DITO delivery prefixes.
7. Run one complete registration test and one forgot-PIN test with deliberate spacing between resend attempts. Observe the real server rate limits; never work around them.
8. Verify real results in Supabase only through authorized project tooling: expected Auth/profile data for registration, and the expected PIN-reset outcome. Clean up test accounts only through an approved, safe test-data procedure.
9. Before committing/releasing, check that no demo flag is enabled, no fixed OTP is reachable, no preview route is accessible, and no demo credentials/data were committed.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| SMS is still sent in demo mode | The external helper call was not intercepted, or Metro was not restarted after the flag change. Stop testing and fix this before continuing. |
| The OTP screen will not open | Use a supported valid phone seed (`917 555 0101`) and ensure the simulated send sets a pending-send state. |
| `123456` does not advance | Confirm the simulator is intercepting the OTP verification call, not only the send call. |
| Completion says session expired | Demo mode must simulate the final completion result too; do not call real completion/reset functions without a real Supabase session. |
| Home/profile screen cannot load after demo registration | Use fixture data/a separate preview session. A simulated registration deliberately does not create a real authenticated session. |
| Demo mode appears in a release build | Treat this as a release blocker. Disable the build, remove the demo configuration, and verify the production guard before proceeding. |

## Completion criteria

The setup is ready when every sign-up and forgot-PIN screen can be opened, edited, and visually verified; seeded happy-path data reaches the current completion UI; validation errors remain authentic; and no SMS, Supabase Auth action, database write, or PIN change occurs. The real flow is restored simply by disabling the local demo-mode flag and rebuilding/restarting the development client.
