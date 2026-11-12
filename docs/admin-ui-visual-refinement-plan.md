# Admin visual refinement — revision 4

Date: 9 November 2026. Status: **Implemented by the existing Luna; primary source/reference review and automated verification passed. Rendered/physical-device acceptance remains unobserved.**

This is the current Admin presentation specification. The user rejected revision 3 as generic and boring. Its working navigation, access rules, Settings actions, local invite creation, data cache and registration safeguards remain required. The revision 3 visual composition is superseded; its automated results are historical, not evidence for this revision.

## Evidence from the requested reference screens

| Reference inspected | Actual pattern | Admin application |
| --- | --- | --- |
| `app/(main)/home.tsx`, `styles/screens/home.styles.ts` | White canvas; compact greeting/location header; a broad 285px map focal area; navy Inter type; short open tool rows; targeted washes. The current Resident canvas is **white**, not the pale-blue canvas assumed in revision 3. | Restore a quiet white canvas and concentrate pale blue in one broad access hero. Use stronger type and real municipal identity. |
| `components/official/BdrrmoCommandDashboard.tsx`, `MdrrmoCommandDashboard.tsx` | Sticky header outside the ScrollView, full-width primary area, task sections with little vertical card stacking. | Give Admin an independent persistent header and broad focal area. Retain distinct Dashboard and record workspace responsibilities. |
| `components/official/MdrrmoHeader.tsx`, `styles/screens/official.styles.ts` | Actual Minglanilla seal, 22–24px title, concise identity/location line, unboxed account controls. | Use the existing `assets/images/mingla.png` in `AdminPageHeader`; title above a short municipality/Admin subtitle. No new profile requests for a header. |
| `components/official/CommandQuickResponse.tsx`, `styles/screens/mdrrmoCommand.styles.ts` | Compact horizontal tools separated with fine rules, 20px section titles, consistent navy icons, no individual floating card per tool. | Turn By role into a compact three-column strip with fine separators; meaningful counts and routes, no fake tools. |
| Resident/operational record panels | Leading identity, bold title, restrained metadata and status accents; strong content hierarchy rather than a box around every field. | A continuous Invites list with leading initials, recipient and status; fine row dividers replace spaced floating cards. |

## Ownership and scope

- Primary decides layout, flow and review. **Reuse `/root/luna` (`gpt-6-luna`, xhigh); create no agents.** Luna alone implements source changes.
- Before edits, save the affected current source files under ignored `dist/admin-ui-r4-baseline/` using `.baseline` extensions. Record actual files and diff against this snapshot; do not claim an unsaved baseline exists.
- Local Admin presentation only. Do not alter Resident/BDRRMO/MDRRMO screens, global theme values, backend/schema, registration/auth contracts, RLS, cache timing, search/filter logic or credential handling.
- Keep Inter, actual official floating navigation, three destinations, Accounts redirect, direct local invite sheets, status visibility, confirmed mutations, race/unmount guards and all loading/error/empty states.

## Screen composition

### 1. Shared municipal header

- Place `AdminPageHeader` outside each screen's scrollable content/FlatList so it stays visible, matching Command. Center a maximum 640px content width with 24px gutters; top safe area remains native.
- Actual municipal seal about 42px, no shield-in-a-colored-square tile. Title 22px semibold with slight negative letter spacing. Subtitle `Minglanilla · Admin`, 12px muted. Dashboard title `Admin`; other titles `Invites` / `Settings`.
- Dashboard gear is an unboxed 44px target. Invites keeps its functioning compact New invite action. Let title/actions wrap or stack at small widths/enlarged type; do not clip text or impose fixed header height.
- Reuse role-neutral official header style values/assets where appropriate, without importing official context, operational actions or profile-fetch lifecycle.

### 2. Dashboard: one broad focal area and open sections

Order: persistent municipal header → broad access hero → slim expiry strip → open By role tools.

- **Hero:** full width of the centered screen column, with internal 24px gutters, rather than an inset floating card. Pale blue `#E8F1F5` already used by Resident/Command map hero; dark navy ink; no border, shadow, outer rounding or nested status cards. Height grows with content (roughly 230–270px at default size, never fixed).
- Title `Official access`, 30–32px semibold. Actual pending count about 52–56px, with explicit `Pending` label and a subtle arrow to its filtered workspace. Registered is a smaller adjacent count/label separated by a fine vertical rule; both remain working status shortcuts. Stack at narrow widths/large font scale.
- A single navy **New invite** button sits inside the hero, about 48px minimum target height with natural width and a plus. It opens the shared local sheet and remains available if reads fail. Do not add another creation tool below it.
- This hero's identity comes from typography, asymmetry and broad composition. Do not add a fabricated map/chart, stock image, huge decorative icon, repeated seal, motivational paragraph or invented statistics.
- **Expiry:** one compact warm strip with a leading thin accent/clock and `N expiring in 48h`, plus Review. No separate bubbly attention card. Zero state is a quiet check line `No invites expiring soon`. Preserve unknown/error states and local 48h transitions. Stack Review when needed.
- **By role:** open section with 20px bold heading, fine top/bottom rules and three equal functional columns for Mayor / MDRRMO / BDRRMO. Navy outline icons (person/business/people), role label and `pending / registered` counts. One concise visible `Pending / Registered` legend. No rounded box per role, no table of fixed-width numeric cells, no horizontal scrolling. At widths below 360px or when the existing `useAccessibilityLayout().isLargeText` is true (currently scale 1.3), switch to vertical labeled rows. Maintain exact screen-reader count/action labels and existing role-filter routes.
- No recipient records or logout on Dashboard.

### 3. Invites: continuous records, decisive hierarchy

- Persistent municipal header above the actual virtualized list. Search, status tabs and filters stay in the list header so typing and scrolling remain predictable.
- Replace the filled rounded segment trough with two simple Pending/Registered tabs, actual count labels and navy selected underline. Tabs remain clear at large text and before data loads.
- Keep search and filter controls compact and functional; filters/search remain local and memoized. Do not add more permanent chips or redundant query text.
- Remove per-record shadow, outer rounded card and 8px empty separators. Make a continuous white list with fine horizontal dividers and comfortable 16px vertical spacing.
- Each expandable row has a leading 36–40px initials circle (reuse `ProfileAvatar` fallback without network calls), then recipient email, **status immediately below**, role/scope and short date/mobile metadata. Status uses a small colored dot/marker and readable text rather than a large decorative pill. Navy pending, existing green registered, existing brown expiring. Keep trailing chevron in the first row, email wrapping and minimum touch targets.
- Full status/recipient remains visible collapsed. Expansion retains created date, confirmed revoke, loading and inline error. No copying unavailable tokens. No extra generic More details button.

### 4. Settings: account page, no stack of ornamental cards

- Persistent municipal header; an open identity area with actual ProfileAvatar/name/email/role and a subtle blue lower wash or rule. Remove the heavy rounded identity card.
- Group account/legal/about rows using section labels, fine rules, leading outline icons and trailing chevrons only for actions. Remove panel shadows and thick outer rounded containers.
- Sign out is a restrained destructive text/icon row with confirmation and pending/error feedback, not the main solid-color page action. Preserve all password/logout/account-switch guards and legal behavior.
- Keep real app version and working Retry. No fake preferences or new API calls.

## Visual tokens and accessibility

- Reuse `colors.white`/`background`, `navigationActive`, `text`, `textMuted`, existing Inter families/spacing and official styles. Centralize Admin-specific hero/warm/mint/ink values in the existing Admin module; do not recolor other roles.
- White canvas is a deliberate correction to match the inspected current reference screens. Pale blue remains visually substantial in the hero, with semantic color reserved for state.
- Primary calculated proposed text contrast: navy `#0F2044` on hero `#E8F1F5` **13.99:1**; registered `#047857` on white **5.48:1**; expiring `#885B2F` on white **5.86:1**; metadata `#6B7280` on white **4.83:1**. These are color calculations, not rendered or device verification.
- Match skeletons to the new broad hero, open role strip, continuous records and open identity. Keep usable actions visible while loading. Remove obsolete Admin presentation styles only when no longer referenced.
- Reuse `hooks/useAccessibilityLayout.ts` for large-text layout policy, as Resident Home does; do not introduce another threshold. Both iOS and Android: safe areas, native modal/back, keyboard avoidance/dismissal, 320px width, 375/390px phone, tablet max width, text scale 1.3–2, no fixed text-bearing heights and no overflow from long emails/names.
- In the compact role fallback, each role's identity sits **above** full-width labeled count lines. Do not reserve a 128px side column beside the role name; that still squeezes long role labels at scale 2. Quiet zero-state text must flex/wrap, and Review retains at least a 44px target.

## Review and validation

- Primary reviews actual source against reference patterns and checks the saved before/after scope. A changed color alone does not pass.
- Retry rendered review using allowed tools. Browser connector currently reports host unavailable; a native-browser fallback may be attempted through Computer Use. Do not bypass the Admin gate, create release-visible fixtures, fabricate screenshots, or claim device/rendered acceptance from builds.
- Run typecheck and lint; existing unrelated `publicIncidents.ts:81–82` warnings are known. Unit suite baseline is 181 passing tests; no new style/source-string tests. Run focused unit checks if logic changes, otherwise existing checks plus build are appropriate.
- Export iOS/Android/web to ignored `dist/admin-ui-r4-export/`, using the previously approved narrow outside-sandbox Hermes export command. Confirm all Admin routes still export.
- Manual acceptance when a rendered surface is available: Dashboard local create/dismiss; both status/role shortcuts; Invites search/filter/reset/expand; all Settings presentations; small/enlarged text and bottom inset. Do not perform live invitation, credential or destructive actions incidentally.

## Decision / execution audit

| ID | Decision | Status |
| --- | --- | --- |
| R4-01 | Current role layouts, not revision 3's pastel-card assumption, guide Admin. | Implemented; actual reference source/style audit recorded above |
| R4-02 | Municipal sticky header, broad asymmetric access hero, compact open role strip. | Implemented; primary source review passed |
| R4-03 | Continuous invite list, leading initials/status, underlined status tabs. | Implemented; primary source review passed |
| R4-04 | Open Settings identity and ruled account groups; restrained sign-out action. | Implemented; account handlers preserved |
| R4-05 | Preserve all functional/security/cache improvements and all other roles. | Seven-file Admin implementation scope; no backend/theme/other-role implementation edits |
| R4-06 | Reuse Resident Home's existing large-text hook instead of separate Admin thresholds. | Implemented in layouts and skeletons |

| Phase | Owner | Actual work / evidence | Checks / remaining |
| --- | --- | --- | --- |
| Reference audit and plan | Primary | Read current Resident Home/styles, both Command dashboards, shared operational header, quick tools and associated styles. Corrected the mistaken assumption that current Resident Home uses a pale-blue whole canvas. | Source audit complete; rendered browser connector reports host unavailable. Luna implementation pending. |
| Baseline and implementation start | Existing Luna | Saved seven affected source files as byte-preserving `.baseline` copies plus `manifest.txt` under ignored `dist/admin-ui-r4-baseline/`. | Actual saved baseline available for this revision; implementation in progress. |
| Rendered review attempt | Primary | Browser connector returned no browser surfaces and `host unavailable`. Native Brave fallback returned Brave accessibility data but screenshots of Cursor; the single activation/re-observation recovery also mismatched. No UI input issued against that mismatched surface. | Rendered acceptance remains unobserved. Do not describe source inspection as screenshot/device review. |
| Route comparison and unit regression | Primary | Compared the three changed routes against their saved baseline. Invites query/filter/revoke handlers and Settings credential/logout handlers retain their earlier logic; header placement, shared accessibility hook and presentation markup account for the inspected changes. | Full existing unit suite rerun: **181/181 passed** (`dist/admin-ui-r4-unit.log`). Styles/skeletons and final type/lint/platform checks still pending. |
| Implementation | Existing Luna | Updated exactly the seven source files listed below. Replaced shield tiles, nested status cards, floating recipient cards and ornamental Settings containers with the specified municipal header, broad hero, open role tools, continuous records and ruled account groups. | Saved baseline and manifest verified; no new routes, fixtures, backend changes or live mutations. |
| Primary corrections | Primary decisions / Luna implementation | Replaced the compact role side column with identity-above-counts; made the zero-expiry message wrap; restored 44px Review target; synchronized compact skeletons. Fixed real-name avatar initials, used navy avatar text, removed duplicate municipality text and shortened Settings group labels to Account/Legal/About. | Final source inspected against baseline; all seven before/after whitespace checks clean. These are presentation/accessibility corrections, not changes to credential or invite contracts. |
| Final validation | Primary | Verified source alignment with the requested role patterns and finalized this audit after the stable-source checks. No further source edits after validation began. | **Typecheck passed**; **lint passed** (ESLint zero errors, only the two existing `lib/publicIncidents.ts:81–82` warnings; Deno checked 26 files); **iOS, Android and web export passed**, with 35 static routes including all four Admin paths. Logs: `dist/admin-ui-r4-typecheck.log`, `dist/admin-ui-r4-lint.log`, `dist/admin-ui-r4-export.log`. Export: `dist/admin-ui-r4-export/` (ignored local artifacts). Rendered/device acceptance remains unobserved. |

## Final file inventory and reuse

| Modified source file | Result |
| --- | --- |
| `app/admin/index.tsx` | Persistent header, broad asymmetrical access hero, local creation, slim expiry state and compact role tools; retained cached summaries and shortcut filters. |
| `app/admin/invitations.tsx` | Persistent header, shared large-text policy and continuous list separators; preserved search/filter/refresh/revoke flows. |
| `app/admin/settings.tsx` | Persistent header, open identity and account groups, correct actual initials, concise labels and restrained confirmed logout; credential/session guards retained. |
| `components/admin/AdminPageHeader.tsx` | Reusable municipal seal/title/subtitle header replacing the shield tile across all three routes. |
| `components/admin/AdminInviteRow.tsx` | Reused `ProfileAvatar` for local initials, leading readable dot/status, continuous record hierarchy and retained expansion/revoke state. |
| `components/ui/AdminScreenSkeletons.tsx` | Shapes and compact fallbacks match the new hero, open role tools, continuous records and identity. |
| `styles/screens/admin.styles.ts` | Central white/targeted-wash palette; broad hero, ruled sections, responsive count layout and record styling. No global theme changes. |

Documentation updated: this current revision, `admin-ui-rework-plan.md` (revision 3 supersession) and `admin-ui-registration-plan.md` (current-plan pointer). The existing municipal asset, `ProfileAvatar`, `useAccessibilityLayout`, Inter tokens, official floating navigation and shared invite sheet are reused; no new reusable abstraction was needed.

Primary outcome: the source now follows the inspected Resident/Command composition instead of the rejected card stack. This is **source/build acceptance**, not an assertion of observed visual quality. On the next device review, restart Metro using `npm start -- --clear` and fully reload Expo Go; check both Android and iOS, long recipient emails and enlarged text. Record any subsequent visual feedback as a new decision before changing this revision.

Append implementation, modified-file inventory, primary corrections and actual check results here. Preserve rejection history so a later model does not restore the old card stack.
