# BDRRMO UI/UX Optimization Implementation Plan

## Goal

Modernize the BDRRMO official workspace so it has the same visual quality,
interaction consistency, responsiveness, and loading behavior as the optimized
MDRRMO workspace without merging their operational responsibilities.

This is a BDRRMO-only optimization. MDRRMO screens, navigation behavior, data
scope, report defaults, and status workflow must remain unchanged.

## Approved product decisions

1. An escalated report must no longer be visible to BDRRMO, including as
   read-only history. After a successful escalation, remove it from Command,
   Reports, Map, counts, search results, cached state, and direct-detail access.
2. Do not change the MDRRMO experience or business logic.
3. BDRRMO bottom navigation must match MDRRMO: **Command**, **Community**,
   **Map**, and **Settings**. Remove the raised center Report button. BDRRMO
   Reports remains reachable from clear actions inside Command.

These decisions supersede the earlier statements in
`docs/bdrrmo-mvp-phase-2.md` and `docs/bdrrmo-mvp-phase-5.md` that an escalated
report remains available in BDRRMO history.

## Role boundary

| Concern | BDRRMO | MDRRMO | Boundary to preserve |
| --- | --- | --- | --- |
| Geographic scope | Assigned barangay only | Municipality-wide | BDRRMO queries, subscriptions, mutations, and RLS remain barangay-scoped. |
| Primary queue | Unverified reports | Escalated reports | BDRRMO optimization must not alter the MDRRMO default filter. |
| Initial action | Verify an unverified report | No change | BDRRMO verification controls never appear outside its assigned scope. |
| Follow-up actions | Resolve locally or escalate a verified report | Reverify and resolve escalated reports | Action controls come from server-backed permissions and existing secure RPCs. |
| After escalation | Report disappears from BDRRMO | Existing MDRRMO flow remains unchanged | BDRRMO cannot reopen the detail through history, search, Map, or a copied link. |
| Resource authority | Permitted records in the assigned barangay | Existing municipal authority | BDRRMO must not receive municipal create/edit controls. |
| Operational focus | Intake, validation, and local response | Municipal coordination | Shared appearance must not imply shared authority. |

Client-side visibility is not an authorization boundary. Supabase RLS, secure
RPCs, and server-derived official scope remain authoritative.

## Current-to-target comparison

| Area | Current BDRRMO | MDRRMO pattern to follow | BDRRMO target |
| --- | --- | --- | --- |
| Navigation | Five-position layout with a raised Report button | Four evenly spaced operational tabs | Use the same four-tab geometry and visual states. Reports opens from Command, not the bottom bar. |
| Command | Older carousel followed by vertically stacked status cards | Focused command workspace with a stable header, clear operational sections, skeletons, and compact actions | Build a BDRRMO command composition centered on unverified intake and local response. Do not copy MDRRMO escalation or barangay-coordination content. |
| Reports | Older text-heavy queue and inline expanding filters | Image-supported report rows, compact header actions, filter sheet, strong empty/error states | Create a BDRRMO reports workspace with the optimized presentation, default `unverified` filter, Review language, and BDRRMO-only actions. |
| Report detail | Shared detail route with role-aware transitions | Consistent report information and action hierarchy | Retain the shared route and secure transitions; improve BDRRMO entry/exit behavior and remove the report immediately after escalation. |
| Community | Older BDRRMO feed with Community/Resources switch | Polished header, composer, filters, feed states, and focus resets | Match spacing and control quality while retaining local publishing and audience rules. |
| Map | Barangay-scoped data with an older BDRRMO composition | Stable map shell, controlled overlays, collapsed report panel, and resettable temporary UI | Keep the BDRRMO barangay scope and show actionable local reports only. Exclude escalated reports. |
| Resources | Embedded in BDRRMO Community | Optimized directory controls and resource cards | Modernize the embedded BDRRMO resource section without adding municipal authority. |
| Settings | Older cards and mixed hierarchy | Clear identity, coverage, workspace, privacy, support, and session sections | Provide a BDRRMO-specific optimized settings composition showing its assigned barangay. |
| Loading and errors | Mixed spinners and generic state boxes | Layout-matched skeletons and retained content during refresh | Use skeletons only for first load; preserve content during refresh and expose retryable errors. |
| Performance | Large route branches and repeated derived work | Focused components and controlled temporary state | Keep BDRRMO components focused, memoize expensive derived lists, and avoid remounting maps or refetching on presentation-only changes. |

## Implementation constraints

- Do not modify the behavior or UI of `MdrrmoCommandDashboard`,
  `MdrrmoReportsWorkspace`, `MdrrmoCommunityFeed`, or
  `MdrrmoSettingsWorkspace`.
- Shared route files may be edited only in their BDRRMO branches or in
  role-neutral code proven not to change MDRRMO output.
- Reuse existing theme tokens, `MdrrmoHeader`, skeleton primitives, report
  formatting helpers, media components, and secure report APIs where their
  current interfaces already support BDRRMO.
- Do not broaden a shared component's API merely to make BDRRMO resemble
  MDRRMO. Prefer a focused `Bdrrmo...` component when changing the shared
  component would risk MDRRMO regression.
- Do not duplicate data fetching inside presentation components.
- Preserve Expo Router paths and compatible deep links.
- Keep keyboard avoidance, safe-area spacing, accessibility labels, large-text
  behavior, loading feedback, and submission disabling in every phase.

## Phase 0 - Baseline and authorization contract

### Purpose

Lock the BDRRMO behavior before visual work so later UI changes cannot expose
MDRRMO responsibilities or leave escalated data in client state.

### Work

- Inventory every BDRRMO entry point to report data: Command, Reports, report
  detail, Map, notification/deep links, Realtime handlers, and cached hooks.
- Confirm the existing `transition_report_status` RPC remains the only report
  status mutation path.
- Update or add database policies/RPC read rules so an active BDRRMO cannot
  read an escalated report after handoff, even when it originated in the
  official's assigned barangay.
- Verify that the restriction covers report rows, report media, status history,
  comments/contact access, map data, and any official-facing report views.
- Define the BDRRMO visible status set as `unverified`, `verified`, and
  `resolved`, subject to existing business rules. `escalated` is excluded.
- Add permission tests for direct selects, copied report IDs, media/history
  access, and post-escalation reads.
- Record baseline screenshots and navigation behavior for MDRRMO. These are
  regression references only; do not alter MDRRMO.

### Gate

- BDRRMO can read only authorized reports in its assigned barangay.
- A successfully escalated report cannot be loaded again by the BDRRMO account.
- MDRRMO still receives and processes the escalated report exactly as before.
- Cross-barangay and suspended-account tests continue to pass.

## Phase 1 - BDRRMO presentation foundation

### Purpose

Establish the optimized visual language without changing navigation or report
workflow yet.

### Work

- Add focused BDRRMO presentation components only where existing shared
  components cannot be reused safely.
- Reuse existing official typography, colors, spacing, radii, shadows, safe-area
  treatment, and skeleton primitives.
- Standardize BDRRMO section headers, action buttons, report state messages,
  retry controls, and first-load skeleton placement.
- Add focus-reset behavior for presentation state such as open search fields,
  menus, filter sheets, and map overlays. Preserve fetched data and applied
  values unless a later screen requirement explicitly resets them.
- Ensure interactive targets, labels, selected states, contrast, and Dynamic
  Type behavior are consistent with the optimized official interface.

### Gate

- No BDRRMO business behavior changes in this phase.
- No visible or behavioral MDRRMO changes.
- Shared primitives render correctly on narrow and large phones.

## Phase 2 - BDRRMO Reports workspace

### Purpose

Replace the older BDRRMO report queue with an optimized review workspace before
making it the primary Command destination.

### Work

- Add a BDRRMO-specific reports workspace using the same visual hierarchy as
  MDRRMO Reports without editing `MdrrmoReportsWorkspace`.
- Default to **Unverified** and use BDRRMO language: **Reports**, **Review**, and
  **Assigned barangay**.
- Provide compact search, an explicit filter sheet, sort choices, media-aware
  rows, result counts, and clear status/time/location metadata.
- Exclude the Escalated filter and escalated rows from every BDRRMO list.
- Retain only filters the BDRRMO may legitimately inspect: All available,
  Unverified, Verified, and Resolved.
- Use a layout-matched skeleton for first load. During pull-to-refresh, keep
  existing rows visible.
- Keep report creation/logging only if the current secure BDRRMO workflow
  permits it; the action must remain scoped to the assigned barangay.
- On successful escalation, remove the report optimistically only after the RPC
  succeeds, invalidate BDRRMO counts/query state, and navigate to the refreshed
  Reports workspace. A failed transition keeps the report visible and shows a
  retryable error.
- Treat an escalated report opened through a stale/copy link as unavailable and
  return safely to the BDRRMO Reports workspace.

### Gate

- The default queue contains only assigned-barangay unverified reports.
- Search, sort, refresh, empty, partial-loading, and error states work without
  exposing escalated data.
- Verify, local resolve, and escalate actions remain governed by the existing
  server transition rules.
- The MDRRMO Reports screen is byte-for-byte visually and behaviorally
  unaffected by the BDRRMO branch work, aside from unavoidable shared build
  output.

## Phase 3 - BDRRMO Command and four-tab navigation

### Purpose

Make the optimized BDRRMO Command the operational home and switch navigation
only after Reports is reachable from it.

### Work

- Create a BDRRMO Command composition that follows MDRRMO spacing, sticky-header
  behavior, state handling, and section rhythm.
- Prioritize an actionable unverified summary rather than MDRRMO escalations.
- Include a clear **Review reports** action that opens
  `/official/incidents?status=unverified&from=command`.
- Show compact BDRRMO-relevant counts only for visible statuses. Do not show an
  escalated count or municipal coordination metric.
- Present local incident/location context only when it improves triage; do not
  reuse MDRRMO's municipal escalation map or barangay-wide coordination feed.
- Keep existing BDRRMO permitted quick actions, such as logging an official
  incident, but remove actions that duplicate the Community or Map tabs.
- Change the BDRRMO bottom navigation to the same four flat items and geometry
  used by MDRRMO: Command, Community, Map, Settings.
- Remove the raised Report button and its empty center slot for BDRRMO.
- Preserve the existing MDRRMO navigation array, active-state calculation, and
  Reports-through-Command behavior without modification.
- Make the Command and navigation changes atomic so Reports is never left
  unreachable during implementation.

### Gate

- BDRRMO has exactly four bottom tabs matching MDRRMO's layout.
- Reports is reachable in one clear action from Command and Back returns to the
  expected Command state.
- The Command screen never shows escalated reports after handoff.
- Rapid tab switching does not remount expensive content or lose applied report
  filters unexpectedly.
- MDRRMO and Mayor bottom navigation remains unchanged.

## Phase 4 - Community, Resources, and Settings

### Purpose

Bring the remaining non-map BDRRMO screens to the optimized visual standard
without changing publishing, directory, or account authority.

### Community work

- Align the BDRRMO header, composer, feed controls, post spacing, and loading
  states with the optimized official feed.
- Retain the existing BDRRMO local announcement scope, local pin rules, media
  limits, server-derived author/scope, and audience restrictions.
- Close temporary search/filter/composer surfaces on focus as appropriate while
  preserving already-loaded feed data.

### Resources work

- Keep Resources inside BDRRMO Community unless a separate product decision is
  approved later; it is not a bottom-navigation destination.
- Modernize directory tabs, search, record cards, empty states, and editor entry
  points using existing resource APIs.
- Preserve local-only hotline/facility authority, national-hotline protection,
  and evacuation-center status-only authority.
- Keep legacy `/official/resources` BDRRMO links redirecting to the Community
  Resources section.

### Settings work

- Add an optimized BDRRMO settings composition rather than changing
  `MdrrmoSettingsWorkspace`.
- Show official identity, **BDRRMO - {assigned barangay}**, read-only coverage,
  password/access, BDRRMO workspace information, privacy/support, app version,
  and logout.
- Reuse the existing profile photo, password, legal, and logout flows.
- Do not present municipal command settings or MDRRMO notification descriptions.

### Gate

- BDRRMO publishing and resource mutations remain assigned-barangay scoped.
- Settings clearly identifies BDRRMO and its barangay.
- Keyboard, media validation, submission loading, cancellation, retry, and
  destructive confirmations behave correctly.
- MDRRMO Community, Resources, and Settings remain unchanged.

## Phase 5 - BDRRMO Map optimization

### Purpose

Improve map usability after report visibility and navigation behavior are
stable.

### Work

- Retain the current assigned-barangay report and local-resource scope.
- Exclude escalated reports from initial queries, Realtime additions, search,
  marker collections, highlighted callouts, and report panels.
- If an on-screen report is escalated from another surface, remove its marker
  and dismiss any open callout/detail state on the next authorized refresh or
  Realtime event.
- Match MDRRMO's map-shell polish: stable loading layout, controlled layer
  panel, predictable search dismissal, accessible marker selection, and a
  compact/collapsible report surface where appropriate.
- Reset temporary overlays when the tab regains focus but preserve map position
  and selected layers.
- Do not remount the map to reset UI; use narrow controlled props or reset
  signals.
- Keep facilities and evacuation centers limited to the BDRRMO's existing
  authorized view and actions.

### Gate

- No escalated or cross-barangay report can appear through markers, searches,
  panels, callouts, or deep links.
- Map gestures do not fight parent scrolling or bottom navigation.
- Map failure, denied location, offline/stale data, and empty-layer states give
  clear feedback.
- MDRRMO Map behavior remains unchanged.

## Phase 6 - Performance, accessibility, and regression release

### Optimization checks

- Avoid duplicate report fetches between Command and Reports; reuse the current
  official report hook/cache pattern where safe.
- Scope Realtime subscriptions by assigned barangay and allowed visibility.
- Remove escalated items from local state immediately when an authorized
  payload or failed re-read proves they are no longer visible.
- Memoize report filtering/sorting and stable callbacks used by long lists.
- Use thumbnails in queues and resolve full media only in detail views.
- Keep cached content visible during background refresh.
- Avoid inline objects or role-condition branches that trigger unnecessary map
  and list remounts where profiling shows a material cost.

### Required verification

- Run `npm run typecheck` and `npm run lint`.
- Run the Supabase permission suite with the local stack and add assertions for
  BDRRMO post-escalation denial.
- Test resident report -> BDRRMO verify -> local resolve.
- Test resident report -> BDRRMO verify -> escalate -> immediate disappearance
  from every BDRRMO surface -> unchanged appearance in MDRRMO.
- Test copied IDs, stale notifications, back navigation, app resume, offline
  recovery, and Realtime reconnect after escalation.
- Test two BDRRMO accounts from different barangays plus suspended BDRRMO,
  MDRRMO, Mayor, and resident accounts.
- Verify small phone, large phone, landscape, large text, screen reader labels,
  reduced motion expectations, keyboard visibility, denied location, and map
  failure.
- Compare MDRRMO Command, Reports, Community, Map, Resources, Settings, and
  bottom navigation against the Phase 0 baseline.

### Release gate

- All BDRRMO screens use the optimized visual language and complete loading,
  error, empty, refresh, and action-feedback states.
- BDRRMO has no access to an escalated report after handoff.
- No MDRRMO UI, navigation, query scope, default filter, action, or copy changes.
- No client-side service-role use or RLS bypass exists.
- Manual cross-role handoff and device smoke checks are recorded as passed or
  explicitly blocked before deployment.

## Expected file areas

Exact files should be confirmed at the start of each phase. Expected areas are:

- `app/official/index.tsx`
- `app/official/incidents.tsx`
- `app/official/community.tsx`
- `app/official/map.tsx`
- `app/official/settings.tsx`
- `app/official/[id].tsx`
- `components/navigation/OfficialBottomNav.tsx`
- new focused components under `components/official/` only when existing
  interfaces cannot be reused safely
- `hooks/useOfficialReports.ts`
- `lib/officialReports.ts`
- BDRRMO/shared official styles under `styles/screens/`
- Supabase migrations and permission tests for post-escalation visibility

Changes to a shared route must be localized to its BDRRMO branch. The existing
`Mdrrmo...` workspace components are regression boundaries, not refactor
targets for this plan.

## Out of scope

- MDRRMO redesign, refactor, new features, or copy changes.
- Mayor workspace changes.
- New report statuses or changes to the approved transition sequence.
- Municipality-wide visibility or authority for BDRRMO.
- Push notifications, a new notification inbox, analytics, PDF export, hazard
  layers, evacuation occupancy/capability tracking, MFA, or CAP warnings.
- A new Supabase service-role path in the mobile client.

## Completion definition

The plan is complete when BDRRMO visually matches the quality and interaction
standards of MDRRMO, operates through the four-tab layout, keeps its distinct
barangay review responsibilities, and loses all report visibility immediately
after escalation, while MDRRMO remains functionally and visually unchanged.
