# Phase 4 — Hosted Expo Go test checklist

**Status update 8 November 2026: Phase 4 is deployed for controlled testing, but remains incomplete.** Migrations `20261108000000` and `20261109000000` and the `create-official-report` / `process-public-report-photo` functions are deployed. Screened publication is part of confirmation, field finding, eligible linking and official field intake; public photos use verified safe copies bound to each report.

Local validation passed: 158 unit tests, 766 SQL assertions, a separate 72-check resident cutover suite, SQL lint, TypeScript, ESLint/Deno lint, function-level Deno checks, Expo web export and the real Auth/Storage/Edge media harness. Hosted catalog/ACL, function parity, processor CORS, unauthenticated-function checks and 37 rollback-only TAP results pass. The runner fix was limited to test-role setup; no application grants changed. Test fixtures were rolled back, no test users/reports remain, and no existing posts were automatically published. The final post-rollback snapshot and fingerprints are unchanged.

Physical-iPhone normal/enlarged-text review, R5 compatibility acceptance and G1 operational approval remain pending. Do not report visual or phone acceptance from the web export or source review.

Earlier hosted baseline update, 7 November 2026: individual report publication and resident sharing controls were deployed. See the [sharing walkthrough](resident-publication-sharing.md#test-in-expo-go).

Deployment: 5 November 2026, hosted project `wkblsbtypaxvdgvkiopc`.
Migration: `20261105000100_resident_public_cutover.sql`.
This is owner-authorized controlled testing. Phone/R5 acceptance is not yet recorded.

## Open it on your iPhone

1. In the `mobile` folder, run `npm start -- --clear` (PowerShell: `npm.cmd start -- --clear`).
2. Keep your PC and iPhone on the same Wi-Fi and scan the Expo QR code with
   your iPhone Camera. Open it in Expo Go. For an already open project, reload it.
3. Sign in with your existing hosted resident/official accounts. No local Docker
   database, local accounts, environment change, TestFlight or app-store build is needed.
4. If old screens remain, fully close and reopen the project after restarting Metro.

The existing `.env` points to hosted Supabase. There is no `.env.local` override.
Start Metro before scanning. Rollback-only verification fixtures were used; no
test users, reports or response activities remain persisted from those checks.

## Quick visual check using existing data

| Where | What to do | Expected result |
| --- | --- | --- |
| Resident → Community | Open Community reports and a public incident | There are two tabs: Official updates and Community reports. Public posts show the published type/title, barangay, status, official updates, linked-report count and connected progress. There is no generic Resident report heading, green confirmation shield, or View on map action. Support/comments remain available; the source description remains private, and reporter identity appears only when owner consent and official approval both allow it. |
| Community → Official updates | Open the existing tab | Official announcements still load. |
| Map → Your contributions | Open your own submission | Only your submissions appear. You retain your title, description and evidence; the full owner-scoped detail loads with retry feedback. Status/outcome and activity timeline use the same recorded activity as map report details. The no-photo type tile is compact. Historical office entries may say the original office was not recorded; history is not fabricated. There is no extra My reports tab in Community. |
| Resident → Map | Open the original floating filters | The compact floating panel contains Community reports/status, Your contributions, Facilities and Evacuation centers. Toggle layers, collapse the panel and check enlarged text/landscape scrolling. No replacement filter bottom sheet or permanent Barangay incident list button appears. |
| Map → filters → without public map pins | Open the link when present | Only loaded no-coordinate public cases appear here. They are also available in Community reports. Approximate markers use rounded public coordinates and labels explain the precision; exact safety pins show their reason. Triangles do not mark search radii or incident extents. |
| Resident → Home | Use the nearby panel pager and arrow | The original map hero, compact status/title/location, official update block and connected timeline appear. Public map markers use status/type triangles; selected resident reports on Home and Map use a status-colored pulsing halo and are slightly larger. The halo indicates selection, not distance. Overlapping reports remain grouped and selectable. Map selection/pager changes the summary; the arrow opens the screened public detail. An empty panel can be correct when there are no matching nearby cases or location is unavailable. |
| Incident detail | Open a card, add a comment, reply, and use Support | Discussion/support belongs to the shared incident rather than a private source report. A report owner cannot comment on their own map report until it is officially confirmed. Support toggles on/off; comments persist after reopening. |

## Walk through a new controlled test

Use a report and evidence clearly identified as a controlled test. Two resident
accounts are useful for checking privacy; with one iPhone, sign out and switch
accounts between the steps. Use an official account responsible for the report's
barangay, or MDRRMO where the routing rules assign municipal responsibility.

| Step / where | Action | Expected result |
| --- | --- | --- |
| 1. Resident A → Report | Submit an in-coverage report with the required photo/video and location information | The delivery screen says Received after server acceptance. Map → Your contributions includes it. A pending report is not automatically a public incident. |
| 2. Resident B → Community / Map | Look for the new submission before confirmation | Resident B cannot open A's source report, title/description, exact pin or original evidence. A separate confirmed public incident must exist before public incident information appears. |
| 3. Responsible official → Reports → open the test report | Choose Take for review | Resident A sees review started and the responsible office in the timeline. Claiming does not confirm the incident. |
| 4. Official → Make a review decision | Inspect the source report and full-size photos. Enter screened public text, select only photos that pass the G1 checklist, then confirm in one action. | Confirmation and eligible publication complete together. A sees their own source submission and opens the shared incident. B sees only the report's screened public post and that post's verified safe photos. Original evidence remains private. Sensitive cases keep public text/location details/photos hidden. No response action is invented. |
| 5. Official → incident response | Record a qualifying response action for the test case | The public/resident status becomes Response ongoing. A reporter call, hotline contact, internal note or progress message alone does not qualify. |
| 6. Official → public progress | Post an official public update | Both residents see the public text on the incident. Internal notes/contact details stay private. Public progress is rate-limited to one update per ten minutes. |
| 7. Official → Resolve | Supply the required outcome and public summary | The incident becomes Resolved. The public summary appears in public detail and the reporter's outcome notice. |
| 8. Resident A → Notifications | Open a review, progress or resolution notification | It opens A's corresponding private report detail on Map. The timeline and outcome match the official action, including reports outside the loaded list. Public-incident notifications open Community discussion instead. |

After changing an incident, pull to refresh the community feed or reopen detail.
Public incident lists/detail also recheck approximately every 60 seconds while
focused/open. Do not treat a short refresh delay as a second action to submit.

## Public visibility checks

As the lead office, open a confirmed incident and choose **Public visibility**.

| Setting | Expected resident result |
| --- | --- |
| Approximate area | The map shows the coordinate-rounding cell and an approximate-location label. Shading represents location uncertainty, not incident extent or a barangay boundary. The old arbitrary 800-metre circle is gone. It does not reveal the private operational pin. |
| Barangay only | The incident stays in the list; no public map point is drawn. |
| Exact location for a safety message | A reason is required and an explicit confirmation is shown. The public pin and reason become visible. |
| Mark as sensitive | Public location becomes barangay-only and public photo approval is revoked. Sensitive cases cannot publish an exact safety pin. Removing sensitivity does not republish photos. |
| Show publicly on a photo | During confirmation, open each photo full size and screen it using the G1 checklist before selecting it. The lead's photo controls can prepare a verified safe copy, approve it, or revoke an existing approval. Residents receive only the report-owned safe display/thumbnail; original evidence stays private. |
| Review earlier comments | Source discussion stays private. Only an eligible top-level comment explicitly screened by the lead is copied into the incident discussion. |

## Advanced cases and limits

- **Linked reports:** link a second controlled submission to the confirmed incident.
  The public incident count increases and its public discussion is shared, while
  each source submission stays private to its reporter and authorized officials.
- **Transfer:** the resident timeline says the barangay remains responsible while
  MDRRMO acceptance is pending, then names MDRRMO after acceptance. A transfer
  request alone never means municipal acceptance or response ongoing.
- **Correction:** on the supported municipal finding path, a withdrawn confirmation
  needs public correction text. A non-sensitive correction remains on the map for
  seven days; its saved public link still explains it afterward. Sensitive withdrawn
  cases have no public page. Do not alter timestamps to accelerate this on hosted data.
- **Outside coverage:** if a genuine test location is outside coverage, it is not
  forwarded or automatically retried. The resident gets emergency contact guidance.
  The normal GPS pin-adjustment limit still applies; do not bypass it to force a phone test.
- **Mayor:** raw source reports and evidence are intentionally unavailable. Existing
  aggregate charts remain available. The Phase 5 oversight/request replacement UI
  has not been implemented by this deployment.

Record any failed step with the account role, screen, expected/actual result and
time. A successful reload alone is not a completed phone/R5 acceptance walkthrough.

## Deployment verification

- Migrations `20261108000000`, `20261109000000` and `20261110000000`, and both `create-official-report`
  and `process-public-report-photo` are deployed. Processor CORS preflight passes;
  both functions reject unauthenticated POSTs with HTTP 401.
- Hosted catalog/permission, trigger and text-constraint checks pass. The 19 checked
  function definitions match local fingerprint `cd2c5bd5fb17d823fdb61be672b059da`.
- Hosted source snapshot is unchanged: 32 reports, 11 incidents, 65 media records and zero
  individually published posts. Report fingerprint `bc43a329089fb198ab441e142d8b96d9`
  and media fingerprint `96a15ffc60210b98bd46a7951dc9b0c5` match predeployment. No
  persistent hosted test fixtures were created and no existing posts were auto-published.
- Hosted rollback-only assertions pass with 70 TAP results across three files:
  33 source-integrity checks, 36 atomic checks and one wrapper for 50 security guards.
  The runner setup correction is test-only (`SET LOCAL ROLE
  postgres`); application grants and hosted data were not changed.
- Local validation: 162 unit tests; 799 SQL assertions across 12 files; TypeScript;
  ESLint/Deno lint (two existing array-type style warnings); updated Edge Function
  Deno check; Expo web export; and the real
  Auth/Storage/Edge media harness all pass.
- Physical-iPhone and R5/G1 acceptance are still pending. Record those separately
  after the hosted walk-through; deployment and automated tests do not establish them.

## Compact review amendment — physical iPhone checks pending

These checks have not been performed on a physical iPhone. Record results with
normal and enlarged text, portrait and landscape, and the keyboard open/closed.

- Expand the original statement: the full title/description are readable and
  cannot be edited. Disclosure icons respect resident consent; photo visibility
  states and the review checkmark remain readable without clipped controls.
- Open a photo full-size. If loading fails, Retry remains available; successful
  retry enables selection without silently selecting the photo.
- Tap Confirm incident twice: the loaded form remains available. A failed review
  lookup offers Retry and recovers without an endless spinner.
- Drag from blank space, source cards and multiline notes to reach the bottom of
  the sheet. Check scrolling while editing and after dismissing the keyboard.
- Tap Release, then Cancel: the current claim remains. Only confirming Release
  returns the review to the office queue.
