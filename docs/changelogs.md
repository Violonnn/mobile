# DisasterLink Change Log and Delivery Notes

**Branch:** `home-dashboard-residents`

**Prepared:** August 3, 2026

**Recommended feature name:** **Official Disaster Operations and Community Awareness MVP**

## Release summary

This work expands DisasterLink from a resident reporting experience into a role-aware municipal operations MVP. Residents receive a more useful home, feed, map, and reporting flow. BDRRMO and MDRRMO personnel receive scoped report handling, announcements, resources, evacuation-center controls, and operational maps. The Mayor receives municipality-wide, read-only report awareness and can publish community announcements without gaining report-processing or reporter-contact authority.

The implementation is present in the repository, but it is not a production deployment record. The database migrations and Edge Functions still need to be applied to the target Supabase environment, followed by cross-role and device validation.

## What was added

### Resident experience

- Home now loads current official announcements, verified emergency hotlines, and facilities, with clear loading, empty, error, refresh, call, feed, and map actions.
- The feed combines official announcements and resident reports, supports engagement-based or date sorting, and loads additional reports progressively.
- The resident map now supports report, facility, and evacuation-center layers with reusable detail sheets and marker selection.
- Report location capture now supports GPS, low-accuracy confirmation, manual pin adjustment, readable addresses, and an explicit barangay selection.
- Report submission sends the resident-confirmed barangay for BDRRMO routing and validates it again on the server.
- Offline submission feedback now distinguishes syncing, synced, and failed states and provides a retry action.
- Report cards, comments, and media surfaces now expose clearer partial-data and attachment errors instead of silently hiding failures.
- The report form explains that reporter contact information is private and can only be purposefully accessed by authorized BDRRMO/MDRRMO personnel handling the report.

### Official portal

- Replaced the single official screen with a role-aware Expo Router section, shared official context, reusable header, and bottom navigation.
- Added Command/Brief, Reports/Situations, Community, Map, Resources, Settings, report details, and official report logging routes.
- Added searchable, filterable, sortable report queues with role-specific defaults and real-time refresh.
- Added guarded report workflow actions: BDRRMO verification, local resolution, and escalation; MDRRMO re-verification and resolution; confirmation prompts; optional timeline notes; and attribution history.
- Added purpose-confirmed reporter-contact access for authorized operational roles, with an audit record for each reveal.
- Added official report creation and update flows through authenticated Edge Functions rather than direct client writes.
- Added a shared official announcement composer with required description, up to three photos, one short video, previews, removal, optional pinning, validation, discard confirmation, and publishing feedback.
- Added announcement likes and comments, real-time counters, signed private media access, and scoped comment moderation.
- Added hotline, facility, and evacuation-center management with search, role-aware actions, map-based facility location, call actions, archive/reactivate behavior, center status controls, and Mayor/MDRRMO priority controls.
- Added official map layers for authorized reports, facilities, and evacuation centers. Official maps intentionally exclude device-local unsent resident reports.
- Preserved compatible links by redirecting older official resource routes into the current resource experience.

### Mayor awareness

- Added an all-time Mayor dashboard with municipality/barangay and report-status filters.
- Added reconciled report totals, four-status distribution, barangay ranking, unassigned-data warnings, last-updated feedback, and today/3-day/7-day activity charts.
- Added secure, paginated matching-report drill-down with search and exact counts.
- Kept Mayor report cards and details read-only: no verification, escalation, resolution, editing, or reporter-contact controls.
- Added a direct path from the dashboard to publish a municipality-wide in-app announcement.

### Backend, data, and security

- Added additive Supabase migrations for report transitions and history, explicit barangay routing, official resources, evacuation centers, announcement media and engagement, comment visibility, active-profile enforcement, BDRRMO scope, Mayor analytics, and activity charts.
- Added Row-Level Security policies and protected database functions so BDRRMO access stays within its assigned barangay, MDRRMO receives municipal operational scope, Mayor remains read-only where required, and suspended profiles lose protected access even with an existing session.
- Added a guard against re-escalating a report after MDRRMO re-verification.
- Added private announcement-media storage rules and server validation of the authenticated author, role, scope, attachment folder, and media limits.
- Added the verified national emergency hotline `911`; local LGU numbers are deliberately not seeded until the municipality confirms them.
- Added 35 database authorization assertions covering allowed and denied access across Resident, BDRRMO, MDRRMO, Mayor, Admin, cross-barangay, and suspended-account cases.
- Added Mayor analytics unit tests plus consistent `test`, `typecheck`, `lint`, and RLS test commands.

## Important product and implementation decisions

- **Reports remain resident observations.** Counts on the Mayor dashboard are submitted reports, not deduplicated or officially declared incidents.
- **Role and scope are derived by trusted backend code.** Clients do not choose an official author, municipal/barangay scope, or publication authority.
- **Barangay selection and coordinates serve different purposes.** The chosen barangay routes the report to the correct BDRRMO; coordinates retain the reported location. The older nearest-center behavior remains only as a compatibility fallback.
- **Mayor access is strategic and read-only.** The Mayor can understand municipality-wide conditions and publish announcements, but cannot process reports or reveal resident contact information.
- **BDRRMO authority is local.** BDRRMO can act only on its barangay's reports and local records, while active municipality-wide directory entries remain visible where useful.
- **MDRRMO authority is municipality-wide.** Municipal re-verification, resolution, official operations, and broader resource management remain with MDRRMO.
- **Announcements are in-app community information, not formal emergency warnings.** Pinned ordering is Mayor, then MDRRMO, then BDRRMO, followed by recency.
- **Private media is accessed through short-lived signed links.** Direct public storage access is not introduced.
- **RLS remains the final authorization boundary.** UI filtering improves usability but is not treated as a security control, and no service-role key is used by the mobile client.
- **Database changes are additive.** Existing report rows and status history are preserved, and compatibility paths are retained where practical.

## Verification completed

| Check | Result | Notes |
| --- | --- | --- |
| Mayor analytics unit tests | Passed | 4 tests passed. |
| TypeScript | Passed | `tsc --noEmit` completed without errors. |
| App and Edge Function lint | Passed with warnings | 0 errors; 8 existing warnings remain in unrelated or previously documented files. |
| Database authorization tests | Not run locally | The 35-assertion pgTAP suite requires Docker and a running local Supabase stack. |
| Android/iOS field checks | Not run | A connected device/emulator and deployed backend are still required. |
| End-to-end production validation | Not run | Target Supabase migrations and Edge Functions have not been confirmed deployed from this workspace. |

The remaining lint warnings concern unused imports and React Hook dependency lists in the landing, invite, official detail, media preview, welcome modal, and login code. They do not currently fail the lint command, but should be resolved before enforcing a zero-warning release gate.

## Not yet implemented or confirmed

- Applying the pending migrations to staging/production and deploying the changed `create-report`, `create-official-announcement`, `create-official-report`, and `update-official-report` functions.
- Full cross-role validation using Resident, BDRRMO, MDRRMO, Mayor, suspended, and cross-barangay test accounts.
- Android/iOS checks for small screens, large text, screen readers, keyboard behavior, denied location, map failure, expired sessions, and intermittent connectivity.
- A working notification inbox, push delivery, provider receipts, and notification preferences; notification icons must not be presented as operational yet.
- Formal government warning workflows, approval, update/cancel history, geographic targeting, CAP alignment, SMS/push dissemination, and delivery evidence.
- A separate official incident lifecycle for deduplication, assignments, actions, operational periods, handoff, and SitRep generation.
- Barangay boundary polygons, server-side point-in-polygon validation, authoritative hazard layers, and a supported degraded map mode.
- Evacuation occupancy updates, family/vulnerable-group aggregates, capability tracking, freshness warnings, and status history.
- PDF/official exports, immutable snapshots, records-retention automation, audit review tools, and public transparency datasets.
- MFA and completed government identity proofing for privileged users, plus formal account recovery and lost-device procedures.
- Durable encrypted offline media/background upload guarantees and production-tested retry behavior across operating-system cleanup or long outages.
- Complete misinformation/flag review, accessibility certification, load/resilience testing, backup/restore exercises, penetration testing, and production monitoring.
- Confirmed municipality-owned app identifiers, signing credentials, store accounts, deep-link domains, data owners, and verified local hotline/facility datasets.

## Recommended next steps

1. Create a staging Supabase project or refresh the approved staging environment, apply migrations, deploy all changed Edge Functions, and run the 35 database permission assertions.
2. Seed only municipality-verified local contacts and facilities, then conduct the documented cross-role report handoff and announcement visibility exercises.
3. Complete the Android/iOS device matrix and fix the remaining lint warnings before adopting a zero-warning CI gate.
4. Add continuous checks for unit tests, TypeScript, lint, migration drift, RLS tests, secret scanning, and build verification.
5. Treat the next product milestone as release hardening: authorization evidence, safe offline reporting, government ownership, privacy/records decisions, and operational exercises.
6. After the controlled pilot is stable, prioritize notifications and an observation-to-incident workflow before adding broader dashboard or visual features.

## JIRA-ready feature and subtasks

### Feature

**Official Disaster Operations and Community Awareness MVP**

**Goal:** Give residents a safer way to submit and follow local reports while giving authorized barangay, municipal, and Mayor users the appropriate tools and visibility for their responsibilities.

### Completed subtasks

1. **Improve resident home and local information:** Show current announcements, emergency contacts, facilities, nearby report activity, and clear error/empty states.

2. **Make resident report location and routing reliable:** Allow GPS or manual map confirmation, require barangay selection, route reports to the correct barangay office, and show upload retry status.

3. **Create the shared official workspace:** Provide role-aware navigation, headers, settings, and screen access for BDRRMO, MDRRMO, and Mayor users.

4. **Support barangay-to-municipal report handling:** Let BDRRMO review, verify, resolve locally, or escalate reports and let MDRRMO re-verify and resolve escalated reports with an accountable history.

5. **Publish and engage with official announcements:** Let authorized officials publish scoped photo/video announcements, optionally pin them, and support audience-safe likes, comments, and moderation.

6. **Manage emergency contacts, facilities, and centers:** Provide searchable resource records, mapped facilities, call actions, archive/reactivate controls, evacuation-center status, and priority controls based on role.

7. **Show reports and resources on operational maps:** Display only the reports, facilities, and evacuation centers each role is allowed to see, with useful detail views and safe deep links.

8. **Provide Mayor situational awareness:** Show accurate all-time report totals, filters, status distribution, barangay ranking, activity trends, read-only report details, and an announcement shortcut.

9. **Enforce role, barangay, and active-account safeguards:** Ensure protected data and actions are denied outside the user's role/scope and immediately denied after account suspension.

### Remaining release subtasks

10. **Deploy and verify the staging backend:** Apply database updates, deploy server functions, run permission checks, and record results.

11. **Complete cross-role field testing:** Exercise the full resident-to-BDRRMO-to-MDRRMO flow, Mayor visibility, announcement audiences, suspension, and cross-barangay denial on real devices.

12. **Prepare verified municipal resource data:** Confirm ownership and accuracy of local hotline, facility, evacuation-center, barangay, and map data before public use.

13. **Establish release quality checks:** Add automated build/security checks, resolve warnings, and document monitoring, rollback, backup, and recovery evidence.

14. **Design notifications and official incident follow-up:** Define the next approved scope for a real inbox/push workflow and for linking resident observations to managed official incidents without changing original reports.

## Main file areas changed

- `app/(main)/`, `components/report/`, `components/map/`, and resident hooks/libraries: resident home, feed, reporting, comments, and map behavior.
- `app/official/`, `components/official/`, `context/`, and official hooks/libraries: role-aware official portal and Mayor dashboard.
- `lib/resources.ts`, announcement modules, and related hooks: resource directory, evacuation centers, media, engagement, and comments.
- `supabase/migrations/`, `supabase/functions/`, and `supabase/tests/`: schema, RLS, trusted workflows, analytics, storage access, and authorization tests.
- `styles/`, `app.json`, package configuration, and documentation: shared visual treatment, location disclosure, tooling, delivery notes, and implementation plans.

## Reusable code introduced

- Shared official portal context, header, and bottom navigation.
- Reusable location picker and report/resource map detail components.
- Shared announcement composer, post cards, engagement provider, and comment hooks.
- Reusable resource forms and data hooks for hotlines, facilities, and evacuation centers.
- Shared Mayor analytics reducer and query helpers.
- Shared protected report workflow, reporter-contact, and role/scope helpers backed by RLS.
