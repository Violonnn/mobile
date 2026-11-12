# Resident report publication and sharing

## Current status — deployed 8 November 2026

**Phase 4 is deployed for controlled testing, but not complete.** Migrations
`20261108000000`, `20261109000000` and `20261110000000` plus the `create-official-report` and
`process-public-report-photo` Edge Functions are deployed. Confirmation, field
findings, eligible links and on-site official intake now commit screened text,
disclosure approvals and safe-photo choices in the same retry-safe action. Local
SQL, client, export, media-flow and rollback-only hosted checks pass. The
30-report/11-incident/63-media unchanged snapshot is historical for the 080/090
deployment. A later read-only preflight for the 110 amendment observed 32
reports, 11 incidents, 65 media records and zero individually published posts;
its post-deployment source snapshot matches. Physical-iPhone acceptance, R5 and G1
remain pending. See
the authoritative [current plan audit](report-response-flow-plan.md#current-phase-4-audit-and-handoff--8-november-2026).

Hosted catalog/ACL checks and the 17-function fingerprint pass; both new Edge
Functions require authentication and processor CORS preflight succeeds. The two
rollback-only SQL files report 37 TAP results, including 36 atomic/RLS checks
and the wrapper result for existing publication-security guards. The test-only
runner fix did not change app grants. The 8 November post-rollback snapshot
recorded 30 reports, 11 incidents, 63 media records and zero individually
published posts, with matching predeployment report/media fingerprints. This
is historical; the later pre-110 read-only preflight observed 32 reports, 11
incidents, 65 media records and zero individually published posts. Test users
and reports from rollback fixtures were removed; none remain persisted. The
post-110 source snapshot matches: 32 reports, 11 incidents, 65 media records and
zero individually published posts. Report fingerprint
`bc43a329089fb198ab441e142d8b96d9` and media fingerprint
`96a15ffc60210b98bd46a7951dc9b0c5` are unchanged from the fresh predeployment read.

Public sharing choices now appear only during submission, as the last review
timeline section. Name/profile picture share one control; exact incident
location has another. The owner requested removal of the sharing editor from
both Your contributions and marker-opened details. The owner preference RPC
remains, but there is no post-submission editing UI at present.

### Owner amendment — authoritative report text (8 November 2026)

Resident public title and description must match the submitted source exactly.
Officials see the original source in a compact, expandable read-only card during
confirmation, linking, findings and publication review. The new
`20261110000000_resident_report_text_integrity.sql` migration freezes resident
title, description, reporter and intake provenance; publication derives from
the stored report, mismatched publish overrides are rejected, hiding ignores
stale text, and existing publication rows are not rewritten. The migration and
updated `create-official-report` Edge Function are deployed; hosted rollback,
parity, source-fingerprint and access checks pass.

The official review controls use short disclosure tiles, visible photo states,
full-size photo review with its safety checklist, and a brief acknowledgment.
Sensitive cases still require an internal reason, and review release now asks
for confirmation. The shared confirmation sheet has one vertical scroll owner;
the responder change is based on source inspection and is not yet device-
reproduced. Official field intake still allows an empty title; the new
transactional path stores a deterministic incident-type label as the official
source title before it derives the public post. Resident text is never
synthesized. Local validation passes: the 162-test npm suite, 799 SQL
assertions across 12 files (including 33 new source-integrity checks), Deno
check, web export and real local media harness. The new migration and Edge
Function are deployed. Hosted rollback checks pass with 70 TAP results across
three files, including 33 new integrity checks, 36 atomic checks and the wrapper
for 50 security guards. All 19 function definitions, constraints, trigger state
and permissions match local validation; function fingerprint
`cd2c5bd5fb17d823fdb61be672b059da`. Hosted CORS/auth-denial checks pass, and
the source snapshot is unchanged. Lint passes with two existing style warnings.
Physical-iPhone normal/enlarged-text acceptance,
R5, G1 and operational acceptance remain open.

## Historical deployment record — 7 November 2026 (partial implementation)

Migrations `20261106000000` and `20261107000000` and the updated `create-report`
Edge Function were deployed to the existing hosted project. Validation passed:
149 unit tests, TypeScript, ESLint/Deno lint, web export, and 50 rollback-only
security assertions against the deployed schema. Counts remained 29 reports,
11 incidents and 61 media records; no existing report opted in automatically.
Physical iPhone visual acceptance remains pending. This is the original hosted
baseline record. The later 8 November deployment is described above and does not
establish phone or operational acceptance.

### Test in Expo Go

1. Reload the app. Start a clearly labelled resident test report and reach Review.
   The final timeline section contains the optional public sharing controls.
2. Choose whether to share name/profile picture and exact incident location,
   then submit. Existing reports retain their previous protected defaults;
   there is no sharing editor in their details. Submission choices do not publish
   the report by themselves.
3. The responsible lead reviews the unchanged source text and evidence, then
   selects permitted identity/location disclosures and safe photos during
   confirmation, findings or an eligible link action. The selected source text
   and safe photos publish atomically with confirmation. Sensitive cases keep
   public text, detailed location and photos hidden; hotline intake remains
   unconfirmed and private.
4. As another resident, check Community, Home nearby and Map. The approved title
   and description should match. Identity and exact coordinates appear only when
   both owner choice and official approval permit them. Approximate points may
   still overlap; triangle markers do not represent geographic search circles.
5. Consent revocation/re-approval has backend assertion coverage, but its former
   detail-screen controls were removed. Do not tell phone testers to use them.
   Changing a profile name or picture clears its corresponding publication
   approval and must not expose the replacement without renewed review.

Legacy incident summaries remain visible until individual report posts represent
the case. Discussion and official updates remain incident-based. Original report
evidence remains private; only service-processed safe copies can be approved for
public display. Do not approve a photo with injured faces, children, house
numbers, vehicle plates, contact details, private notes or unnecessary personal
information.

Approved by the project owner on 7 November 2026. This supersedes the earlier
Phase 4 rule that every community post omits reporter attribution. Implementation
and hosted verification status must be recorded separately from this decision.

## Agreed behavior

- A resident report and an incident case remain separate records. Several
  reports can refer to one incident; incident status and official updates remain
  shared, while each public report keeps its own source title/description and
  reviewed disclosures.
- Residents control whether their identity/profile picture and exact submitted
  location may appear publicly. Sharing is off by default. Officials cannot
  override a resident's refusal to share either item.
- Existing reports receive no automatic opt-in. Their current protected public
  incident information can remain available; exposing additional personal
  information requires the owner's choice and an official publication review.
- Authorized officials continue to receive the original report, identity,
  location and evidence for their existing operational duties. Hiding identity
  publicly does not hide it from authorized responders.
- The confirmation step displays the unchanged source text, permitted
  identity/location choices and selected media review. Confirmation and
  eligible publication commit in one retry-safe action. Officials can withhold
  unsafe photos or choose sensitive/private handling. Never auto-copy
  unscreened attachments or let a public-copy editor replace resident text.
- Sensitive cases retain stricter protection. Names, pictures, free text and
  location must be assessed together because removing a name alone does not
  guarantee anonymity.
- Public media consists only of explicitly approved, safe derivatives. Original
  evidence remains private. Existing metadata-verification requirements are not
  waived by this change.
- Owner preference changes are supported by an owner-only RPC; revocation takes
  effect on fresh public reads and increased permissions require renewed review.
  Post-submission editing UI was intentionally removed at the owner's request;
  do not claim it is currently accessible in report details.

## Consistent screens

Home, Community and Map should use the same published report information.
Private report activity remains available to the owner in Your contributions
and their report details. Public readers receive the official incident updates.
Public discussion remains attached to the incident so linked reports do not
split the same incident's conversation.

Selected/highlighted resident Home and Map report markers use the same
status-colored triangle with an incident-type icon and a pulsing halo. The halo
marks selection, not distance, coverage or an incident extent. Approximate
locations must still be identified in details; the app must not invent separate
precise locations for rounded points.

## Acceptance checks

1. An old report retains protected identity/location with no owner action.
2. A new submission preserves sharing preferences through offline delivery.
3. Another resident cannot change the owner's preferences or read private data.
4. Officials cannot publish identity or exact coordinates beyond owner choices.
5. Confirmation without explicit publication review and acknowledgment cannot
   publish source text or photos; sensitive cases remain private.
6. Two reports linked to one incident remain distinct public posts, with shared
   status, official updates and discussion.
7. Revoking sharing removes the corresponding information on fresh public reads.
8. Sensitive status and withdrawn confirmation do not leak previously approved
   personal data through list, detail, media or notification paths.
9. Home and Map show matching status-colored markers; selected reports pulse,
   and long tags wrap without covering icons.
10. Existing incident notification links still open an appropriate public view.
