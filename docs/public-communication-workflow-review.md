# Public updates, the mayor's Facebook page, and DisasterLink

Review date: 4 November 2026. This records a product/operating-workflow review,
not an approved change to LGU authority or the deployed publishing permissions.

## What the concern reveals

A public post under a mayor's account does not establish who collected the
facts, verified them, drafted the message, or approved release. Those are
separate responsibilities. The app needs to follow the actual LGU arrangement
for each responsibility rather than infer authority from a social-media account.

The current implementation lets the incident's lead office publish a public
progress event directly. `postProgressUpdate` calls `log_incident_event` with
`p_is_public = true`; the database restricts this to the lead office and the
progress-update type. There is no separate PIO/mayoral approval state or
Facebook publishing integration in that path. A lead-only permission therefore
does not demonstrate that a particular official is the LGU's authorized publisher.
This is an operating assumption to validate with stakeholders, not a frontend
label that can establish authority.

The Mayor already has a separate community-announcement publishing feature:
`app/official/community.tsx` permits the Mayor to compose announcements, and
`create-official-announcement` authorizes an active municipal Mayor account and
derives its Mayor Announcement label from that profile. This is different from
an approval queue that selects or converts logged incident updates. No such
mayor/PIO incident-publication queue is implemented by the current Phase 3 work.

National law assigns local DRRM offices monitoring and public-information duties
alongside response coordination. That supports a role for operational staff in
producing accurate information; it does not determine this LGU's account access
or who may approve every category of public announcement.
[RA 10121, sections 11–12, Supreme Court E-Library](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/21121).

An example of actual practice is Agusan del Sur's joint DRRM/public-information
training, which describes information officers and media partners working with
DRRM staff on incident information and coordinated publication. This is an
example, not evidence of Minglanilla's own procedure.
[Province of Agusan del Sur, 12 January 2026](https://agusandelsur.gov.ph/2026/01/12/agsur-info-officers-media-boost-risk-communication-efforts/).

## Recommended fit with existing work

1. Operational staff record and verify incident facts in the case record.
2. The designated communications authority approves a public message when the
   LGU's process requires approval. Routine factual progress can use delegated
   authority if that delegation is explicitly agreed. Policy announcements and
   instructions follow the authorized issuing office's process.
3. The same approved message is distributed through the app and existing public
   channels, including Facebook. Show the responsible office, incident, and
   time the information applies to. Corrections should be traceable across
   channels so two independently edited versions do not diverge.

A practical next feature could therefore be a curated public-update proposal
queue for the designated Mayor/PIO publisher. Operational officers would submit
a verified, privacy-appropriate summary linked to the incident; the publisher
could approve, return, or reject that proposal. Keep the incident's operational
lead and response actions with DRRM staff. A publishing approval must not become
an accidental prerequisite for emergency response. Raw private logs, contact
details, and unapproved evidence should not be copied automatically into that
public-message queue. This proposal needs its own backend permissions and
audited proposal/approval states; it is not accomplished by the existing Mayor
Announcement composer or by adding a client-side approve button.

This is a proposal. If stakeholder review confirms that approval is required,
implement a server-enforced draft/approval/publication workflow and publisher
permissions. Hiding a button or merely renaming it would not enforce that rule.
Do not require a mayor's individual click for every routine update by assumption:
that could introduce a bottleneck without reflecting the LGU's actual delegation.

## Practical contribution beyond another public feed

The strongest use case is closing a report through a responsible office and an
auditable outcome. For example, several residents may report the same flooded
road. The useful record connects those reports to one incident, records who is
reviewing it, which office leads, whether another office accepted a handoff,
which services actually confirmed dispatch, and the eventual outcome. An
approved public message can then draw on that record for either channel.

Facebook remains useful for public reach. DisasterLink adds value when its case
workflow reduces missed reports, duplicate handling, ambiguous responsibility,
and time spent reconstructing what happened. A second feed requiring duplicate
typing without those improvements could add work and may not justify adoption.
Do not claim improved response times or better adoption until a pilot measures
them. Resident-facing lifecycle and publication work still listed in later
phases must not be presented as completed Phase 3 benefits.

## Related gaps to settle in the pilot

| Gap | Practical response |
| --- | --- |
| Who can release public information? | Agree routine-update delegation, announcement categories, and approval authority with the actual DRRM and communications staff. Align backend permissions with that agreement. |
| Who watches incoming reports during each shift? | Name the on-duty receiving office, define acknowledgment/escalation expectations, and preserve an emergency telephone route. An app submission alone must not imply responders were dispatched. |
| Are app entries proof that outside agencies acted? | Treat manually recorded dispatch as the officer's attributed confirmation record. Keep service, confirmer, method, and time. A dialer opening or a saved request is not agency acceptance. |
| Will staff type the same information into several places? | Pilot one case record and reuse approved summaries for existing channels. Copy/export or integration is future work; the current app does not synchronize Facebook. |
| What happens when connectivity fails? | Distinguish a local draft/queued report from a server receipt and office acknowledgment. Test real off-hours and poor-connectivity scenarios; maintain the agreed telephone/radio process. |
| Could sensitive operational information become public? | Keep internal notes/contact/media distinct from the approved public message. Confirm who reviews sensitive content and corrections in actual practice; do not equate role-based access with publication approval. |
| Do the role names match the people doing the work? | Validate actual LGU positions and barangay committee/staff designations. The app's BDRRMO/Mayor labels are implementation choices, not evidence of staffing or delegated legal authority. |

For a small pilot, compare time to first office acknowledgment, reports without
a responsible office, duplicate handling, accepted handoffs, time spent entering
each case, and agreement between app and public-channel updates. Use actual
before/after records and staff feedback. If the workflow cannot improve these
without adding unreasonable work, simplify it before expanding social features.

The existing operating-rule approval remains pending in
[verification-operating-rules.md](verification-operating-rules.md). This review
does not sign it off, deploy a new role, or change publication rights.
