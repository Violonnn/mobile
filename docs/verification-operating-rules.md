# DisasterLink verification operating rules

Prepared 30 October 2026 from revision 3 of the
[report response flow plan](report-response-flow-plan.md). This is the proposed
operating agreement for the future workflow. Phase 1 implements release safety;
the lifecycle controls below go live in Phases 2–5. Phase 3 must not go live
without the three dated approvals at the end of this document.

## Stakeholder review deferred — 30 October 2026

The owner requested that the stakeholder meeting and operating-rule approvals
be deferred until next week. The exact meeting date is still to be confirmed.
This is a scheduling deferral; no stakeholder approval has been received or
recorded by this update.

- Phase 2 remains deployed. The meeting is not a prerequisite for keeping its
  tested database foundation in place.
- Phase 3 implementation and controlled local testing may proceed while the
  review is pending.
- Release of Phase 3 for actual operational use still requires the G1 approvals,
  manuscript/flowchart alignment, and R5 compatibility checks in the plan.
- At next week's meeting, follow the review steps under "How to complete this
  project approval" and record the actual decisions, requested changes, names,
  and approval dates. The sign-off table remains pending until then.

## Review and verification

Testing status, 31 October 2026: the owner explicitly authorized deployment of
the Phase 3 backend to the existing hosted Supabase project so the local Expo
client can be tested on the physical iPhone through Expo Go. The three migrations
and `create-report` version 7 are deployed and hosted checks pass. This is
controlled test availability, not a record of manual acceptance or stakeholder
approval. The sign-off table and operational release requirements remain pending.

Taking a report for review records who is reviewing it and when. It does not
confirm the incident or assign incident ownership. A colleague in the same
office may explicitly take over; the history retains both officers. The office
owns the incident and each action records the user who performed it.

Remote verification requires an authorized reviewer to assess the available
evidence and location for a credible incident in scope, record the decision,
and identify the confirming evidence where a note is required. Evidence may
include submitted photos/video and corroborating operational information. A
claim, a caller's account, a contact attempt, or merely reaching the reporter
does not independently establish confirmation. Where the evidence cannot
support confirmation, request field assessment, record could-not-confirm, or
reject with the applicable reason. A field assessment remains provisional
until the lead office records a finding.

A call to the reporter is optional and never itself confirmation. Opening the
dialer records nothing. Record the outcome separately: reached, no answer,
call failed, or not recorded. Do not store the reporter's phone in event notes.
Reporter contact access remains limited to authorized operational officials
and is audited.

An official typing a hotline caller's account is recording an unconfirmed
report. It follows claim and review, with a note describing the confirming
evidence when verified. Only an official's own on-site observation starts as
confirmed through official field intake.

MDRRMO checks uncertain jurisdiction and routes reports to the correct office.
That check never verifies the report. MDRRMO reviews pending reports only for
barangays with no active BDRRMO. Wrong-barangay rerouting requires a reason,
clears the claim, and informs the reporter which office is responsible.

## Response, support, and transfer

Contacting a hotline and asking for assistance are distinct from confirmed
dispatch. Record the service and contact outcome or requested assistance.
Choose dispatch confirmed only when the responsible service confirms that it
is sending responders. Record the service, who confirmed (role/name, at most
80 characters), and method: callback, radio, in person, or written message.
An optional reference may be included. A request alone is never dispatch.

Only dispatch confirmed, responders on site, assistance given, or operational
work done qualifies for Response ongoing. A reporter call, hotline contact,
assistance request, external information, internal note, or public progress
message alone does not qualify. Logging any response action never verifies a
report automatically.

Support leaves BDRRMO as lead. A transfer changes the lead only when MDRRMO
accepts; BDRRMO remains responsible while acceptance is pending. MDRRMO may
return a request with a note; BDRRMO may cancel it. After transfer, BDRRMO
keeps supporting access and internal event logging, but cannot resolve or
publish public updates. Only the lead office records findings and resolves.

Provisional cases may request support or transfer while awaiting assessment.
If MDRRMO accepts a provisional transfer, it records the field finding once.
MDRRMO re-verifies a previously confirmed case only on transfer, not on support.
No provisional incident is public.

Resolution requires a plain-language public outcome summary of 1–280
characters. Legacy outcomes without a summary remain labelled summary not
posted until the office adds one. Never fabricate a summary or historical
acceptance. Withdrawing a previously public confirmation requires a public
correction, an audit event, and notification to every linked reporter. Keep
the correction marker for seven days; the former link explains the correction
afterward unless the incident is sensitive. New evidence is a new report
which officials may link; reopening requires a reason.

## Public information and photo screening

**7 November 2026 amendment:** the owner approved per-report publication with
resident-controlled identity and location sharing. The agreed replacement flow
is recorded in [Resident report publication and sharing](resident-publication-sharing.md).
The original rules below describe the earlier incident-only projection; they
remain relevant to legacy incident posts and evidence handling, but must not be
used to prohibit the newly approved, explicitly consented report publication.
This amendment does not waive photo metadata verification or operational sign-off.

Publish confirmed incidents through the limited public record: type, barangay,
public status, official updates/outcome, linked-report count, and approved
derivative photos. Keep resident identity, title/description, exact device
GPS, source reports, contact logs, internal notes, original files, and videos
private. Public discussion belongs to the incident, never to exposed source
reports. The feed must work without photos.

Before approving each photo, the lead-office official must confirm:

- The incident is confirmed, has not been withdrawn, and is not sensitive.
- The image contains no identifiable injured faces, children, identifiable
  homes, house numbers, plates, contact information, or other identifying data.
- The image is appropriate for a public safety update and contains no private
  notes or unnecessary personal information.
- Processed display and thumbnail files exist and have been verified to strip
  location metadata; publication stays disabled until that processing is proven.
- Only display/thumbnail paths will be shared. Original evidence and
  `report_media` rows remain private to the reporter and scoped officials.

Approval is explicit per photo, with approver, timestamp, and audit event.
Revoke it when the photo is no longer suitable. Mark cases involving injured
people, children, or identifiable homes sensitive: public information becomes
barangay-only, all public photos are revoked, and no coordinates are published.
Removing sensitivity does not automatically republish photos.

The default public location is an approximate area, labelled approximate and
drawn as an area rather than an exact pin. A lead-office official may publish
an exact operational location only for a specific safety message, such as a
road closure, blocked bridge, or evacuation assembly point. Record and show
the safety reason, and audit the decision. Sensitive incidents cannot use
this exception in this release.

## Mayor requests and review outcomes

The Mayor receives limited pending summaries and official case timelines,
plus public-approved photos. Reporter contact details and raw evidence are
excluded. The Mayor cannot change report or incident status.

Allow one open update request per report or incident. Notify the responsible
office once; it acknowledges and answers with text of 1–500 characters.
The Mayor sees the acknowledgment and answer and may cancel the request.
There are no repeated reminders. An open request follows a change in
responsible office with an audit event. Public progress remains a separate
lead-office action.

Reject reasons are test or spam (`test_or_spam`), not an emergency incident
(`not_an_emergency_incident`), outside approved type (`outside_approved_type`),
abusive content (`abusive_content`), insufficient location
(`insufficient_location`), or other (`other`, explanatory note required).
Use a clear reason; could-not-confirm requires a note and neutral wording,
with advice to send a new report if conditions change. Outside-coverage
reports must say they were not forwarded and provide hotline guidance.

## Manuscript alignment and sign-off

Use these same rules in the manuscript's Scope of the Project, disaster
reporting/verification description, operational procedure, and report flowchart
(A and steps 01–16). Replace mandatory confirmation-call wording with optional
contact and evidence-based verification; distinguish recorded hotline accounts,
support, accepted transfer, and the municipal finding. Align public privacy and
Mayor permissions with the sections above. The actual manuscript is not present
in this repository; the two DOCX files under `docs/` are implementation/research
plans. Apply and review the matching manuscript edits before sign-off.

### How to complete this project approval

This is the project's workflow-review requirement, not an Expo or Supabase
account approval. Its purpose is to confirm that the software's decisions,
responsibilities, and public information match how the participating offices
have agreed to operate. Automated tests establish what the software does; the
representatives confirm that those are the procedures they intend to use.

1. Share this document and the proposed report flowchart with a BDRRMO
   representative from the intended pilot barangay, an MDRRMO representative,
   and your adviser. Ask them to review the same dated version.
2. Walk through a normal report, an uncertain report, a support request, an
   accepted transfer, and a withdrawn confirmation. Check the optional-call
   rule, evidence needed for confirmation, office responsibility, and the
   rules for publishing photos and locations. Record requested corrections.
3. Incorporate agreed corrections into this document, the implementation plan,
   and the manuscript/flowchart. Resolve disagreements before treating the
   workflow as approved.
4. Obtain each representative's actual dated approval or signature, enter the
   approver's name/office and date below, and retain the supporting approval
   record. Do not enter an approval on someone else's behalf without evidence.

Local implementation and controlled development testing may continue while
these approvals are pending. The existing G1 requirement applies before
releasing Phase 3 for actual operational use. For a classroom-only demonstration,
discuss the approval scope with the adviser and explicitly revise the project
plan if a different release gate is agreed; a successful app launch or test run
does not automatically waive the current requirement.

| Approver | Name / office | Approval / signature | Date |
| --- | --- | --- | --- |
| BDRRMO representative | Pending | Pending | Pending |
| MDRRMO representative | Pending | Pending | Pending |
| Adviser | Pending | Pending | Pending |

No approval is implied by code implementation. Phase 3 release remains blocked
until this agreement is signed and its manuscript/flowchart wording is aligned.
