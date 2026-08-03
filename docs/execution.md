# Mayor Situational Awareness and Community Support MVP

## Approved scope

Deliver a read-only Mayor dashboard for municipality-wide awareness, paired with the existing in-app municipal announcement workflow.

- Resident reports remain observations; this work does not create or deduplicate operational incidents.
- BDRRMO retains barangay verification and escalation; MDRRMO retains municipal re-verification, resolution, and incident operations.
- A Mayor can view municipality-wide submitted-report data, open report details without any report action or reporter-contact control, publish municipal announcements, and keep the existing evacuation-center priority control.
- Push notifications, authoritative emergency warnings, incident analytics, PDF exports, and announcement lifecycles remain deferred.

## Acceptance criteria

- Mayor sees an accurate all-time total across every submitted report, not merely the latest 100.
- Dashboard supports All Barangays or one barangay and All Statuses or one current report status. Status distribution and barangay breakdown reconcile consistently with those filters.
- Mayor can open matching reports but cannot verify, escalate, resolve, edit, or contact reporters.
- Mayor can publish a municipality-wide in-app announcement from the dashboard. It appears in Mayor, MDRRMO, BDRRMO, and resident feeds in the established Mayor → MDRRMO → BDRRMO pin hierarchy.
- Loading, empty, partial-data, refresh, retry/error, and accessibility states are complete. Existing Resident, BDRRMO, and MDRRMO report handling does not regress.

## Current-state findings to preserve

- Mayor already enters the shared `/official` portal and receives Brief, Situations, Community, Map, and Priority navigation.
- `useOfficialReportQueue` is limited to 100 reports and signs media; it must not supply Mayor totals.
- `report_stats_by_barangay` provides the existing role-scoped analytics pattern. Municipality-wide announcement publishing already derives scope server-side in `create-official-announcement` and rejects inactive accounts.
- Resident feed RLS already receives municipal announcements; pinned ordering is already Mayor → MDRRMO → BDRRMO.
- Mayor evacuation-center priority controls exist and remain unchanged.
- TypeScript and lint start with eight unrelated warnings; do not refactor them as part of this feature.

## Phase 0 — documentation, security, and baseline

1. Preserve all unrelated staged, modified, and untracked work.
2. Confirm `20260801000002_active_profile_scope_security.sql` is applied before analytics is exposed.
3. Extend authorization tests to prove that active Mayor and MDRRMO accounts receive municipal aggregates; BDRRMO accounts receive only their assigned barangay; residents, suspended officials, and incomplete official profiles receive no aggregate rows; and a Mayor cannot transition a report or contact a reporter.
4. Use additive migrations only. Do not alter report statuses or historical report rows.

Exit condition: analytics is role-scoped and cannot broaden report permissions.

## Phase 1 — trustworthy analytics data

1. Add a compact, security-invoker `report_totals_by_barangay` view with `barangay_id`, `barangay_name`, `status`, and `report_count`. It aggregates all-time reports by current status and barangay, represents missing barangays as an `Unassigned` data-quality count, and reuses the existing report barangay/status index.
2. The view explicitly permits active Mayor and MDRRMO municipal access and active BDRRMO access only to its assigned barangay. It returns no rows to residents, suspended accounts, or incomplete profiles.
3. Add a Mayor analytics module and hook. It aggregates the compact view locally, never a paginated report list, and exposes matching total, four status totals, barangay totals, unassigned total, timestamp, loading, refresh, partial-data, and error state. Barangay names and ordering use `fetchBarangays()`.
4. Refresh analytics on screen focus, pull-to-refresh, and report realtime events.
5. Add a secure paginated Mayor situation RPC: optional barangay/status, trimmed search text, max page size 20, offset, safe list fields, and exact matching count. Search title, description, address, and safe reporter display name using SQL parameters. The RPC requires an active Mayor account and still relies on scoped report RLS. Media loads only after opening details.

Exit condition: totals remain accurate beyond 100 reports and every dashboard result can be opened from the matching paginated list.

## Phase 2 — Mayor dashboard and drill-down

1. Replace only the Mayor branch of `app/official/index.tsx`; BDRRMO and MDRRMO Command behavior stays unchanged. Keep the Brief navigation label and show the heading “Mayor Dashboard”.
2. Show municipality scope, “All time”, All Barangays/one-barangay selector, All/one-status selector, filtered matching total, full four-status distribution for the selected barangay, accessible stacked distribution bar, status-sensitive barangay ranking, an unassigned warning, timestamp, and the notice that figures are submitted reports rather than deduplicated official incidents. Include a compact report-activity chart with a numeric report-count Y-axis: a single hourly trend line for Today and status-colored stacked daily bars for 3 days and Monday–Sunday. The status selector shows All or one workflow status at a time.
3. Changing barangay recomputes every metric. Changing status recomputes matching total/ranking while leaving all four status cards visible. The selected status is visibly emphasized without relying on color alone.
4. “View matching reports” routes to Situations with validated `barangayId` and `status` parameters. Invalid parameters fall back to All.
5. Mayor Situations initializes from these route parameters and uses the secure server query, exact count, search, page size 20, and a Load more control only when another page exists. Mayor report cards and details remain read-only.
6. Complete initial-loading, refresh-with-stale-data, retry, valid-zero, partial-barangay-label, error, screen-reader, long-name, and small-screen states.

Exit condition: the Mayor understands the submitted-report picture and can drill into exact reports without operational report authority.

## Phase 3 — community announcement delivery

1. Add “Publish announcement” as the dashboard’s primary community-support action and route to `/official/community?compose=1`.
2. Community validates the Mayor role and opens the existing shared composer once. The composer displays “Municipality-wide — visible to residents and authorized officials” as read-only audience information.
3. Preserve existing validation and behavior: required description (maximum 4,000 characters), up to three photos and one duration-validated video, optional municipal pin, disabled publish state, inline error, discard confirmation, and success confirmation.
4. Scope continues to be derived inside `create-official-announcement`; the client never sends role, barangay, author, or municipal scope. On success, close/reset the composer and refresh the feed. Existing Mayor → MDRRMO → BDRRMO pinned ordering remains unchanged.

Exit condition: the Mayor can publish a secure municipal in-app announcement and every authorized audience receives it in its existing feed order.

## Phase 4 — verification and handoff

1. Add unit coverage for reduction, filters, percentages, unassigned reconciliation, and route-parameter validation. Add component coverage for dashboard states/labels/shortcut and RLS coverage for all authorized and denied roles.
2. Run `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run test:rls`.
3. Verify these cross-role workflows:
   - Resident submits → BDRRMO sees only its barangay → verifies/escalates → MDRRMO re-verifies/resolves → Mayor totals update.
   - Reports in two barangays reconcile under All Barangays and each individual barangay. Mayor status filters reconcile with all four status totals.
   - Mayor opens report detail with no mutation/contact controls, then publishes unpinned and pinned announcements that Resident, BDRRMO, and MDRRMO see in correct order.
   - A suspended Mayor loses dashboard and publishing access during an existing session. Network failures retain dashboard data where possible and never report a failed announcement as published.
4. Device checks cover small Android phones, large font scaling, screen reader labels, intermittent connectivity, pull-to-refresh, expired sessions, and long barangay names.
5. Roll out by applying the additive migration, running RLS tests, deploying mobile, and walking through seeded multi-barangay reports. The client UI may be rolled back independently; the additive analytics view/RPC may remain.

## MVP constraints

The dashboard range is all time. Workflow statuses describe reports, not resolved incident-command states. No reporter contact information is exposed to a Mayor. Map, Priority Center, Resident, BDRRMO, and MDRRMO behavior remains unchanged except for the existing delivery of newly published municipal announcements and normal report-data updates.
