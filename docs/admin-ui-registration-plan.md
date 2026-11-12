# Admin UI and official registration plan

Updated: 9 November 2026 (Asia/Singapore). Revision: 2.

## Status and ownership

- **Superseded Admin design: the user rejected the first pass as too similar to the old UI, then rejected revision 3 as generic. Current presentation specification is [admin-ui-visual-refinement-plan.md](admin-ui-visual-refinement-plan.md), revision 4.** Revision 3 retains the functional/navigation history. Registration/security/cache implementation and the historical automated results below remain valid; they do not establish acceptance of the current Admin visual design.
- The primary planning agent owns layout, interaction, visual hierarchy, scope decisions, and the final review. Luna implements the accepted specification; do not create additional agents after Luna.
- Authorized execution model: **`gpt-6-luna` / `xhigh`**, named **Luna**. The user explicitly accepted this available model on 9 November 2026. Create Luna once; reuse her for every implementation correction and create no further agents.
- This document retains the registration/security/cache plan and first-pass history. The current Admin presentation and execution audit live in `admin-ui-visual-refinement-plan.md`; `admin-ui-rework-plan.md` retains revision 3 history. Existing `docs/execution.md` concerns the Mayor MVP and must not be overwritten.
- Preserve all pre-existing working-tree changes. Several Resident and official screens, shared utilities, and backend files already have unrelated work in progress.
- Audit evidence here is from source and migrations. No authenticated admin screenshots, physical iPhone/Android run, live SMS delivery, or hosted database behavior have been verified in this task.

## 1. Goal and boundaries

Modernize the admin portal to feel like the Resident and operational official areas: short labels, light surfaces, clear actions, Inter typography, consistent outline icons, stable loading, and fewer repeated database reads. Make invitation-based registration reachable inside Expo Go on both iPhone and Android without requiring an external app link to launch the registration route.

Preserve:

- Expo Router paths `/admin`, `/admin/invitations`, `/admin/accounts`, `/invite`, and `/(auth)/official-login`.
- Active-admin authorization, server-derived roles and coverage, invite-only official registration, and private contact data.
- Mayor = `mayor` with no barangay; MDRRMO = `officer` with no barangay; BDRRMO = `officer` with a valid assigned barangay.
- Existing server authority for supported SMS numbers, identity conflicts, revocation, expiration, and one-time consumption.
- Four registration stages: Invite, Verify, Details, Password. Keep explicit official sign-in after successful account creation.
- Resident and MDRRMO/BDRRMO/Mayor screens and operational business rules.

This task does not introduce account administration, municipality editing, role conversion, a new auth provider, an email-verification requirement, native build provisioning, or a replacement backend architecture. Accounts is currently a placeholder; do not invent its data or controls.

## 2. Acceptance criteria

1. Admin uses white/pale-blue surfaces, navy readable text and actions, shared Inter families, and one consistent outline-icon treatment. No pale-blue text on pale-blue controls, large instructional blocks, or imitation operational dashboards.
2. Overview shows two accurate invitation counts, one primary create action, and at most three recent invitation rows. Invites opens as a compact list with Active/Used segments; creation opens a focused sheet.
3. Admin access checking and first data loads have stable skeletons. Refresh retains content. Empty, access-denied, offline, retry, and mutation-error states are distinct and finite.
4. Overview and Invites share one in-memory invitation snapshot and one in-flight list request. Fresh tab switches, opening a sheet, typing, filtering, and choosing a role do not call the database.
5. Official sign-in exposes **Use invitation**. `/invite` without a token displays an entry form; a copied raw token or invite link enters the same server-validated flow as a deep link.
6. Opening or validating an invite does not send SMS. A deliberate **Send code** action does. Repeated taps do not create concurrent sends or registrations from the UI.
7. Invitation and SMS challenge expiration are enforced during verification/account creation, with a usable path back to SMS verification when necessary.
8. A new token cannot inherit a previous token's verified state, details, password, errors, timers, or late asynchronous results.
9. The plan's implementation log records actual changed files, checks, deviations, and outstanding device/deployment work. Code review alone must never be recorded as end-to-end validation.
10. Both iOS and Android support paste entry, all four stages, keyboard avoidance, safe areas, system text enlargement, and deterministic back behavior. Android hardware/predictive back and modal dismissal must preserve the wizard and unfinished-form confirmation rules. Do not implement an iOS-only route or clipboard dependency.

## 3. Current-state audit

| Finding | Evidence | Decision |
| --- | --- | --- |
| Admin already uses Inter and Ionicons. | `app/_layout.tsx` loads Inter 400/500/600/700/800; `styles/theme.ts`, admin styles, and `AdminBottomNav.tsx` use the shared families. | Reuse existing packages. Improve weight, scale, icon style, and contrast; do not install fonts or another icon library. |
| Pale `colors.themeSoft` is used for primary buttons, white button labels, status labels, links, and selected role chips. | `styles/screens/admin.styles.ts`, `styles/components/adminBottomNav.styles.ts`. | Use the pale color for surfaces; use `colors.navigationActive`/`colors.text` for readable controls and text. |
| Invitations is a long create form, all barangays inline, instructions, and both full lists. | `app/admin/invitations.tsx`. | Separate browsing from creation using one create/result sheet and an Active/Used segmented list. |
| Overview's create button only navigates to Invitations. | `app/admin/index.tsx`, `openInvitations`. | Create intent opens the form directly; ordinary count/recent links open the appropriate list segment. |
| The two tabs separately call the same unbounded list RPC and each owns its own arrays. | `loadInvites` in both admin routes; `lib/invites.ts:listOfficialInvites`. | One provider scoped to the authorized admin shell, with deduplication and freshness rules. |
| A failed list refresh clears usable rows; full-screen spinners hide the whole view. | Both admin routes' `loadInvites`; admin `_layout.tsx`. | Retain last successful data and show a refresh error; use first-load skeletons. |
| Barangays already have a 12-hour cache and shared in-flight request. | `lib/barangays.ts:fetchBarangays({ force? })`. | Reuse this cache. Load it when BDRRMO creation needs it, independently of the list. |
| Accounts exposes decorative future capabilities but no working account tools. | `app/admin/accounts.tsx`. | Replace the capability list with an honest, compact unavailable state; no fake skeleton or data query. |
| Admin creates only `disasterlink://invite?token=...` links. | `lib/invites.ts:buildInviteDeepLink`; `app.json` scheme. | Preserve this build link and add an in-app token entry path for immediate Expo Go testing. |
| Token/link parsing exists, but there is no paste-entry UI. | `lib/inviteToken.ts`; `hooks/useOfficialRegistrationFlow.ts` reads the route parameter once; official-login has no registration entry. | Reuse the parser; expose entry on `/invite`, linked from official sign-in. |
| Missing tokens are treated as unavailable, and a transient validation failure has no in-screen retry. | `parseInitialInviteToken` and validation effect in `useOfficialRegistrationFlow.ts`. | Distinguish empty, validating, unavailable, and retryable network failure. |
| Invite automatically advances after ten seconds and sends SMS on entry to Verify. | `autoContinueSeconds`, `autoContinueUsedRef`, `initialSmsSentRef`, and effects in the hook. | Remove automatic countdown/send. Keep control with the recipient. |
| Registration back control renders a text glyph whose shared style has `display: 'none'`; leave goes to Resident login. | `app/invite.tsx`; `register.styles.ts:backButtonText`; `confirmLeaveRegistration`. | Use an accessible outline back icon locally and return official registrants to official sign-in. Do not alter Resident styles globally. |
| OTP send has `finally` but no catch, and mutation/copy failures are not consistently surfaced. | `sendSmsCode` in the registration hook; create/copy handlers in Invitations. | Add explicit feedback and release all loading locks in `finally`. |
| Server reads challenge expiry during registration but does not enforce it. | `official-invite-registration/index.ts:handleRegister`, `challenge.expires_at`. | Localized server fix is required; UI verification state is never sufficient authorization. |
| Verification returns success for an already-verified challenge before checking expiry or the supplied code hash. | `handleVerify`. | Validate expiry, code, and attempts in a consistent order before an idempotent success. |
| Send/attempt counters use read-then-write operations. | `claimSmsSendSlot`, `rollbackSmsSendSlot`, and wrong-code updates in the Edge Function. | Record as a separate concurrency-hardening follow-up; UI locks do not solve server concurrency. See section 9. |
| Auth email is marked confirmed by the trusted function, but mailbox ownership is not verified. | `auth.admin.createUser({ email_confirm: true })`; profile `email_verified_at: null`. | Preserve the existing admin-invited, phone-verified policy. Do not label email as verified or introduce another auth step silently. |
| No invite-specific automated tests were found in the inspected `tests`/`supabase/tests` files. | Existing Node `node:test` suite and pgTAP conventions. | Add focused parsing, expiry-policy, cache, and authorization regression coverage where applicable. |

### Existing components and utilities to reuse

- Theme: `styles/theme.ts` (`colors`, `fonts`, `fontSizes`, `spacing`, `radius`). Do not globally change theme values to restyle Admin.
- Loading: `components/ui/Skeleton.tsx`, with `OfficialScreenSkeletons.tsx`/`ResidentScreenSkeletons.tsx` as composition references.
- Forms: `components/register/LabeledInput.tsx`, `FieldError.tsx`, `OTPInput.tsx`, and `Stepper.tsx`.
- APIs: `lib/invites.ts`, `lib/officialRegistration.ts`, `lib/inviteToken.ts`, `lib/barangays.ts`, and phone/name validation.
- Errors: `lib/edgeFunctionErrors.ts`, including the existing `readEdgeFunctionErrorCode` and message reader; clone responses when reading metadata on non-2xx responses.
- Auth: `lib/portalAccess.ts`, `lib/auth.ts`, and the existing Supabase auth subscription pattern.
- Provider placement: `context/OfficialPortalContext.tsx` is a structural reference. Do not import the operational `MdrrmoHeader` into Admin: it depends on official scope, profiles, and notification data that Admin does not need.
- Barangay picker: use `ReportBarangayPicker.tsx` as a modal/list/accessibility reference only; its incident-specific wording does not fit an invite. Keep the small invite-specific picker inside the form sheet unless actual duplicate code justifies sharing.

### Backend boundary already present

- `invites` uses RLS and hardened RPCs. Clients must continue using `create_official_invite`, `list_official_invites`, `revoke_official_invite`, and `validate_invite_token` rather than gaining direct writes or token-hash reads.
- `20260727000004_invite_identity_validation.sql` is the later authority for structured create results and duplicate-identity checks. Earlier migration bodies are historical, not the contract to restore.
- `official_sms_challenges` and `official_sms_otp_sends` have RLS and no anon/authenticated table access. They remain service-only.
- Server-side Auth creation and compensating cleanup of the newly created account are already implemented. Never delete or convert pre-existing users to make an invitation succeed; follow `docs/admin-invite-recovery.md`.
- `list_official_invites` returns active/unexpired and used records, excludes revoked and expired-unused records, and does not return a raw token. Keep count labels **Active** and **Used**; Used is not a count of all official accounts.

## 4. Decided visual and interaction specification

### Shared appearance

- White canvas, white cards, subtle borders, and pale `colors.primaryLight`/existing soft-blue translucent fills for grouping. Navy primary actions and readable active labels. Green/red treatments are reserved for success/destructive meaning.
- Inter semibold page titles around 22px; Inter regular body around 14px; medium/semibold labels. Use shared size tokens where they match. Register every local invite style's font explicitly instead of relying on platform defaults.
- Use 24px horizontal screen padding, 16px card padding, and the shared 8/16/24 spacing rhythm. Reuse existing radius tokens and soft shadows; do not change the global 12px radius system.
- Ionicons outline glyphs: `grid-outline`, `mail-outline`, `people-outline`, `add-outline`, `copy-outline`, `log-out-outline`, `chevron-back`, `chevron-forward`, and `close-outline`. Selection changes surface/color/weight consistently, without mixing unrelated icon families or decorative emoji.
- Icons may replace redundant decoration; navigation/action meaning retains accessible labels. Destructive actions keep a visible label and confirmation.
- Buttons/tap areas at least 44px; input text at least 16px; labels wrap when needed. Test system text enlargement and narrow devices. Do not truncate errors, required form labels, or scope information.
- Admin columns remain flex-based and centered with a reasonable tablet/web maximum width (use the established single-column mobile composition, maximum 640px). Bottom content clears the existing safe-area-aware nav.

### Overview

Order: compact Admin identity/header and log-out action; two compact Active/Used tiles; prominent **New invite** button; **Recent** section with up to three rows and **View all**.

Each row: role icon, email, one scope/date line, and a status pill. Keep optional secondary details out of the default overview. Remove instructional paragraphs such as “Live counts ... Tap a tile ...”. Do not call cached snapshots “live”.

### Invites

- Header: **Invites** and a labeled **New invite** action.
- Active/Used segmented control includes counts derived from the shared snapshot. One virtualized `FlatList` renders the selected segment, not nested mapped full-history lists inside a ScrollView.
- Default row: role and scope, invited email, masked phone, one relevant date (Expires for Active, Used for Used). A row can expand locally for Created/full dates and its existing revocation action. Never offer copying an old token that is not stored.
- Empty: short icon, **No active invites** / **No used invites**, and New invite only where useful. Error with no data: concise explanation and Retry. Failed refresh with data: keep rows and show a small retry banner.
- New invite sheet: role chips first; email and mobile; one barangay selector only for BDRRMO; field errors; **Create invite**. Keep one line of carrier guidance. Use “Email” with an office-email example; do not claim a government-domain restriction exists.
- Submit locks every mutable form control, including role and barangay. Use a synchronous ref guard plus rendered pending state for create/revoke actions.
- Success replaces the form within the sheet: **Invite ready**, role/scope and recipient summary, **Copy link**, and **Done**. Show a masked link/token by default. Keep the full link only in local component memory and the explicit clipboard action.
- One short instruction: **Copy now. This link cannot be retrieved later.** Do not clear a successfully generated token when later input validation or list refresh fails. If dismissing before a successful copy, confirm discarding the only copy. Clipboard failure retains the result and offers retry.
- Revocation keeps the existing destructive confirmation and has row-level pending/error feedback. A failed post-mutation list refresh must not turn a successful mutation into a “creation failed” message or encourage generating a duplicate invite.
- Create intent from Overview uses a non-sensitive route parameter, e.g. `compose=1`, consumed/cleared after opening the sheet. Count tiles similarly select `group=active|used`. Do not put generated tokens in Admin navigation parameters.

### Accounts

Keep the existing tab/path, with the same compact header and a small **Account tools are not available yet** state. Remove the list of pretend capabilities. It does not fetch account records and does not display a loading skeleton.

### Official invitation entry and registration

1. Add a quiet **Use invitation** action beneath the official sign-in button. It opens `/invite` without a token; this does not make official registration public or remove the invite requirement.
2. Empty entry: **Use invitation**, one **Invite link or token** field, **Continue**, and a short **An admin must invite you** helper. Manual system paste must work on both iOS and Android; do not read the clipboard automatically.
3. Reuse `extractInviteToken`. Accept the existing 64-character hex token and full custom-scheme/Expo/HTTPS invite URLs containing a valid token. Bound pasted input length (2048 characters), reject malformed/missing/oversized values locally, and preserve opaque token bytes/case. Never fetch a pasted URL or derive permission from its host/path/role claims.
4. Server validation occurs once after an accepted token. Validation alone never sends SMS. The entry form does not perform an extra validation before handing the token to the hook.
5. Valid Invite stage: compact role/scope card with masked email and mobile, no large Invite ID cards. Primary action **Send code**. Back/Change invite clears the previous flow explicitly. An unavailable invite has **Use another invite**; a validation network failure has **Retry** without forcing users to retype.
6. Verify: masked mobile, six-digit input, **Verify code**, resend cooldown, and server-limit guidance. Keep server send counts/cooldown metadata on both success and error. Resend occurs only on a deliberate action; changing steps/back must not resend automatically. If already verified and navigating back, allow **Continue** to Details while server expiry is still enforced at final registration.
7. Details: required first/last names, optional middle name, and one compact invite-bound identity summary. Keep name normalization/validation and read-only scope/contacts. Do not add editable role, email, or phone fields.
8. Password: password/confirmation with visibility controls, short 12-character guidance, and **Create account**. Keep password text in memory only. A server `verification_required` rejection returns to Verify, clears local verified state, and gives an explicit resend path without losing valid names.
9. Success: one clear confirmation and **Sign in**, then `/(auth)/official-login`. No automatic session creation or unexpected portal navigation. Leaving the wizard returns to official sign-in after the existing unfinished-registration confirmation.
10. Give the wizard an accessible outline back icon, compact title/stepper, Inter fonts, and the same pale surfaces/navy hierarchy. Apply overrides in `styles/screens/invite.styles.ts`; do not restyle Resident registration through shared `register.styles.ts`.

## 5. Data and loading contract

Add `context/AdminInvitesContext.tsx` and expose `AdminInvitesProvider` / `useAdminInvites`. This sharing is justified by the two existing consumers; a new global query library is unnecessary.

Provider contract:

```ts
type AdminInvitesState = {
  active: InviteListItem[];
  used: InviteListItem[];
  loading: boolean;       // first load without a successful snapshot
  refreshing: boolean;   // fetch while a successful snapshot exists
  error: string | null;
  lastLoadedAt: number | null;
  reload: (options?: { force?: boolean }) => Promise<void>;
};
```

- Mount only after the existing admin access check succeeds. A successful empty list counts as a usable snapshot.
- Freshness window: 60 seconds. Provider loads once; tab focus/resume requests `reload()` and reuses a fresh result. No interval polling. Concurrent requests share one in-flight promise, including forced requests already in progress.
- Pull-to-refresh and Retry force one request. Successful create/revoke invalidates the snapshot and triggers one shared reconciliation refresh for both tabs. If a read started before a mutation is already in flight, do not treat that older read as post-mutation reconciliation: discard its obsolete result and queue one fresh read after it settles. Deduplicate concurrent readers and coalesce mutation invalidations into the necessary follow-up request. Clear the refresh error only on success or an intentional new attempt.
- After successful revoke, remove that invite from local active rows immediately; if reconciliation fails, retain the known removal. After create, retain the independent success result even if list refresh fails, and label the count/list as needing refresh rather than fabricating a new `InviteListItem`.
- Preserve previous rows on transient read failure. Do not clear rows to make a skeleton appear. Distinguish authorization/session loss from a retryable network failure: denied access clears protected data and leaves the portal.
- Prevent late responses from restoring data after unmount, logout, or account switch with a request generation/user key. Clear on `SIGNED_OUT`/user change; a same-user token refresh should not discard the cache. Do not perform async Supabase work directly inside the synchronous auth callback.
- Do not persist invite snapshots/contact data in AsyncStorage. Do not keep raw invite tokens in this provider or a module-level cache.
- Locally exclude cached active rows whose `expires_at` has passed whenever deriving counts/list data; update the clock on focus/resume and the nearest active-expiry timer. This timer changes local presentation only and does not poll the database.
- Load BDRRMO barangays lazily through the existing cached API. Retry uses `{ force: true }`; loading/error/empty for that selector does not block the invitation list or non-BDRRMO creation.
- Add `components/ui/AdminScreenSkeletons.tsx` with shell, Overview, and invite-list compositions using the existing primitives. Keep static headers and the create action visible where authorization allows. Only the data region skeletonizes. Use one compact invite-validation skeleton in the wizard; button work retains button spinners.
- Catch rejected promises as well as returned errors and always end pending states. No simulated loading delay or artificial minimum spinner duration.

## 6. Ordered execution steps for Luna

### Phase A — registration access and correctness

1. Record the baseline file list and checks. Edit only files identified in this plan or add a documented, justified dependency.
2. Extend `lib/inviteToken.ts` validation and add meaningful parser cases in `tests/inviteToken.test.ts` (raw token, encoded link, Expo path, malformed/oversized input, unrelated URL, no permission derived from URL content).
3. Update `hooks/useOfficialRegistrationFlow.ts` with manual token acceptance/retry/reset, no countdown, explicit sends, synchronous duplicate-action locks, catch/finally feedback, and guards against stale async updates. A route token is an initial accepted input, not a different registration path. Handle subsequent token changes without retaining verified state.
4. Update `app/invite.tsx` and `styles/screens/invite.styles.ts` for the entry state, compact four-step composition, retry/replacement controls, usable back icon, official exit destination, keyboard-safe controls, and loading skeleton.
5. Add **Use invitation** to `app/(auth)/official-login.tsx`; keep sign-in logic, Resident Access, and its styling otherwise intact.
6. Make the following localized changes in `supabase/functions/official-invite-registration/index.ts`:
   - Reject missing, invalid, or expired challenge timestamps during verification and final registration; enforce the latest challenge for the invite/phone, not an older verified row when a newer unverified challenge exists.
   - For verification, check the supplied code hash and allowed attempts before returning an idempotent success for a previously verified challenge. Recheck expiry before marking verification successful.
   - Before account creation, require a verified, unexpired latest challenge. Return `{ error: <short verification guidance>, code: 'verification_required' }` when that proof is missing/expired. Invalid invites retain the generic invite response.
   - Final conditional invite consumption must also require unexpired `expires_at` and null `reserved_at`, alongside the existing unused/unrevoked conditions. Preserve compensating cleanup if this final condition fails. Never delete an account that was not created by that request.
   - Keep existing identity validation, service-role isolation, phone-bound checks, carrier restrictions, password length, and generic recipient-facing identity errors.
7. In `lib/officialRegistration.ts`, reuse `readEdgeFunctionErrorCode` to return an optional `verificationRequired` flag from `registerOfficialAccount`. Do not branch on translated error-message text. Parse send metadata from a cloned non-2xx response when invocation data is absent, using `parseEdgeFunctionMeta`.
8. If a pure timestamp/challenge policy helper is needed by both verify and register, place it in `supabase/functions/_shared/official-invite-policy.ts` and test it with Node's existing test convention. Do not split the entire function into a new architecture just for testing.

No schema or RLS change is required for these localized checks. New service-only tables or client permissions are not authorized by this phase.

### Phase B — shared admin data and layout

1. Implement `AdminInvitesContext.tsx` with the contract in section 5; reuse `listOfficialInvites` as the transport. Keep expired-row derivation and recent sorting correct for invalid dates and used timestamps.
2. Update `app/admin/_layout.tsx` to mount the provider under the authorization gate and show an admin shell skeleton while checking. Include a finite retryable access-check error. If the boolean-only `requireActiveAdmin` hides network errors, add a narrowly typed access-check result in `lib/portalAccess.ts` and preserve existing callers' behavior; do not rewrite the global routing resolver.
3. Remove the duplicated screen-level invitation effects/arrays in Overview and Invitations. Use the context, compact sections, and scoped skeletons. Retain local UI state such as current segment and form fields.
4. Add focused presentational components under the existing `components` structure: `components/admin/AdminInviteFormSheet.tsx` and `AdminInviteRow.tsx` only where responsibilities or actual repeated rendering justify them. Reuse a common row between recent/list views if this avoids real duplicate logic.
5. Implement the create/result sheet, compact barangay selection, disabled mutation controls, clipboard errors, and row-level revocation state. Separate mutation success from reconciliation errors.
6. Restyle only `styles/screens/admin.styles.ts`, `styles/components/adminBottomNav.styles.ts`, and relevant local components. Update `components/navigation/AdminBottomNav.tsx` to the outline/navy treatment while preserving tabs, events, haptics, and safe-area behavior.
7. Simplify `app/admin/accounts.tsx` to the truthful unavailable state. Remove styles/imports made unused by this task only.

### Phase C — primary-agent review and documentation

1. Review resulting layouts and route behavior against sections 4–5. Return concrete corrections to the same Luna agent; create no additional agents.
2. Verify action contrast, enlarged text, keyboard coverage, safe areas, skeleton layout, retry states, and the absence of decorative paragraphs. Code inspection does not replace visual review.
3. Update the change log below after each major phase, including rejected decisions or scope changes. Keep plans and actual results visibly distinct.
4. Record automated outputs and pending manual/hosted validation. Do not deploy a hosted function or change hosted Auth records as an incidental test. Prepare the exact deploy command and summary for approval if a hosted update is needed for physical testing.

## 7. Immediate iPhone and Android / Expo Go test procedure

The chosen immediate solution is in-app paste entry. It avoids relying on custom-scheme OS launching and works with the existing token validator and registration API.

1. Start the existing project with `npm.cmd start -- --clear` and open it in Expo Go on iPhone or Android using the project's current development-server connection. Keep the normal reachable LAN/tunnel arrangement; do not copy `localhost` into a physical-device link.
2. Admin creates an invite for an email not already in Auth and an authorized supported mobile number. Copy the link when the result is shown.
3. On the same device, log out explicitly, open Official Access, tap **Use invitation**, and paste. Across devices, transfer the copied link through a user-chosen channel; this task does not send it automatically.
4. Confirm the intended role/scope and masked identity. Tap **Send code**, receive a real SMS on the invite-bound phone, enter it, complete names/password, and sign in through official access.
5. Confirm Mayor, MDRRMO, and BDRRMO route/scope outcomes with separate authorized fixtures on both platforms. One invitation cannot be reused for multiple successful signups. On Android also exercise hardware back at every stage and with each modal open; on iOS exercise the screen back control and keyboard transitions.

An optional Expo Go link uses the current dev-server address and `/--/invite?token=...`; a built app uses the existing `disasterlink://invite?token=...`. If adding a development-link copy option later, derive it with `expo-linking`'s `createURL` rather than hardcoding a host/port. It is not required for the selected paste-entry solution.

For stable OS-level invitation links, use a development/release build with the custom scheme, and consider HTTPS Universal Links when a controlled domain exists. Native provisioning is a separate task. Expo documents both the custom-build requirement and the Expo Go `/--/` format: [Linking into your app](https://docs.expo.dev/linking/into-your-app/), [Expo Linking API](https://docs.expo.dev/versions/latest/sdk/linking/).

Receiving provider SMS is separate from opening a link: paste entry fixes navigation, not SMS delivery. If SMS is unavailable, registration cannot be called end-to-end verified. Existing Resident demo OTP is not wired to officials and must not be reused as a production bypass. A future isolated, clearly labeled UI-only preview may reuse the dev-preview pattern, with no real Auth or database writes; it is not required for this first implementation.

## 8. Verification and review gates

### Automated checks

- Add focused cases for parser bounds, token replacement/reset decisions, expired/invalid timestamps, latest-challenge selection policy, and cache freshness/deduplication/invalidation where the implementation has a testable policy boundary. Avoid tests that only assert source strings or style values.
- Include new Node tests in the existing `test:unit` command; preserve all existing entries.
- Run `npm.cmd run test:unit`, `npm.cmd run typecheck`, and `npm.cmd run lint`. Record pre-existing failures separately; do not fix unrelated work to make the log green.
- Check the modified Edge Function and any new shared helper with Deno's existing import map, e.g. `deno check --config supabase/functions/official-invite-registration/deno.json supabase/functions/official-invite-registration/index.ts`.
- Run `git diff --check -- <task-files>` and inspect the task-specific diff against the baseline. No bulk staging, reset, checkout, commit, or deployment is required.
- For changes affecting RPC permissions or schema beyond this plan, stop and revise the plan first. If such changes are approved, add pgTAP cases for anon/resident/official/suspended/admin access and run the focused database test through the existing Supabase CLI; never claim an unavailable local database test passed.

### Manual scenarios

| Area | Required checks |
| --- | --- |
| Visual | Overview, Active/Used, creation/result sheet, Accounts state, entry and four registration steps; small iPhone, small Android, larger phone/tablet, system text enlargement, iOS home indicator, Android gesture/three-button navigation insets. |
| Loading | Cold access, first empty snapshot, slow list, independent barangay load, retry after failure, refresh failure with rows retained, tab return without skeleton flash. |
| Query efficiency | Cold admin entry = one list request; fresh Overview/Invites switches = zero additional list requests; one forced refresh per successful mutation; no fetch for form typing/segment changes; one lazily cached barangay request. Count app-level requests separately from Supabase session refresh. |
| Authorization | Non-admin direct `/admin` entry reveals no private rows; logout/account switch clears snapshots; late responses cannot restore them; server RPC denial clears protected state. |
| Entry | Missing token is a usable form; raw token, custom link, Expo link; invalid/revoked/expired/used token; offline validation then Retry; input remains usable after an error. |
| SMS | No automatic send on opening an invite; double taps; invalid code; expired code; resend cooldown; provider error; max sends; leaving/back without extra SMS. |
| Expiry | Verified challenge expires before Password submit -> server rejects with verification_required and client returns to Verify. Invite expiry/revocation during final submission must fail final consumption and clean up only newly created identity. |
| Token isolation | Open/accept token B after token A; no A scope, OTP verification, password, pending result, or timer leaks into B. |
| Mutation reliability | Duplicate email/phone field errors, unsupported number, BDRRMO missing barangay, delayed create/revoke, successful mutation plus failed refresh, clipboard failure, dismiss-before-copy confirmation. |
| Success/regression | One account and consumed invite, explicit official sign-in, correct role/coverage, existing Resident Access and registration unchanged, all admin nav destinations still work. |

Authenticated visual/device checks remain pending until performed; do not mark acceptance complete because automated checks pass.

## 9. Plan review, recommendations, and known limits

**Review outcome: the selected plan fits the current architecture and addresses the immediate UX/navigation problem. Implementation, automated verification, and iOS/Android/web bundle export are complete. Visual/device/SMS acceptance and hosted deployment remain pending.**

- Reuse is concrete: existing fonts/icons, skeleton primitives, inputs, invite RPCs, server registration, and cached barangays. A provider removes actual duplication without installing a new data library.
- A create sheet and segmented list remove the main source of text/scrolling density. Accounts stays honest and unchanged in capability.
- In-app paste is the fastest implementation for current iPhone and Android/Expo Go testing; a custom native build is the later route for reliable external links.
- Removing automatic advancement prevents unintended SMS and confusing movement. The four-stage flow remains understandable without a speculative wizard rewrite.
- Phone verification and mailbox verification are different. The current policy trusts the administrator's invited email and proves control of the invited mobile. Adding email verification would change policy and needs an explicit separate decision.
- The existing all-history list RPC is unbounded. Sharing its result reduces repeated calls but does not make historical payload growth disappear. Cursor-paged history plus server-derived counts is a later backend optimization, not a fake client-side “pagination” that still downloads everything. Record observed payload/row counts during validation before deciding that follow-up.
- **Security follow-up outside this localized pass:** send-slot claims/rollbacks and failed-attempt increments are not atomic across concurrent Edge Function requests. Full cross-Auth/database registration is also compensating, not a single database transaction. Do not describe these as fixed by button locks or as fully audited security. A separate transaction/RPC design and concurrency tests are recommended before claiming robust multi-client abuse protection; changing that design would require a plan revision under AGENTS.md.
- The localized server expiry fix is in source but must be deployed before hosted iPhone and Android tests can verify it. Local source edits do not update the hosted function.

## 10. Change-control and implementation audit

Use status values **Planned**, **In progress**, **Implemented**, **Automated verified**, **Manually verified**, or **Deferred** precisely. Never replace a failed/unknown result with “done”.

| ID | Decision/change | Status | Evidence / next action |
| --- | --- | --- | --- |
| D01 | Primary agent decides/reviews; Luna alone executes; no later agents. | Implemented | Primary reviewed the source and directed scoped corrections; implementation remained with Luna. No additional agents were created. |
| D02 | Reuse Inter and Ionicons; navy text/actions, pale surfaces; no global theme rewrite. | Implemented | Admin, invite, and navigation styles use existing theme tokens and Inter/outline Ionicons. Source review is complete; visual acceptance remains pending. |
| D03 | Compact Overview, segmented invitation list, create/result sheet, honest Accounts state. | Implemented | Overview, virtualized Active/Used list, create/result sheet, and truthful Accounts state are implemented. Typecheck and unit tests pass; visual acceptance remains pending. |
| D04 | Admin-scoped shared snapshot, 60s freshness, in-flight deduplication, retained refresh data. | Implemented | `context/AdminInvitesContext.tsx` implements scoped cache, expiry derivation, retry/retention, auth clearing, tombstones, and post-mutation reconciliation that discards a pre-mutation read and queues one fresh read. `tests/adminInvitePolicy.test.ts` covers freshness, active expiry, stale mutation versions, recency, and structured authorization classification. |
| D05 | Official sign-in -> Use invitation -> existing `/invite` token entry. | Implemented | Sign-in links to manual paste entry; parser accepts bounded raw and supported encoded links without deriving permission from URL claims. Parser tests pass. |
| D06 | Explicit SMS send, no auto-continue, retryable validation, usable back/official exit. | Implemented | Registration has explicit send/resend, cooldown/limit handling, token-generation resets, guarded pending navigation, verification-required recovery, and official sign-in exit. Typecheck and unit tests pass; SMS/device behavior remains unverified. |
| D07 | Enforce challenge expiry/latest proof and final invite expiry; keep existing trust boundaries. | Implemented | Edge Function includes latest-proof/expiry checks, conditional verification/consumption, and cleanup boundaries. Primary's final Deno check and targeted Deno lint passed. Hosted function remains unchanged. |
| D08 | Native build/Universal Links, actual account tools, paged-history RPC, atomic OTP concurrency rewrite. | Deferred | Separate scope; do not implement incidentally. |
| D09 | Equal Android and iPhone support for admin, invitation entry, registration, keyboards, insets, and back behavior. | Implemented | Platform-neutral Expo/React Native code includes safe areas, keyboard avoidance, Android modal/hardware back handling, and OTP width measured to the invite content. No Android or iOS physical acceptance was obtained. |

### Implementation entries

| Date / phase | Agent | Files changed | Actual change / reason | Checks and result | Deviation / remaining work |
| --- | --- | --- | --- | --- | --- |
| 2026-11-09 / audit | Primary | `docs/admin-ui-registration-plan.md` | Recorded source findings, design, phased specification, security boundaries, and test procedure. | Source/migration review; Expo primary documentation consulted. | Application implementation, runtime checks, hosted deployment, and iPhone/SMS acceptance pending. |
| 2026-11-09 / authorization | Primary | `docs/admin-ui-registration-plan.md` | Recorded accepted execution model and explicit Android/iOS parity before handoff. | Reviewed platform requirements against the existing Expo/React Native stack. | Physical-device acceptance must be reported separately for each platform. |
| 2026-11-09 / cache review | Primary | `docs/admin-ui-registration-plan.md` | Clarified D04: an in-flight read from before a successful mutation cannot satisfy its reconciliation refresh; invalidate its result and coalesce one follow-up read. | Reviewed request/mutation ordering before implementation. | Luna must preserve this rule in the cache implementation and relevant tests. |
| 2026-11-09 / Phase A | Luna | `app/(auth)/official-login.tsx`, `app/invite.tsx`, `components/register/OTPInput.tsx`, `hooks/useOfficialRegistrationFlow.ts`, `lib/inviteToken.ts`, `lib/layout.ts`, `lib/officialRegistration.ts`, `styles/screens/invite.styles.ts`, `supabase/functions/official-invite-registration/index.ts`, `supabase/functions/_shared/official-invite-policy.ts`, `tests/inviteToken.test.ts`, `tests/officialInvitePolicy.test.ts`, `package.json` | Added manual invitation paste entry and token parser, guarded registration steps and explicit SMS actions, invitation-bound OTP sizing, shared challenge expiry policy, and latest-proof/final-invite checks. Reused existing edge error parser and registration utilities. | Baseline: `npm.cmd run test:unit` 166/166 passed; `npm.cmd run typecheck` passed; `npm.cmd run lint` exited 0 with two existing warnings in unrelated `lib/publicIncidents.ts:81–82`. Final `npm.cmd run typecheck` passed; final `npm.cmd run test:unit` passed 177/177; final `npm.cmd run lint` passed with 0 errors and those same two unrelated warnings. Deno check first could not read cache in the sandbox; the approved check exposed nullable `challenge` TS18047, which was corrected; the primary reran Deno check successfully. Targeted Deno lint and full Deno lint passed. | No real SMS, hosted function, Auth fixture, browser screenshot, or physical-device validation. |
| 2026-11-09 / Phase B | Luna | `app/admin/_layout.tsx`, `app/admin/accounts.tsx`, `app/admin/index.tsx`, `app/admin/invitations.tsx`, `components/admin/AdminInviteFormSheet.tsx`, `components/admin/AdminInviteRow.tsx`, `components/admin/AdminPageHeader.tsx`, `components/navigation/AdminBottomNav.tsx`, `components/ui/AdminScreenSkeletons.tsx`, `context/AdminInvitesContext.tsx`, `lib/adminInvitePolicy.ts`, `lib/invites.ts`, `lib/portalAccess.ts`, `styles/components/adminBottomNav.styles.ts`, `styles/screens/admin.styles.ts`, `tests/adminInvitePolicy.test.ts`, `package.json` | Added guarded admin access, a scoped 60-second shared invitation snapshot, stale-request/mutation protection, compact admin routes, reusable expandable rows, a bounded create/result sheet, retryable access/data states, and scoped skeletons. RPC authorization classification uses structured codes and HTTP status; transient refresh retains rows; stale revoke callbacks cannot issue work after unmount. Initial count labels remain unknown until a successful snapshot; missing barangays show an explicit empty/retry state. | Full unit suite passed 177/177; typecheck passed; final lint passed with 0 errors and the two unrelated `lib/publicIncidents.ts:81–82` warnings. Focused admin cache policy tests passed as part of the suite. Stylesheet key/reference scan found no unused Admin style keys. `node node_modules/expo/bin/cli export --platform all --output-dir dist/admin-ui-export --max-workers 2` passed outside the sandbox: iOS Hermes (2,167 modules), Android Hermes (2,211 modules), and web (34 routes). The initial sandbox export was environment-blocked by Hermes executable permission denial; its partial output was moved to ignored `dist/admin-ui-sandbox-export`, and the unsandboxed rerun passed. | No visual/browser or Android/iOS runtime acceptance. No hosted deployment. |
| 2026-11-09 / final review corrections | Luna | `app/admin/_layout.tsx`, `app/admin/invitations.tsx`, `app/invite.tsx`, `components/admin/AdminInviteFormSheet.tsx`, `context/AdminInvitesContext.tsx`, `styles/components/adminBottomNav.styles.ts`, `styles/screens/admin.styles.ts` | Replaced inline canvas color with the shared background token, removed an unused type import and repeated success heading/body, allowed page-header wrapping, improved inactive navigation contrast using `colors.textMuted`, tied registration success to the active flow version, used route parameters as the selected invite group and as a modal-onShow compose intent, kept newly opened sheets clean by mounting only while visible, loaded barangays from the BDRRMO role action, and moved callback-ref updates out of render. | Final typecheck passed; full unit suite passed 177/177; `npm.cmd run lint` passed with 0 errors and two pre-existing warnings in unrelated `lib/publicIncidents.ts:81–82`; task-specific `git diff --check` passed. Primary's all-platform export passed. | Browser/device, real SMS, and hosted validation remain pending. |

**Validation limitations:** Browser host unavailable, and native Computer Use stopped because it could not verify the browser's current URL sufficiently to enforce policy. Therefore no browser screenshots or Android/iOS physical acceptance were obtained. No hosted deployment was performed; SMS delivery and hosted challenge-expiry behavior remain unverified. The all-platform local bundle export passed, but it does not replace physical-device or hosted validation.

For a major deviation, append an entry with: previous decision ID, new decision, evidence/reason, affected paths/contracts, migration/deployment impact, and required validation. The primary agent must review changes to navigation, authentication, role/scope, persistent data, or backend contracts before Luna proceeds with the changed scope.
