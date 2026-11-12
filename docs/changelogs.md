# DisasterLink Change Log and Delivery Notes

## 8 November 2026 — Confirmation and safe-photo implementation and deployment

- Integrated screened public text, disclosure choices and eligible photo
  selection into the retry-safe confirmation, field-finding, lead-owned link and
  on-site official-intake transactions. Hotline intake remains unconfirmed and
  does not auto-publish.
- Added strict JPEG metadata stripping, service-owned immutable public display
  and thumbnail copies, proof-bound publication checks, and per-report public
  photo projections. Source evidence remains private.
- Added paired public-photo delivery with short signing cache, partial-signing
  errors, stable photo identity, and revocation-aware detail refresh.
- Deployed migrations `20261108000000` and `20261109000000`, plus the
  `create-official-report` and `process-public-report-photo` Edge Functions.
  No persistent hosted test fixtures were created and existing reports were not
  automatically published.
- Local verification passed: 158 unit tests, 766 SQL assertions and a separate
  72-check resident cutover suite, SQL lint, TypeScript, ESLint/Deno lint,
  per-function Deno checks, Expo web export and the real Auth/Storage/Edge media
  harness. Four ESLint array-type style warnings remain; no lint errors remain.
- The media harness covered concurrent confirmation replay, per-report photo
  isolation, official intake photo/retry, unchanged-file reupload, JPEG metadata
  stripping, original-file privacy, immutable copies, reprocessing revocation,
  and hiding/replay behavior. Hosted catalog/ACL, CORS/auth, 17-function parity,
  37 rollback-only TAP results and unchanged post-rollback fingerprints pass.
  No persistent test users/reports remain; no existing posts were auto-published.
- Restored status-colored selection halos and a slight size increase for selected
  resident Home/Map report markers in `components/map/InteractiveMap.tsx`. The
  own-report comment guard in `components/map/ReportMapDetailSheet.tsx` keeps
  discussion closed until official confirmation. `ResidentReportProgress.tsx`
  and `ResidentReportPreviewSheet.tsx` both reuse `ReportStatusTimeline` with
  `useStatusProgressColors` for the connected progress timeline on Home and Map.
- `ReportPublicationFields.tsx` and `ScreenablePhotoPreview.tsx` share the full-size
  G1 review modal, including loading/error/retry states. `publicPhotoPairs.ts` and
  `mediaUrlCache.ts` keep each display beside its matching thumbnail, require
  explicit returned paths for public signing, and fail closed on missing URLs.
  The selected halo denotes selection, not geography. ESLint reports four
  array-type style warnings and no errors.
- Hosted report/media snapshot remains 30 reports, 11 incidents, 63 media and
  zero individually published posts; fingerprints match before deployment.
  Physical iPhone normal/enlarged text, R5 and G1 acceptance remain pending.
- Review: Sol High. Implementation: Luna Max. Astra attribution below belongs to
  its dated historical work and is unchanged.
- Updated the Phase 4 handoff, sharing record, marker note and phone checklist
  to distinguish the deployed 8 November implementation from the 7 November
  baseline and from pending phone/operational acceptance.

## 8 November 2026 — Historical Phase 4 status documentation audit

- At that audit checkpoint, marked Phase 4 **partially implemented** and listed
  confirmation integration, metadata-safe photo processing, per-report media
  delivery and iPhone/R5 acceptance as remaining. The first three items were
  subsequently implemented and deployed in the entry above; acceptance remains
  pending.
- Recorded the current submission-only, two-control public visibility UI and
  removal of the owner editor from contribution and marker details. Corrected
  the companion sharing walkthrough and added a current-status notice to the
  phone checklist.
- Preserved dated deployment/test records as history and distinguished automated
  validation from physical-device/operational acceptance. This documentation-only
  audit did not itself complete any application feature.

## 5 November 2026 — Resident UI restoration after Phase 4 review

- Restored the original Home map/pager, compact summary, accent update block and
  connected timeline. Public records supply the content; private reporter text,
  identity and original evidence stay private.
- Community has the original Official updates and Community reports tabs.
  Removed the duplicate Incidents and My reports destinations. Private reports
  remain in Map → Your contributions; report notifications now open Map detail,
  with an owner-scoped fallback for reports outside the loaded list.
- Restored the original floating map filters. The no-pin public list is available
  inside the filter panel instead of a permanent floating list button. Corrected
  the public-incident map search icon and removed obsolete filter-sheet styles.
- Removed the arbitrary 800-metre location circles. Shading now shows the actual
  public coordinate-rounding cell, with copy distinguishing uncertainty from
  incident extent or barangay boundaries. Barangay names come from the database.
- Public map data now uses the same startup buffering as original report pins,
  avoiding dropped areas when iOS delivers data before Leaflet initialization.
- Reused Home/feed styles, theme tokens, map switches and connected timeline.
  Shared public labels/status options and fact-derived progress are reused across
  the affected screens. No new backend migration or hosted data write.
- See [the UI audit](phase4-resident-ui-audit.md) for findings, remaining phone
  checks, affected files and the assessed Minglanilla-only map options.
- Validation: all 145 unit tests, TypeScript, full ESLint/Deno lint and Expo web
  export pass. Automated visual inspection did not complete because computer
  access approval timed out; physical iPhone acceptance remains pending.

## 5 November 2026 — Phase 4 hosted deployment for Expo Go testing

- The owner explicitly requested using hosted Supabase for Phase 4 on the physical
  iPhone through Expo Go. Confirmed the linked project and existing `.env` target
  `wkblsbtypaxvdgvkiopc`; no local environment override exists. The dry run showed
  exactly one pending migration, `20261105000100_resident_public_cutover.sql`.
  It is now applied. No Edge Function deployment or environment change was needed.
- All 13 hosted catalog/grant/RLS checks pass. Read-only role checks using the
  existing active residents, officials and Mayor pass, including public RPCs,
  owner-only timelines, denied foreign source/original reads and preserved Mayor
  aggregate charts. No test users, reports or activities were created.
- The 19 checked function definitions match the tested local fingerprint
  `dd265846275cc59dcbcdf3f1377fb537`. Final hosted migration dry run is up to date.
- Before/after counts are unchanged: 29 reports, 11 incident cases, 61 media
  records, 2 support requests, 32 incident events, 91 history rows, 23 notifications,
  17 source comments and 6 source upvotes. Report/incident/evidence-content hashes
  are identical. Existing photo approvals were zero; new publication stays disabled.
- Added `docs/phase4-expo-go-test-checklist.md` with exact screens, expected
  outcomes, a two-resident/official walkthrough and advanced privacy/routing cases.
  Updated the plan, schema/deployment record and install inventory to distinguish
  hosted controlled testing from pending physical-phone/R5/G1 acceptance.
- No app code or reusable UI was changed for deployment. Restart Metro with
  `npm start -- --clear`, scan the QR in Expo Go, and use existing hosted accounts.

## 5 November 2026 — Phase 4 resident/public cutover (local only)

- Implemented T26–T30 from `report-response-flow-plan.md`. Resident source reports,
  titles/descriptions, original media, GPS, internal notes and report discussion
  remain private. Public incident RPCs expose the agreed category, public updates,
  report count and screened derivative paths. Mayor raw report/evidence reads are
  closed; existing role-checked aggregate charts remain usable.
- Community has separate Incidents, Official updates and My reports tabs. Home
  and the resident map use public incident records; rounded locations render as
  labelled 800 m areas, safety exceptions show their exact-location reason, and
  barangay-only incidents remain in the list. Public corrections keep map markers
  for seven days and non-sensitive saved links afterward.
- Added reusable `PublicIncidentCard`, `PublicIncidentDetail`,
  `ResidentReportProgress`, `ResidentReportTimeline`, `ReportOutcomeNotice`,
  `OutsideCoverageNotice` and official publication/discussion-screening controls.
  Existing comments hooks, bottom sheets, lifecycle helpers, tokens and hotline
  utilities are reused. UI/UX implementation and review used GPT-6 Astra Medium.
- Public discussion/support is incident-based. Unscreened legacy source comments
  stay private; the lead can explicitly screen/copy eligible top-level bodies.
  Source-comment IDs are excluded by column grants. Office responsibility is
  stored beside audit payloads so response retry/idempotency behavior is unchanged.
- Outside-coverage failures show emergency contacts, cannot retry, and do not
  create a report pin or navigate to a nonexistent server row. Notification routes
  accept validated report/incident IDs and fetch an owner's requested submission
  even outside the first page. Unknown entities safely stay in the inbox.
- T27's metadata precheck remains closed: server validation currently proves
  file size/MIME rather than stripped location metadata. New photo approvals are
  disabled in SQL and UI; existing approvals are revoked on cutover. Revocation,
  sensitivity and justified public-location settings are implemented.
- Files: resident feed/home/map; report, map, official-publication and notification
  components; `lib/reports.ts`, `lib/publicIncidents.ts`, `lib/incidentCases.ts`,
  comments/notification/error/queue helpers and related hooks; one migration,
  privacy/transition/client tests, package test script, plan/schema/install records.
- Validation: 708 local pgTAP assertions pass; public-schema SQL lint is clean.
  TypeScript, ESLint/Deno lint and Expo web export pass. Unit suite: 141 tests.
  Migration `20261105000100_resident_public_cutover.sql` is local only. Hosted
  deployment, authenticated visual/physical-iPhone acceptance and R5/G1 release
  evidence remain pending. No release approval or version-gate enforcement was
  recorded; Phase 5 Mayor replacements remain separate work.

## 5 November 2026 — Simplified urgent-help indicator

- Removed the opening/closing chevron from `UrgentDangerCard`. The phone icon,
  label, tap target, accessible expansion state, and hotline behavior remain.

## 5 November 2026 — Optional specific service units

- Removed the unnecessary requirement to name a specific station/office/unit
  for every manual service entry. A known service category and municipality
  now suffice. Add specific unit (optional) reveals the extra field only when
  wanted; existing named entries reveal it when edited. Clearing it omits the
  optional field instead of sending an invalid empty value.
- Duplicate category/unit/municipality identities are still blocked. Repeating
  a generic service in the same municipality opens the optional unit field with
  a clear request to distinguish that entry or edit the existing one. Different
  municipalities and specifically named units remain valid.
- Other service retains a required service-name field, separate from an optional
  specific unit. Other names participate in duplicate matching so, for example,
  a road crew and a coastal assistance team in one town are not mistaken for
  duplicates. Service labels retain category, named Other provider, optional
  unit, and municipality without losing or fabricating provider information.
- Added `20261105000000_optional_response_service_unit.sql` to relax the internal
  validator consistently. Grouped entries require a municipality; legacy single
  entries remain compatible. A provided unit still requires a municipality.
  Existing named payload normalization remains unchanged for safe retries.
  Atomic grouped saves, confirmation requirements, privacy, authorization, RLS,
  and submission retry protection are preserved.
- Files: `ResponseEventSheet.tsx`, `lib/reportContactFlow.ts`, activity tests,
  the new validator migration and `optional_response_service_unit.sql`, plus
  one obsolete strict-unit assertion fixture in the prior grouped SQL suite.
  Reused the existing optional-row, input, and identity-helper patterns.
- Validation: all 133 unit tests, TypeScript, and full lint pass. All 636 local
  pgTAP assertions pass, including 44 new optional-unit checks; public-schema
  lint has no errors. Six new form tests cover routine unnamed entries, duplicate
  differentiation, external municipalities, clearing a unit, and named Other
  services. Physical-phone visual acceptance remains pending.
- Deployment: dry run listed only the new migration, with no seeds or roles;
  it was applied to the existing hosted project `wkblsbtypaxvdgvkiopc` for Expo Go
  testing. A read-only hosted validator check accepts a grouped PNP/Minglanilla
  entry with no unit name. Internal validator execution remains unavailable to
  authenticated clients. The check creates no activity/history records.
- Retest: reload Expo Go, select PNP, enter the municipality and ordinary
  activity evidence, and save without opening Add specific unit. Then repeat
  that category/municipality in one grouped activity to check the differentiator
  prompt. Test a different municipality and two different named Other services.

## 5 November 2026 — Clear service categories and provider labels

- Fixed the display that made a specific unit name appear to replace its
  selected category. Service summaries now keep the category first, followed
  by the station/office/unit and municipality, for example PNP · station name ·
  municipality. An identical category/unit label is not repeated.
- Renamed the input to Specific station, office, or unit. Queued service rows,
  edit/remove descriptions, and grouped history share the same provider-label
  helper. Grouped details omit the redundant category line because the heading
  now contains it. Stored categories, provider identities, confirmations,
  grouping, and permissions are unchanged; no backend deployment is required.
- Files: `lib/reportContactFlow.ts`, `ResponseEventSheet.tsx`, `WorkflowForm.tsx`,
  existing activity tests, and these notes. Reused the shared provider label
  rather than adding another formatting path. The 42 focused activity/contact
  tests, TypeScript checking, and affected-file lint pass; phone visual acceptance
  remains pending.

## 4 November 2026 — Named service providers and one grouped activity

- Corrected the earlier per-service save design after the owner's review.
  Manual service entries now identify the actual office/team/unit and its
  municipality/city. Names and municipality appear in queued entries and
  history. Case/spacing variants of the same category/team/municipality are
  rejected; the same service category from different towns or distinct units
  remains valid. Provider identity does not transfer incident leadership or
  grant an external municipality access to the case.
- One multi-service save now sends one authenticated RPC and creates one
  incident event, or one pre-incident contact-history entry, containing 1–20
  service entries. Each service retains its own outcome, confirmer/method,
  requested assistance, reference, and optional note as applicable. The database
  validates the entire payload before insertion. Failed saves preserve all
  drafts; the prior partial-success UI and per-service write loop were removed.
- Grouped submissions have a stable client submission ID scoped to the actor
  and target. Unchanged retries return the existing activity rather than
  inserting another. Reusing a committed ID for different content is rejected.
  This also works when a pending report's contact activity is copied into an
  incident during review. Existing authorization, lock order, active-state and
  public-update restrictions remain enforced. Nested groups, unknown fields,
  phone numbers, invalid confirmations, and duplicate provider identities fail.
- Existing single-service clients remain compatible; identity fields are an
  optional paired extension for their payloads. The new manual form requires
  identity explicitly. A native hotline call follow-up remains tied to the
  actual saved contact and does not invent a municipality. Single-line identity
  inputs reduce form bulk. History shows one activity with service sub-sections.
  Earlier separate events are retained; no speculative grouping/backfill alters
  the existing audit trail.
- Astra Medium moved Urgent help immediately below the report status tags,
  above call follow-up and the main timeline. A compact tinted phone action
  exposes the existing scoped hotline directory with loading/error/empty states.
  Pending-call locks, saved-number dialing, explicit outcome logging, and the
  single current-stage Record activity entry are preserved.
- Files: `ResponseEventSheet`, `WorkflowForm`, `UrgentDangerCard`, operations
  screen/styles, `lib/reportContactFlow.ts`, typed event clients, unit tests,
  plus `20261104000000_grouped_response_services.sql` and its pgTAP regression
  file. Reused the existing RPCs and history component; added shared provider
  label/identity and grouped-payload types.
- Validation: 127 unit tests, TypeScript, and full lint pass. The new database
  suite passes 79 assertions; all 592 local pgTAP assertions pass, and local
  public-schema lint reports no errors. Existing Docker Desktop/local stack was
  started without a database reset. Phone visual/native acceptance remains
  pending.
- Deployment: the linked dry run listed only the new migration, with no seeds
  or roles. It was applied to `wkblsbtypaxvdgvkiopc` for the owner's existing
  controlled Expo Go testing. Read-only hosted checks confirm the grouped
  validator, both unique submission indexes, and RLS on the audited tables.
  Counts remained 29 reports, 11 cases, 32 incident events, 91 report history
  entries, and 23 notifications. No synthetic hosted activities were created.
- Retest: reload Expo Go, record a dispatch for an identified local rescue unit,
  Add another service, then enter a rescue unit from another municipality with
  its own confirmer/method. Save once and verify one history activity containing
  both providers. Try an exact duplicate, then a differently named unit in the
  same town. Check draft edit/removal and retry behavior, and open Urgent help
  from its new position. Existing operational sign-off gates remain pending.

## 4 November 2026 — Consistent and expressive history presentation

- A second Astra Medium UI agent refined incident and report history together
  through the existing shared `WorkflowHistoryRow`. Text now uses one consistent
  base size for titles, metadata, detail labels/values, public text, and notes;
  weight, color, and grouping provide hierarchy instead of mixed text sizes.
- History entries use restrained rounded surfaces, event icons, and subtle
  theme accents to make dense operational information easier to scan. The same
  presentation applies to recent entries and the full-history sheets. Actual
  actor/office metadata, readable timestamps, allowlisted details, and complete
  notes remain available.
- Files: `components/official/WorkflowForm.tsx`, shared operation styles,
  `app/official/[id].tsx`, and `IncidentCasePanel.tsx`. Callers pass the recorded
  event type for presentation; no lifecycle, audit, access, publication, or
  backend behavior changes are introduced.
- Blue review/contact markers, muted purple coordination markers, and warm
  response markers add variety using existing theme colors and faint tinted
  surfaces. Icons describe the recorded activity rather than implying success.
- Validation: TypeScript and lint for all four affected UI files pass. No new
  tests were added for this presentation-only pass. Reload Expo Go and compare
  recent/full report and incident histories, including long notes and larger
  device text sizes; physical-phone visual acceptance remains pending.

## 4 November 2026 — Activity groups, draft removal, and recent history

- Astra Medium refined the shared sheet/history presentation. Record activity
  opts into a steady viewport-relative sheet height with internal scrolling and
  existing keyboard avoidance. Other sheets retain their existing sizing unless
  explicitly opted in. Inline actions such as Change activity, Keep current
  activity, Add a note, and the service selector no longer show navigation arrows.
- The activity chooser now has Contact & requests, Response actions, and Notes
  & information groups, filtered by the existing report/incident event vocabulary.
  Only the selected group's actions are shown. A known service collapses to a
  summary after selection; Other keeps its required name field visible. Outcomes
  and confirmation methods use compact choices. Existing saved values and RPC
  permissions are unchanged.
- Unsaved queued services have a clearly labeled trash control and a removal
  confirmation. Removing an entry being edited restores the separate current
  draft. Saved audit entries have no delete control. Removal and confirmation
  handlers are guarded during submission; removing a failed draft does not
  delete or repeat successful audit writes.
- Incident and report history now show the latest three recorded entries
  directly, newest first, with a full-history action instead of a disclosure
  containing only another history button. Added reusable `WorkflowHistoryRow`
  with compact spacing, human timestamps, actor, actual recorded incident office,
  allowlisted details, and full notes/public text in the detailed view. Source
  report and support/transfer history remain available. Missing report-office
  metadata is not fabricated.
- Files: `ResponseEventSheet`, `WorkflowForm`, `ResourceFormSheet`,
  `IncidentCasePanel`, `app/official/[id].tsx`, operation styles, activity tests,
  and delivery notes. New shared presentation contracts are `showChevron`,
  `stableHeight`, and `WorkflowHistoryRow`; no new backend deployment is needed.
- Clarified the mayor question in the public-communication review: the Mayor can
  already publish community announcements, but selecting logged incident updates
  for mayor/PIO approval and publication is not an implemented queue. This pass
  does not add that workflow or expose private logs for publication.
- Validation: all 123 unit tests, TypeScript checking, and full lint pass.
  Four new service-removal regressions cover confirmation, editing/restored
  drafts, partial-save immutability, and in-flight guards. Call-hook, lifecycle,
  incident-client, and response-event SQL hashes remain unchanged. Physical-phone
  sheet sizing, scrolling, and history visual acceptance remain pending.
- Retest in Expo Go: choose an activity group; select/change services and open
  notes while checking that the sheet top stays steady and the content scrolls;
  remove an unsaved service (cancel and confirm); remove an entry being edited;
  inspect recent history and its full view. Also retry a partial save to confirm
  that successful services remain immutable and unsaved drafts remain manageable.

## 4 November 2026 — Operation highlights, service editing, and publication review

- Astra Medium refined the shared operation controls. Current stages now have
  a soft highlight and outlined marker. Choices use familiar activity/service
  icons and app-theme accents, plus labels and selected checkmarks; these are
  operational cues, not claims about official agency branding. Text keeps the
  established dark colors. Success toasts now last five seconds by default,
  respecting reduced motion and Android's longer accessibility timeout.
- Public progress now has one sheet title and the short factual-update hint.
  Genuine disabled reasons and errors remain visible. Sheet/picker close
  controls use a compact right gutter and nonshrinking 44px touch targets;
  toast/inline success dismissal uses the same trailing alignment. The media
  viewer's existing top-right close control remains in place.
- `ResponseEventSheet` shows colored activity icons, compact queued service
  rows (Edit service + confirmation/method/outcome subtitle), and a distinct
  editing banner with Apply service changes and Cancel edit. Editing keeps
  the queued original until applied, preserves any separate in-progress draft,
  and performs no audit write until the save action. Confirmed saved services
  remain read-only; failed service entries are identified for edit/retry.
- Blocked activity fields now have individual errors and red borders. Client
  validation mirrors the server's existing phone-number restriction so errors
  can point to the field; server enforcement remains authoritative. Unnecessary
  dispatch/general instruction paragraphs were removed. The reporter-call
  dismissal hint remains because closing that specific form records the planned
  not-recorded outcome. Activity-choice cancellation preserves entered evidence.
- Reusable additions extend `WorkflowNote`, `WorkflowChoices`, and
  `WorkflowActionRow` with optional field-error and semantic appearance props.
  Existing callers gain service/outcome/coordination cues without changing their
  stored values or permissions. Related styles, the safe preview, and focused
  activity regression coverage were updated.
- The same existing required-note/reason/correction guards in review and case
  forms now identify the blocked field. Resolution labels explicitly mark its
  two required fields. General server failures remain persistent and use the
  shared error color; no validation requirement or permission was changed.
- Reviewed the mayor/Facebook question separately in
  [public-communication-workflow-review.md](public-communication-workflow-review.md).
  The current direct lead-office publication permission is an operating
  assumption, not evidence of delegated LGU publishing authority. The proposed
  workflow preserves existing public channels and aligns any approval role with
  actual stakeholder decisions. No new approval step, role, Facebook sync, or
  backend deployment is included in these UI changes.
- Validation: all 119 unit tests pass, with seven new activity-form regressions
  for field errors, applying/cancelling edits, preserving separate drafts,
  failed-entry retry, chooser cancellation, and phone-field privacy errors.
  TypeScript and lint checks pass; on-device color, spacing, and motion
  acceptance remain pending. Retest an empty dispatch form, two queued services,
  an edit and cancel/apply cycle, a partial save, public progress, and the
  five-second toast after reloading Expo Go.

## 4 November 2026 — Assessment, response, resolution, and service activities

- The owner's assessment-path test exposed that active case work had been
  hidden under Response & history. Astra Medium moved Field assessment,
  Incident response, and Resolution/Outcome into the same connected rail after
  Review decision. Finding, coordination, requests, public updates, permitted
  resolution, legacy summaries, and reopening are available in their relevant
  stages. Direct confirmation does not invent an assessment stage. Current
  stages remain expanded; incident and report history remain optional utilities.
- Assessment is current while verification or a required municipal finding is
  pending, consistently for lead and supporting viewers. Supporting officers
  see the responsible lead; only existing allowed actions expose mutations.
  Confirmation alone does not label response ongoing, and dispatch/contact do
  not verify the incident. Existing resolution checks remain authoritative:
  confirmed active incident, lead office, municipal finding where required,
  no open coordination request, and outcome note/public summary. No new
  response-event prerequisite was added. Retained corrections stay visible
  after reopening until the backend clears them following confirmation.
- Centered the persistent review-owner reminder, including wrapping at larger
  text sizes. One Record activity entry is visible under the current pending
  review, assessment, or response stage. Urgent directory calls stay separate
  without duplicating that activity entry.
- Added reusable `WorkflowToast`, following the existing notification overlay
  animation pattern. Save feedback slides down at the top center without moving
  the layout, dismisses after about three seconds, and retains an accessible
  close action. Repeated identical messages restart it. Timers/animations clean
  up; reduced motion and Android accessibility timeout preferences are honored.
  Errors and partial-save feedback remain in their forms. Reroute completion
  retains its dedicated persistent result and navigation.
- The activity composer supports several services in one session. Enter one
  service's details, choose Add another service, enter that service's own
  outcome/confirmation, then save. Fire, ambulance, police, rescue, and named
  other services (including road crews) keep separate authenticated audit
  events. Native directory call follow-up remains tied to the one number called;
  calls still use the saved hotline directory. No phone data is added to events.
- Services save through existing RPCs. Partial progress is explicit; retry in
  the open form skips entries with confirmed successful saves. Closing after
  partial success reports the saved count and discards only remaining drafts.
  There is no new batch transaction or backend deployment.
- Files: operations screen, `IncidentCasePanel`, `UrgentDangerCard`,
  `ResponseEventSheet`, shared operation styles, guarded fixture preview,
  `lib/reportContactFlow.ts`, and activity regression tests; added
  `components/official/WorkflowToast.tsx`. Astra completed the core UI work
  before reaching its usage limit; Sol completed integration and validation.
- Validation: all 112 unit tests pass, including eight new service-composer
  regressions covering distinct evidence/outcomes, incomplete details, partial
  retry/cancellation, duplicate taps, native-call scope, and service-name cleanup.
  TypeScript and full lint pass. Physical-phone layout/animation acceptance
  remains pending.
- Retest in Expo Go: reload, take a report for review, request field assessment,
  record a field finding, then confirm it. Check that each active stage and its
  Record activity entry remain visible in the rail. Log a multi-service dispatch
  with separate confirmers/methods; verify separate history entries. Resolve as
  the lead with no open request and a public outcome summary. Confirm the top
  toast does not move the page, closes automatically, and repeats on another
  successful save. Also check direct confirmation, supporting-office access,
  transfer/municipal finding, a not-confirmed assessment, and reopening.

## 1 November 2026 — Progressive review layout and visible evidence

- Astra Medium refined the pending-review layout after the owner's next review.
  Every current timeline step stays expanded without a disclosure control.
  Evidence & contact opens by default during pending review and opens again
  when the officer moves from taking responsibility to recording a decision;
  supporting evidence remains manually collapsible.
- The future Review decision step is hidden until the officer owns an actionable
  review. The rail ends at Evidence & contact before that point. Completed
  decisions remain available as context without a current-step marker. Response
  & history stays outside the decision timeline, and the pinned ownership
  reminder remains independent of dismissible feedback.
- Presentation goals: keep the required action visible, reduce premature choices
  and repeated instructions, and make the report evidence available without
  another discovery tap. These changes preserve call/contact authorization,
  review ownership, audits, and all backend behavior.
- Files: `app/official/[id].tsx`, `OperationTimelineStep`, `ReviewDecisionPanel`,
  and the guarded operations preview, plus the plan and delivery notes. The
  shared timeline presentation now handles current-step locking and evidence
  defaults consistently without adding a new workflow state.
- Completed decisions without further controls display a static outcome,
  avoiding an empty disclosure. Existing permitted reopening remains available.
- Validation: TypeScript and lint for all four changed UI files pass. Contact,
  lifecycle, call-hook, and response-event migration hashes remain unchanged.
  Phone visual acceptance is pending. Retest unclaimed, owned, colleague-owned,
  jurisdiction-check, and completed reports; verify current steps cannot close,
  evidence starts open and reopens on ownership, and future decision controls
  appear only when the review becomes actionable.

## 1 November 2026 — Decision timeline boundary and current step

- Following the owner's next review, Astra Medium separated Response & history
  from the decision timeline. The rail now ends at Review decision; urgent
  response actions, incident operations, and history remain accessible in a
  separate area with their existing permissions.
- Evidence & contact is supporting information, not a separately recorded
  lifecycle stage. Once an officer owns an actionable pending review, Review
  decision is the current step and stays expanded without a disclosure control.
  Unclaimed/colleague reviews and jurisdiction checks retain Review & routing
  focus. Completed reviews are not presented as a current pending decision.
- Modified the operations screen, reusable `OperationTimelineStep`, operation
  styles, and guarded preview. The pinned review-owner reminder is preserved.
  No backend, call, audit, or authorization behavior changes are required.
- Validation: all 104 existing unit tests, TypeScript checking, and lint for
  all four changed UI files pass. Native visual acceptance remains pending.
  In Expo Go, claim a pending report and check that Review decision stays open
  without a chevron, evidence can expand separately, and the rail ends before
  the independent Response & history area.

## 1 November 2026 — Report operations timeline refinement

- Astra Medium restored the connected timeline using the existing rail and
  marker design: Review & routing, Evidence & contact, Review decision, and
  Response & history. Expandable steps and flatter panels reduce competing
  cards and buttons. The current stage follows existing review/case facts.
- A compact, non-dismissible reminder above the scroll area says You are
  reviewing this report while the signed-in officer owns a pending review.
  Dismissible save feedback remains separate. The reminder follows refreshed
  ownership and review facts rather than a previous success message.
- Sol validated the deployed authorization rules with a read-only catalog
  query: decisions require the officer's own review claim. Reporter contact
  currently permits the authorized responsible office before claiming, or the
  incident lead/supporter after linking. Claim-before-contact is therefore not
  the current rule. This UI-only pass preserves those permissions and all call,
  audit, and backend behavior; no backend deployment is needed.
- Files: `app/official/[id].tsx`, the review, jurisdiction, urgent-response and
  incident panels, operation styles, and the guarded development preview.
  Added reusable `OperationTimelineStep` for the shared timeline presentation.
- Validation: all 104 existing unit tests, TypeScript checking, and full lint
  pass. Final screen lint also passes after the label corrections. Contact,
  lifecycle, call-hook, and response-event migration hashes match the start of
  this UI pass.
- On-device layout acceptance remains pending. Retest by reloading Expo Go:
  take a pending report for review, scroll while checking the pinned reminder,
  expand each ordered step, release/finish the review, and refresh to confirm
  that the reminder reflects the current owner and pending state.

## 1 November 2026 — Report operations flow and UI follow-up

- Addressed the owner's first physical-phone review of Phase 3. GPT-6.1 Sol
  High reviewed the call/audit/data flow and added regression coverage;
  GPT-6 Astra Medium refined the report-operations layout and interaction flow.
  Changes stay in the official operations feature and its shared picker/forms.
- `app/official/[id].tsx` now puts review, assigned-office routing, and urgent
  help before expandable evidence. Review decisions, coordination, findings,
  progress, outcomes, requests, and history use compact rows or focused sheets
  instead of showing every form and action at once. Existing theme tokens and
  permission rules are preserved. A successful BDRRMO reroute names the receiving
  office and offers Back to reports instead of showing an access-loss error.
- Added `hooks/useReportCallFlow.ts` and `lib/reportContactFlow.ts`. A reporter
  or directory-hotline call opens the native phone interface only; it never
  immediately opens the activity sheet. An inline follow-up lets the officer
  choose Record call outcome after returning, or No call made to clear the
  follow-up without inventing a call event. Reporter-number access remains
  audited by the existing secure RPC. Reporter numbers are never put in pending
  state, feedback, or activity details.
- The outcome form uses a static call-type heading rather than a clickable
  one-choice selector. Successful saves show clear reached/no-answer/failed or
  not-recorded feedback pinned above the operations scroll area so it remains
  visible after actions farther down the report. Closing an opened reporter
  outcome form retains the planned not_recorded audit, explicitly described in
  the form; it makes no claim that a call occurred. Unfinished notes are discarded
  on that dismissal for both pre-incident reports and incident targets. Generic
  activity/hotline cancellation does not invent reporter-call events. A save ref
  prevents duplicate audits from rapid taps, and errors keep the form open.
- Unified assistance, dispatch, contact, and response logging under one Record
  activity entry. Event types remain distinct so an assistance request is never
  treated as confirmed dispatch. Hotline selection reuses the scoped existing
  directory and saved phone number, then prefills the actual contact name in the
  outcome form without copying its phone into audit details or guessing agency.
- `ReportBarangayPicker` now presents its FlatList inside a native Modal, whose
  React Native implementation resets parent scroll-list context. This removes
  the same-orientation nesting cause while preserving shared picker props.
  Added readable local operation timestamps and explanatory empty-link copy:
  active confirmed/assessment cases, officer scope, 500 metres, last 24 hours.
  Separate pending reports are not link candidates until they become cases.
- Reusable additions: call-flow hook, call-feedback/hotline-prefill helpers,
  `formatOperationTimestamp`, compact workflow rows/chips/success feedback, and
  `styles/components/reportOperations.styles.ts`. Added a development-only
  `/dev/operations-preview` under the existing demo guard with local fixture
  callbacks; no preview action opens a real dialer or writes to Supabase.
- **Validation:** all 104 unit tests and TypeScript checking pass, including
  19 new call-flow/form tests for privacy, handoff, cancellation, double taps,
  explicit outcomes, errors, and date presentation. Full lint and Expo web export
  pass; the export is in `.expo/phase3-operations-web`. No backend migration or function deployment is
  required for these client changes; the hosted Phase 3 backend remains in place.
- **Visual QA limit:** the browser host was unavailable; Windows Computer Use
  then stopped because it could not reliably determine the current browser URL.
  No screenshot acceptance is claimed. The fixture preview server was stopped,
  no environment files or hosted data were changed, and native phone/picker
  behavior still needs the owner's on-device retest.
- **Retest:** restart Metro with `npm start -- --clear` and reload Expo Go. Check
  the compact initial screen; native call cancellation + No call made; explicit
  reached/unknown outcome feedback and history; directory hotline handoff;
  barangay list scrolling/rerouting; and one activity composer with distinct
  assistance/dispatch fields. For linking, create/keep one fresh active incident
  and review another nearby report in the same authorized scope.

## 31 October 2026 — Phase 3 backend deployed for Expo Go testing

- Owner explicitly requested deployment so the existing `npm start` + physical
  iPhone/Expo Go setup can manually test Phase 3 against hosted Supabase.
  This records authorization for the controlled test deployment; it does not
  record phone acceptance, stakeholder signatures, or operational release.
- Confirmed `.env` targets `wkblsbtypaxvdgvkiopc.supabase.co`. The linked-project
  dry run listed exactly the three Phase 3 migrations, with no seeds or roles.
  Applied `20261102000000`, `20261102000100`, and `20261102000200` to that project.
- Deployed only `create-report` with server-side bundling, including its shared
  coverage helper. It is now version **7**, **ACTIVE**, with JWT verification
  enabled. An unauthenticated POST returns **HTTP 401**. The already-deployed
  `create-official-report` remains version 6 and was not redeployed.
- All **13 hosted catalog/permission checks pass**: migration history, queue
  grants, service-only intake/routing, invoker map projection, appended lifecycle
  columns, device-GPS exclusion, operational-table RLS, closed-report privacy,
  supporter reads, authenticated-actor enforcement, edit-attribution cleanup,
  and release-policy enforcement remaining off for Expo Go.
- Hosted operational routine definitions match the tested local database:
  fingerprint `06d608b72ad5a749f20c4e680e856f2c`. Before/after reconciliation is
  identical: 27 reports, 9 incident cases, 2 support requests, 9 incident events,
  14 notifications, and 66 report-history rows. Report-status and incident-state
  fingerprints are unchanged. No hosted test reports or fake actions were added.
- The final migration dry run reports **up to date**, with no pending migrations.
  One temporary Supabase login-role network error on the final check was retried
  successfully. No app code or reusable UI changes were needed for deployment.
- **Manual testing:** stop Metro, run `npm start -- --clear`, scan the QR code or
  reload the project in Expo Go, and sign in with the relevant test accounts.
  Test a resident submission and BDRRMO claim/decision; a recorded hotline account;
  support versus transfer acceptance; municipal finding and response logging;
  resolution with a summary; and rejection privacy. Record actual results under
  the Phase 3 scenarios in the flow plan. Phone/visual acceptance, G1 signatures,
  manuscript alignment, and operational R5 acceptance remain pending.

## 31 October 2026 — Phase 3 official workflow implemented locally

- Implemented the report-response plan's T14–T25. GPT-6.1 Sol High handled
  implementation/data/security integration and GPT-6 Astra Medium handled the
  official UI/UX. Existing unrelated working-tree changes were retained.
- Added `lib/reportLifecycle.ts` and `lib/incidentCases.ts`; extended
  `lib/officialReports.ts`, `lib/officialReportSubmit.ts`, and
  `hooks/useOfficialReports.ts` with case facts, permission-derived actions,
  authenticated RPC writes, scoped event/support reads, paginated workflow
  queues, and realtime updates. A stale queue response cannot overwrite a more
  recent queue load. `closed` is recognized without treating it as pending.
- Updated the official detail, intake, reports, command dashboards, map, and
  corresponding components. Added claim/takeover/release and review decisions;
  jurisdiction/rerouting; explicit linking suggestions; call/dispatch logging;
  provisional findings; support and accepted transfers; progress updates;
  outcome summaries, resolution, reopening, and corrections. Calls are optional,
  and only recorded qualifying response actions produce Response ongoing.
- Reused `ResourceFormSheet`, the existing official styles, design tokens,
  barangay/location pickers, hotline helpers, and map components. New shared
  `WorkflowForm`, `WorkflowQueuePicker`, and `officialMapReports` helpers remove
  repeated form, event-detail, queue-chip, and map-adapter code. Optional map/tag
  presentation props preserve existing resident defaults.
- Applied three **local-only** migrations: `20261102000000` appends the
  `reports_map` lifecycle columns, implements queue filtering/counting before
  pagination, retains scoped BDRRMO/supporter reads, and adds service-only
  atomic jurisdiction intake plus centroid routing. `20261102000100` scopes
  trusted edit attribution to the edit and prevents BDRRMO content/location
  mutations after municipal acceptance while allowing normal workflow sync.
  `20261102000200` keeps closed unconfirmed reports private to their reporter
  and scoped officials, preventing rejection from publishing a hidden report.
- Updated `create-report` and added `_shared/report-coverage.ts`: outside
  coverage returns HTTP 422 with a code and hotline guidance; uncertain coverage
  is stored as needs_check. The offline queue persists final coverage rejections
  and skips their subsequent automatic/manual flush attempts. Other reports
  continue syncing, and network failures remain retryable.
- **Automated validation:** 85 unit tests pass, including all 22 lifecycle
  label rows, negative-label cases, current-response-period checks, coverage
  thresholds, and real queue-flush retry behavior. All 513 local pgTAP
  assertions pass (49 new Phase 3 assertions). The public-schema application SQL
  checker reports no errors. Expo web export succeeds to `.expo/phase3-web`.
  TypeScript and full lint both pass after the final integration edits.
- **Release/acceptance status:** no hosted migrations/functions or release-policy
  settings were changed. The hosted backend remains Phase 2. Authenticated
  visual/physical-phone acceptance and R5 checks are pending, alongside G1
  signatures and manuscript alignment. Use a development backend with all three new
  migrations and the updated `create-report` function for controlled testing.
  Phase 4 public/resident cutover and Phase 5 Mayor request actions remain
  deferred; the Phase 3 Mayor-requests queue is read-only context until T32.

## 30 October 2026 — Stakeholder review deferred until next week

- Owner requested deferral of the stakeholder meeting and G1 operating-rule
  approvals until next week; the exact meeting date is to be confirmed.
- Recorded the scheduling decision in `docs/verification-operating-rules.md`
  and `docs/report-response-flow-plan.md`. Approval/signature fields stay pending.
- Phase 2 remains deployed. Phase 3 implementation and controlled local testing
  may proceed while review is pending. Operational release still requires G1,
  aligned manuscript/flowchart wording, and R5 compatibility acceptance.
- Documentation-only update; no application or database changes.

## 30 October 2026 — Phase 2 report-response database foundation deployed

- Added migrations `20261101000000`–`20261101001200` for incident cases,
  review claims and decisions, jurisdiction/routing, response events, municipal
  support/transfer requests, Mayor update requests, photo approvals, sensitivity,
  compatibility synchronization, guarded writes, and deduplicated notifications.
  New operational tables have RLS and scoped officer reads; the Mayor and
  residents cannot select raw case/event rows. Existing report read scope remains
  unchanged in this phase.
- Added an idempotent legacy backfill. Historical escalations stay barangay-led
  until acceptance; historical re-verification keeps its finding/time and an
  explicit missing-acceptance label, with no invented accepted request. Legacy
  resolutions have no generated summary. Backfill notifications are suppressed.
- Updated `create-official-report` to validate `intakeChannel` and use the atomic
  service-only RPC. Omitted channels retain the old field-observation behavior;
  hotline accounts stay pending and require confirming evidence at review. Removed
  the non-atomic direct-write fallback. Existing screens are unchanged.
- Preserved the old transition RPC and both official-create call shapes. Kept
  the Mayor activity RPC at four status buckets until the later Mayor cutover.
  Shared internal SQL helpers handle text validation, authorization, audit events,
  compatibility status, and notification dedupe. No new shared UI code.
- **Validation:** all 464 local pgTAP assertions pass, including 174 new Phase 2
  assertions. The independent-session concurrent-review check passes and removes
  its random fixtures. All 42 unit tests, TypeScript checking, and lint pass.
  Supabase function lint for `public` reports no errors. The broad checker also
  lists existing PostGIS extension issues; application functions are clean.
- **Owner acceptance:** owner confirms Phase 1 phone checks and the existing
  official workflows have been tested and work. This confirmation preceded the
  hosted Phase 2 rollout below. Three real iOS `1.0.1` account check-ins are
  present. Individual foreground timestamp comparisons and web-specific tests
  are not claimed.
- **Hosted deployment:** applied all thirteen migrations to DisasterLink For
  Minglanilla (`wkblsbtypaxvdgvkiopc`), then deployed only
  `create-official-report` with server-side bundling. Function version 6 is ACTIVE
  with JWT verification enabled. A live unauthenticated POST returns HTTP 401.
  Follow-up migration dry run reports no pending changes.
- **Hosted verification:** sixteen catalog/backfill checks pass: new-table RLS,
  Realtime membership, anonymous denial, operational write denial, column-limited
  comment inserts, internal RPC denial, service-only intake, legacy wrapper,
  historical findings/summaries, no automatic photo approvals, and enforcement
  remaining off. The combined definitions for 62 Phase 2 routine names match the
  tested local database (`cff69197533b65bf3a47f5f9ad1ec552`). No hosted test
  fixtures, fake approvals, or synthetic version check-ins were inserted.
- **Backfill reconciliation:** all 27 report statuses are unchanged: 18
  unverified, 3 verified, 2 escalated, 4 resolved. Nine incident cases were
  created; 18 pending reports stay unlinked. Two legacy transfers stay requested,
  zero accepted requests were invented, five historical municipal findings keep
  their attribution/timestamps and explicit legacy-handoff labels, and four
  resolutions keep null public summaries. Notifications stay at 14 and history
  at 66, confirming no migration-generated alerts or status-change history.
- **Final backfill regression:** routed legacy reports authored by MDRRMO keep
  their verified status and barangay lead unless municipal handling was recorded.
  Authorship alone does not create a municipal finding or escalation.
- **R5 / release state:** local legacy transition/privacy regressions pass.
  Reopen Expo Go and repeat a test official workflow against the newly deployed
  backend to record the post-deployment phone smoke test. New Phase 3 screens
  remain unreleased pending G1/R5. The operating-rules document now explains how
  to obtain the actual dated BDRRMO/MDRRMO/adviser approvals and align the
  manuscript. Approval fields remain pending. No version enforcement was enabled.

## 30 October 2026 — Fix Phase 1 Expo Go startup crash

- **Cause:** `recordAppVersion()` used `await import('react-native')`. Metro's
  `importAll` reads the package's lazy export getters, producing unrelated
  deprecation warnings and loading `PushNotificationIOS`, whose missing native
  module crashes the iPhone's Expo Go session. The check-in catch could not
  reliably contain the native module-loader failure.
- **Fix:** `lib/appVersion.ts` now uses normal static imports for `Platform`,
  Expo Constants, and Supabase. Pure version/policy/deadline logic lives in
  `lib/appVersionPolicy.ts`, reused by runtime code and Node tests. Existing
  exports and the release policy behavior remain compatible.
- **Regression coverage:** `tests/appVersion.test.ts` exercises the actual
  installed Metro `importAll` implementation with native getter fixtures. The
  original import fails this test; the fix records `ios` / `1.0.1` without
  touching deprecated native getters. Additional cases cover web, signed-out
  users, unknown versions, and non-fatal RPC failures. All 42 unit tests,
  TypeScript checking, and lint pass. The iOS development bundle also exports
  successfully (2,290 modules) to ignored `.expo/phase1-runtime-check`; physical
  iPhone runtime acceptance still needs the reload described below.
- **Device retest:** restart Metro with `npm start -- --clear`, reload Expo Go,
  sign in, and return from background. Confirm the uncaught native-module error
  and check-in TypeError are gone and a real check-in appears in Supabase.
  `NumericKeyboardAccessory` still uses `InputAccessoryView`; that existing
  deprecation warning may remain and is separate from the fixed crash.
- **Deployment:** client JavaScript fix only; the hosted Phase 1 migration and
  disabled enforcement stay unchanged. No new native dependency or development
  build is required by this fix. Phase 2 follows device acceptance of Phase 1.

## 30 October 2026 — Phase 1 release safety deployed

- **R1:** `app.json` is project version `1.0.1`, Android version code `2`,
  iOS build number `2`. Increment all three for each release. Municipality-owned
  identifiers have not been supplied; placeholders remain development-only and
  must be replaced before wider standalone distribution.
- **R2:** `20261031000000_app_release_policy.sql` adds public read-only release
  policy and private version check-ins with RLS. The self-only RPC requires an
  active profile and validates platform/version. Clients, including app admins,
  cannot read check-ins or change policy. Minimum is `1.0.0`, latest `1.0.1`,
  enforcement off, download URL null on both platforms. Public emergency guidance
  initially includes national 911; add verified municipal contacts when ready.
- **R3:** reusable version/policy helpers, four-second fail-open deadline, and
  Update Required screen with emergency dialing, download error feedback, and
  retry loading feedback. Standalone native clients check at launch, foreground,
  and retry. Expo Go/development store clients and web cannot be blocked.
  Standalone startup retains the native splash until the initial bounded check
  finishes, so app screens cannot open ahead of an enforced policy.
  Native project versions check in at launch, foreground, and sign-in; failures
  never prevent use.
- **R4:** owner confirmed **Expo Go / development only; no standalone builds
  shared** on 30 October 2026. See [install inventory](app-install-inventory.md).
  Keep enforcement off for this setup. A check-in is only an account's most
  recent platform/version, not a device inventory or proof an old device retired.
- **R5:** compatibility evidence and pending device checks are recorded below.
  No report lifecycle status or transition changed.
- **G1:** [operating rules](verification-operating-rules.md) and scope wording in
  `docs/context.md` now align. BDRRMO/MDRRMO/adviser signatures remain pending.
  The actual manuscript is absent from this repository; matching manuscript and
  flowchart edits remain a sign-off prerequisite. Existing DOCX planning/research
  artifacts were not rewritten.
- **Validation:** 39 unit tests, TypeScript checking, lint, and 290 local database
  assertions pass, including 38 release-policy assertions. An iOS production
  bundle exported successfully to ignored `.expo/phase1-ios-check` (2,158 modules).
  This verifies bundling, not native screen/device acceptance. The migration is
  applied to local and hosted Supabase. Device acceptance was pending at the
  initial deployment; the owner subsequently confirmed Phase 1 phone checks
  passed, as recorded in the Phase 2 deployment entry above.
  Phase 3 still requires G1 signatures and R5 acceptance.

Hosted deployment (30 October 2026): applied only
`20261031000000_app_release_policy.sql` to **DisasterLink For Minglanilla**
(`wkblsbtypaxvdgvkiopc`). The installed CLI encountered transport errors;
temporary `npx supabase@2.75.0` connected successfully without changing project
dependencies. A dry run before deployment listed only this migration, and a
follow-up dry run reports the remote database is up to date.

Read-only verification passed: 12 checks against a hosted schema-only snapshot
confirm both tables' RLS, public SELECT-only policy access, no client grants or
read policies on version check-ins, restricted RPC execution, the empty search
path/security definer, timestamp trigger, and the exact tested RPC body. An
anonymous API read returns both policies at minimum `1.0.0`, latest `1.0.1`,
`enforce = false`, `download_url = null`; anonymous check-in-table reads return
HTTP 401 / SQLSTATE `42501`. No production fixture data or synthetic check-ins
were inserted. Reload Expo Go and sign in, then confirm a real `ios` / `1.0.1`
check-in and that foregrounding advances `last_seen_at`.

### R5 compatibility record — Phase 1

Prepared 30 October 2026 against the unchanged four-status lifecycle plus local
release policy. Repeat for each phase. Pending means the scenario has not been
executed on that client, even where database tests exist. No production fixtures
were created. Subsequent owner confirmation on 30 October 2026 establishes
Phase 1 phone acceptance and successful existing official workflows. That
confirmation preceded the hosted Phase 2 deployment; post-deployment phone
acceptance is recorded separately. Granular scenarios not included in that
confirmation remain pending below.

| Check | Physical iPhone / Expo Go | Web if used | Standalone 1.0.0 | Automated / code evidence |
| --- | --- | --- | --- | --- |
| Login | Owner confirmed Phase 1 phone acceptance | Pending | N/A: none shared | Auth paths unchanged; check-in deferred past auth callback |
| Resident submit | Owner confirmed Phase 1 phone checks | Pending | N/A | Intake, media rules, and queue unchanged |
| Map/feed, including hidden unverified rows | Map/feed phone checks owner-confirmed; hidden-row display not separately recorded for Phase 1 | Pending | N/A | Privacy RLS suite passes; Phase 0 category fallback retained |
| Official queue | Owner confirmed existing official workflows | Pending | N/A | Existing scope tests pass |
| BDRRMO verify / escalate / local resolve | Owner confirmed existing official workflows | Pending | N/A | Existing legacy RPC permission tests pass; no T11 wrapper in Phase 1 |
| MDRRMO re-verify / resolve | Owner confirmed existing official workflows | Pending | N/A | Existing legacy RPC tests pass; transitions unchanged in Phase 1 |
| `closed` on an unaware client | Future-phase fixture/device check | Future-phase check | None reported | Not added in Phase 1; source confirms misleading old fallbacks (F7). No production fixture |
| Unknown notification type | Pending rendering | Pending rendering | N/A | `NotificationMailContent` has a generic icon and supplied title/body fallback |
| Hidden report: empty list / direct link without crash | Pending | Pending | N/A | Database read denial passes; UI still needs acceptance |
| Update gate exempt | Owner confirmed Phase 1 phone checks | Pending browser acceptance | N/A | Runtime/platform exemption unit tests pass |
| Offline / missing / malformed policy | Pending native acceptance when a build exists | Exempt | N/A | Policy predicates and timeout/abort unit tests pass |
| Required update / download / dial / retry | Exempt: must never block Expo Go | Exempt | Future standalone test | Predicate/permission tests pass; screen and same-package install need device testing |
| Version check-in at launch / sign-in / foreground | Three real iOS 1.0.1 check-ins verified; individual foreground timestamp comparison not recorded | Exempt | N/A | Local tests cover self-only upsert, input, suspended/incomplete users, and denied client reads/writes; hosted RPC definition/grants verified |

No ungated standalone install is reported, so no compatibility exception is
needed today. Recheck the inventory before each lifecycle rollout.

The following runbook is copied from section 5 of the report response flow plan.
R1–R5, F7, and S5 refer to that plan. The inventory adds the owner's 30 October
confirmation that no standalone builds were shared.

### Release and update-availability runbook

#### What is installed today (Q7)

| Channel | Evidence in this repository | What an update would mean |
| --- | --- | --- |
| Expo Go on a physical iPhone | Confirmed by you. This is the known test client. | Restart or reload the current project. There is no native store update and no `download_url` to show. |
| Web | Expo web export exists in the repo | Reload the site. The native gate does not apply. |
| Standalone iOS/Android `1.0.0` | **Not found.** No `eas.json`, no `expo-updates`, placeholder `com.yourcompany.disasterlink` | If any such build was shared outside this repo, it **cannot receive the new version gate** until a replacement is installed over the same package ID. Record it in the R4 inventory before enforcing anything. |

Do not enable `enforce = true` for Expo Go. The Update Required screen would send the tester to a store page that does not exist.

#### When a standalone build exists and can actually be updated

You may only set `enforce = true` after **all** of these steps are done and recorded:

1. Replace the placeholder package ID (R1) if this will be a distributed standalone app.
2. Bump `version`, `versionCode`, and `buildNumber`, then produce the standalone build.
3. Publish it to the real channel (TestFlight, Play internal track, or a documented sideload URL).
4. On a device that already has the **old standalone** app, open `download_url`, install the update, and confirm it replaces the old app (same package ID, session kept).
5. Confirm `getInstalledAppVersion()` matches `latest_version` and that a check-in was recorded (R2).
6. Run the R5 checklist with that new standalone build.
7. Set `latest_version`, then `minimum_supported_version`, then `enforce = true`, in that order. Record who did it and when.
8. Rollback: set `enforce = false`. This takes effect on the next launch, because the gate fails open.

Never enforce if `download_url` is unreachable, if step 4 does not replace the old app, or if the only clients are Expo Go.

#### Installs that cannot receive the gate

If R4 finds a standalone `1.0.0` that nobody can update:

- It will not run the R3 client check.
- After Phase 2 it may read `status = 'closed'` and show "Under review" (F7).
- After S5 it will simply stop seeing other people's unverified reports (empty list), which is acceptable.
- Do not put incompatible statuses in front of that install without a written exception, or keep serving it only the four legacy status values it already understands.

---

#### Trusted operator steps

Policy is public: include only public update guidance and verified hotline
numbers. Use a trusted database operator, not an app-admin client. Each policy
edit refreshes `updated_at`; supply `updated_by` with the actual operator's Auth
user ID and record the change and download-availability evidence here. Review
each platform separately. Use numeric `major.minor.patch` versions (at most 20
characters), HTTPS download URLs, and emergency numbers as an array of
`{ "label": "...", "number": "..." }` with plain digits and an optional leading
plus. The client refuses malformed policy data and fails open.

Compare recent sign-ins with missing/stale check-ins in a trusted SQL session:

```sql
select account.id as user_id, account.last_sign_in_at,
       client.platform, client.app_version, client.last_seen_at
from auth.users account
left join public.app_client_versions client on client.user_id = account.id
where account.last_sign_in_at >= now() - interval '30 days'
  and (client.user_id is null or client.last_seen_at < account.last_sign_in_at)
order by account.last_sign_in_at desc;
```

Investigate missing/stale check-ins against the inventory. An update on one
device does not prove another device is updated. Retain the legacy RPC until
both the inventory and R5 establish no active old installs remain.

Implementation references: [Expo Constants](https://docs.expo.dev/versions/latest/sdk/constants/)
for project version/runtime, and [Supabase abort signals](https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal)
for bounded requests. The deadline also bounds auth/module loading. Timeout,
network failure, and missing policy all release the gate.

## 30 October 2026 — Phase 0 report privacy deployed

- **Target:** DisasterLink For Minglanilla (`wkblsbtypaxvdgvkiopc`), hosted Supabase.
- **Applied migrations:**
  - `20261007010000_fix_mayor_watchlist_barangay_id_ambiguity.sql` (previously pending RPC repair).
  - `20261030000000_restrict_report_history_reads.sql`.
  - `20261030000100_restrict_report_media_reads.sql`.
  - `20261030000200_hide_unverified_resident_reads.sql`.
- **Behavior:** internal history is readable by scoped officials; evidence rows
  and all file variants are private to active reporters or scoped officials;
  other residents cannot read unverified reports, comments, or upvotes. Feed
  ordering keeps its timestamp-only projection. Media-free category cards are
  implemented in the current development app.
- **Validation:** every migration replayed on a fresh local database; both local
  database suites passed (252 assertions, including 200 report privacy assertions).
  Hosted deployment completed, a subsequent dry run found no pending migrations,
  and ten read-only catalog checks passed. No production test fixtures were added.
- **Device acceptance:** the user confirmed completion of Phase 0 checks on the
  physical iPhone using Expo Go and the hosted backend, following the official
  navigation fix. Phase 0 is complete. Web and standalone
  compatibility checks have not been run in this deployment.
- **Official navigation follow-up:** removed `href: null` from report-detail and
  Log Incident routes in `app/official/_layout.tsx`. SDK 58 redirects away from
  routes with that option; the custom bottom bar already omits their buttons.
  The user subsequently confirmed Phase 0 device acceptance.
- **Known residuals:** other residents still read confirmed/escalated/resolved
  source-report details until T26; Mayor raw detail and evidence remain until T31.
  See `SECURITY.md` for the full residual register.

## Earlier delivery notes — 3 August 2026

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
