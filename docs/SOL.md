# DisasterLink solution assessment and government-readiness roadmap

**Document status:** Engineering and product review draft  
**Review date:** 1 August 2026  
**Scope reviewed:** The mobile repository, local Supabase migrations and Edge Functions, and the intended scope in `docs/context.md`  
**Intended reviewers:** Municipality of Minglanilla stakeholders, MDRRMO, authorized barangay DRRM representatives, Mayor/LCE representatives, DPO, records officer, system administrator, project adviser, and developers

## 1. Executive decision

DisasterLink already has a substantial MVP foundation. The resident reporting journey, role-scoped official portals, invite lifecycle, two-level report handling, community feed, private media, basic resource directories, and evacuation-center status management are materially implemented. This is more than a visual prototype.

It is **not yet suitable to represent itself as a production government emergency-management system**. The largest gaps are not more screens. They are operational governance, incident-command structure, authoritative warning controls, privacy and records management, privileged-account security, reliable notification delivery, exact municipal geospatial data, public emergency access, test evidence, and production operations.

The recommended product position is:

> **A controlled Minglanilla pilot for community observations and LGU situational awareness, after the P0 controls in this document are completed. It must not yet be presented as a replacement for 911, official PAGASA/PHIVOLCS/MGB warnings, radio/SMS channels, or the municipal Emergency Operations Center.**

### Readiness snapshot

| Capability | Current rating | Decision |
|---|---:|---|
| Resident authentication and report intake | Amber | Strong MVP; correct security, accessibility, offline-media, and emergency-friction issues before pilot. |
| Barangay-to-municipal report workflow | Amber | Works as a simple queue, but report verification is being used as incident management. Split those concepts. |
| Official accounts and authorization | Amber/Red | Role and scope exist, but suspension is not enforced consistently by database authorization and privileged MFA is absent. |
| Community feed and moderation | Amber | Posting and engagement work; flagging, sharing, complete moderation, and safe ranking do not. |
| Alerts and notifications | Red | Tables and outbox are foundations only; there is no end-to-end push worker, delivery evidence, inbox, or authoritative alert protocol. |
| Maps and geospatial accuracy | Red | Useful prototype; approximate centroids, broad bounds, absent polygons, hidden attribution, and best-effort online tiles are not operationally sufficient. |
| Evacuation and resource management | Amber/Red | Basic directories/statuses work; occupancy, accessibility, WASH, vulnerable groups, supplies, vehicles, teams, and audit history are missing. |
| Mayor/command analytics | Red | Basic cards exist; no operational dashboard, service-level metrics, SitRep, or trustworthy municipal picture. |
| Official records and PDF export | Red | A JSON-oriented database foundation exists; no client workflow, immutable snapshot, official PDF, approval, or records schedule. |
| Admin and municipality management | Red | Invites work; account management is explicitly a placeholder and municipality management is absent. |
| Quality, security, and operations evidence | Red | Type checking/lint currently fail; no automated tests, CI, recovery evidence, monitoring, or deployment certification was found. |

**Overall:** suitable for continued development and a supervised demonstration; conditionally suitable for a limited pilot after P0; not ready for general government production use.

## 2. How this assessment should be read

This is a repository-based engineering assessment, not a legal opinion, cybersecurity certification, or confirmation of the deployed Supabase project. Local migrations show intended RLS and backend behavior, but do not prove that production migrations, secrets, backups, SMS delivery, storage rules, and Edge Functions match the repository.

The final authority for operating procedures remains the municipality. The MDRRMO should approve the incident and warning workflow; the DPO should approve privacy controls and the privacy notice; the records officer should approve retention and disposition; and authorized local officials should validate barangays, contacts, facilities, evacuation centers, hazard layers, and escalation rules.

Status terms used below:

- **Implemented:** a working route, client behavior, and backend path were found.
- **Partial:** some layers exist, but the user journey, enforcement, or operational evidence is incomplete.
- **UI only:** the control or screen is present without the required behavior.
- **Schema only:** tables/functions exist without an end-to-end product flow.
- **Not found:** no meaningful implementation was found in the reviewed repository.

## 3. Scope-to-code assessment

### 3.1 User access and security

| Intended capability | Status | Repository assessment | Required decision/change |
|---|---|---|---|
| Resident registration and secure login | Implemented with modifications required | Phone OTP, resident details, six-digit PIN, bcrypt server handling, lockout, forgot-PIN reset, enumeration-resistant messaging, and persisted sessions exist. | Store tokens and sensitive queue material using platform-secure storage where possible; add device/session management and a public safety mode that does not require login. |
| Role-based access for MDRRMO, barangay DRRM, Mayor, and admin | Partial | Role routes, guards, Supabase policies, and barangay scope are substantial. | Make active/suspended status part of every database authorization decision, not only portal navigation or selected Edge Functions. Add explicit permission tests. |
| Official invite generation and revocation | Implemented | Hashed, one-time, seven-day tokens bind email, phone, role, and barangay; admin can create/list/revoke. | Add invite audit events, delivery/recovery procedure, approver identity, and complete official account lifecycle. |
| Email verification for official accounts | Not implemented as described | Registration marks the Supabase email confirmed after phone OTP, while the application-level `email_verified_at` remains null. Possession of the government email inbox is not proven. | Send and require a real email verification or administrator identity-proofing step before activation. Do not label the current flow “email verified.” |
| Forgot password/PIN | Implemented for residents | Resident reset path and rate limiting exist. | Add documented, auditable official-account recovery; do not rely on informal manual database changes. |
| Privileged-account MFA | Not found | Official login is email/password. | Require phishing-resistant MFA when available, or at minimum TOTP for MDRRMO, Mayor/LCE representatives, admins, and high-impact publishers. |
| Official account management | UI only | Admin Accounts explicitly says it is coming soon. | Implement list, invite state, activate/suspend/reactivate, scope/role change with approval, forced logout, MFA reset, and audit history. |
| Municipality management | Not found | The data model is effectively single-municipality. | Do not build multi-tenancy merely because it appears in the original scope. Confirm whether Minglanilla-only is the real mandate. If yes, remove the claim; if no, design tenant isolation before adding another municipality. |

### 3.2 Map and location integration

| Intended capability | Status | Repository assessment | Required decision/change |
|---|---|---|---|
| Base map | Implemented as an online prototype | Leaflet in a WebView loads remote scripts/styles and OpenStreetMap tiles. | Use an approved, supported map delivery design with visible attribution, a configurable provider, caching within license terms, CSP/domain allow-listing, and a documented offline/degraded mode. |
| Live GPS capture | Implemented | Foreground high-accuracy location, permission/error states, and map correction exist. | Add accuracy/age fields, reject stale fixes, show uncertainty, and define a no-GPS/manual landmark path. |
| Reverse geocoding | Partial | The app maps coordinates to the nearest seeded barangay centroid rather than a verified address or polygon containment result. | Load official municipality and barangay geometry with PSGC codes; perform point-in-polygon validation; treat a human-readable address as descriptive, not authoritative. |
| Map search | UI only | Search affordances do not perform a search. | Implement barangay, facility, evacuation-center, landmark, and report-reference search, or remove the decorative controls. |
| Overlay legend/layers | Partial | Report clusters, facilities, evacuation centers, and layer toggles exist. | Add authoritative hazard layers, provenance, effective time, legend, last-updated state, and unavailable-layer behavior. |
| Local boundary enforcement | Unsafe prototype | Backend validation accepts a broad Metro Cebu-like rectangle, and a selected barangay is checked for existence but not spatial consistency. | Use the official Minglanilla polygon and barangay polygons server-side. Flag, rather than silently misroute, boundary/coordinate mismatches. |

The migration seeds 19 barangays, matching the Philippine Statistics Authority count, but the repository uses `Linao-Lipata` while the current PSA PSGC list uses `Linao`. The authoritative list and codes must be validated and migrated without breaking historical references. The PSA page reports 155,934 residents in the 2024 Census, which also means capacity and performance tests should model municipal-scale emergency bursts, not only classroom demo traffic. See the [PSA PSGC barangay listing for Minglanilla](https://psa.gov.ph/classification/psgc/barangays/0702232000).

### 3.3 Disaster reporting and management

| Intended capability | Status | Repository assessment | Required decision/change |
|---|---|---|---|
| Low-friction resident reporting steps | Implemented | Location, live media, details, review/submission, permission/error handling, and a local retry queue exist. | Preserve the progressive flow, but add a fast emergency path and make evidence media non-blocking. |
| Required GPS/photo/video | Implemented more strictly than the formal scope | Current validation requires a title, one to three live photos, and at least one live video up to 30 seconds. | Do **not** require both photo and video during distress. Permit a text/location-only or single-media report, record evidence quality, and request follow-up evidence later. |
| Offline reporting | Partial | AsyncStorage queues reports; retries occur on reconnect or app foreground. | Copy media into durable app storage, encrypt sensitive queued data, expose queue state/cancel/retry, expire abandoned drafts, and never claim background delivery unless a real background task is supported and tested. |
| Duplicate-safe submission | Implemented foundation | Generated IDs/idempotent upload behavior reduce duplicate creation. | Add server-side duplicate detection/linking while preserving the original report as a public record. |
| Two-tier verification | Implemented but semantically weak | Barangay scope can verify/escalate; MDRRMO can reverify and resolve; actors/timestamps are displayed. | Separate `verification_state`, `workflow_state`, and `escalation_level`. The current escalated-to-verified transition erases meaning and cannot model rejection, duplicate, insufficient evidence, or false report. |
| Confirmation call | Partial | Officials can reveal a masked contact through an audited action and open the dialer. | Record call attempt/outcome/consent safely; keep contact reveal least-privilege; never make a call the only verification method. |
| Official-created reports | Implemented with a trust-model problem | Authorized barangay/MDRRMO users can submit reports, which are automatically “verified,” with optional media and editing. | Store `source_type=official` separately from factual verification. Official origin is accountable provenance, not proof that every detail is confirmed. |
| Report status history | Implemented for status transitions | A timeline and actor attribution exist. | Make incident actions append-only; add correction reasons and supervisor approval where required. Never rewrite the audit trail. |
| Contribution management | Partial | Residents can view reports/feed, but there is no useful contribution dashboard, withdrawal/correction flow, or status explanation. | Add “My reports,” sync/status timeline, official requests for more information, correction without destructive overwrite, and privacy-safe feedback. |
| Incident management | Not found as a separate domain | Citizen reports themselves are treated as incidents. | Add a real incident record that can aggregate many reports and contain incident number, type, severity, location/area, lead, command status, objectives, actions, resources, and closure approval. |

#### Required domain correction

The system currently models a linear content-moderation status more than emergency incident management:

`unverified -> verified -> escalated -> verified -> resolved`

Replace this with independent dimensions:

- `verification_state`: pending, corroborated, insufficient_evidence, disputed, false, duplicate.
- `workflow_state`: received, acknowledged, triaged, assigned, action_in_progress, monitoring, closed, cancelled.
- `escalation_level`: barangay, municipal, provincial/regional referral, external agency.
- `source_type`: resident, barangay official, MDRRMO, sensor/agency import, partner.
- `severity` and `priority`: separate controlled values with an explicit reason.

A resident submission should remain an immutable observation. Authorized personnel may link it to an incident, redact public fields, add findings, or mark it duplicate; they should not convert its original statement into an official fact.

### 3.4 Community communication

| Intended capability | Status | Repository assessment | Required decision/change |
|---|---|---|---|
| Integrated feed | Implemented | Reports and announcement cards are present; report media, sorting, comments, replies, and upvotes work. | Create an information hierarchy: official emergency alert, official advisory, verified local update, then community observation. Do not visually flatten them into equivalent posts. |
| Pinned official announcements | Implemented | Pin ordering gives Mayor, then MDRRMO, then barangay-level priority. | Add effective/expiry times, approval state, superseded/cancelled state, geographic targeting, language variants, and an immutable publication history. |
| Announcement publishing | Implemented | BDRRMO/MDRRMO/Mayor paths exist; MDRRMO has an Edge Function/media path. | Standardize all high-impact publishing through a server-enforced workflow; direct client RLS writes should not bypass approval, active-status, or audit requirements. |
| Geographic audience control | Needs modification | Authenticated residents can receive/read announcement data more broadly than a home-barangay or affected-area model suggests. | Add explicit municipal/barangay/geometry audiences and apply the same server-side audience rule to feed queries and notification delivery. Municipal emergency alerts remain municipality-wide only when the approved warning area justifies it. |
| Push/local notification | Schema only | Notification/outbox/push-token structures and enqueue triggers exist. No end-to-end worker, token registration dependency, inbox, retry/dead-letter UI, or delivery status was found. | Build the complete delivery pipeline and prove it across Android/iOS, provider failure, expired tokens, retry, deduplication, and receipt tracking. |
| Early warning | Not operational | Announcements are not a standards-based alert system and no authoritative agency ingestion exists. | Add an approved warning workflow, source/provenance, affected area, onset/expiry, urgency/severity/certainty, instructions, approval, update/cancel, and multi-channel delivery. CAP-compatible modeling is recommended. |
| Flag misinformation | Partial/schema only | A flags table/policy foundation exists; the visible menu is not connected to a complete resident-to-moderator flow. | Implement reason selection, evidence, scoped moderation queue, decision, notification, appeal/restore, abuse controls, and audit. |
| Share reports | UI only | Share affordance has no completed behavior. | Share a privacy-safe canonical link or image card; never expose signed private media URLs, exact home coordinates, or reporter identity. |
| Feed relevance | Needs modification | “Relevance” is based mainly on engagement counts. | Rank official active alerts first; then geography, verification, severity, freshness, and usefulness. Cap or remove engagement influence for unverified content to avoid amplifying misinformation. |
| Resident announcement engagement | Not implemented | Report engagement exists; announcement cards do not have the same resident interaction path. | Decide whether comments are operationally useful. For emergency alerts, acknowledgements or “I need help” are safer than popularity mechanics. |

Official warnings must originate from or faithfully relay authorized agencies and the municipal warning chain. Republic Act No. 10639 provides for free location-targeted mobile disaster alerts carrying official warning, evacuation, relief, and contact information. DisasterLink should supplement, not impersonate or replace, that channel. See [RA 10639](https://lawphil.net/statutes/repacts/ra2014/ra_10639_2014.html) and [PAGASA products and services](https://www.pagasa.dost.gov.ph/products-and-services).

For interoperable alert data, use the Common Alerting Protocol concepts and lifecycle even if a full CAP exchange is phased later. CAP supports consistent warnings across multiple systems; see the [ITU CAP overview](https://www.itu.int/en/ITU-D/Emergency-Telecommunications/Pages/Common-Alerting-Protocol-and-Call-to-Action.aspx) and [ITU-T X.1303](https://www.itu.int/rec/T-REC-X.1303).

### 3.5 Evacuation centers, facilities, and resources

| Intended capability | Status | Repository assessment | Required decision/change |
|---|---|---|---|
| Hotline directory | Implemented | Active hotlines can be managed and shown on Home. | Add owner, authority, operating hours, last verification, alternate channel, and stale-data warnings. Keep national 911 available without authentication. |
| Facility directory | Implemented | Facilities are manageable and mapped. | Add official source, accessibility, services, contact, operating state, verification history, and data steward. |
| Evacuation center status | Implemented at a basic level | MDRRMO creates centers; municipal/barangay roles update scoped status; Mayor can mark priority. | “Available/Full” is insufficient. Add open/closed reason, occupancy/capacity, families/people, sex/age-disaggregated and vulnerable-group counts with privacy controls, accessibility, WASH, power, communications, medical capacity, supplies, manager, and timestamped history. |
| Resource inventory | Not found | No operational inventory of personnel, teams, vehicles, equipment, stock, or deployment. | Implement a minimal resource catalogue and assignment log linked to incidents; do not attempt full logistics/warehouse software in the first pilot. |
| Resource requests and deployment | Not found | No request, approval, allocation, dispatch, return, or mutual-aid workflow. | Add request/offer/approve/dispatch/receive/release states with accountable actors and time stamps. |

### 3.6 Analytics, documentation, and administration

| Intended capability | Status | Repository assessment | Required decision/change |
|---|---|---|---|
| Mayor dashboard | Partial | Basic report and center counts/priority items exist. | Show operational measures: unacknowledged backlog, median acknowledgement/triage/escalation times, incidents by severity/barangay, overdue actions, center occupancy, resource availability, delivery failures, and data freshness. |
| Resolved/unresolved analytics | Partial foundation | Counts and a database analytics view exist. | Define metrics formally; do not let “resolved report” stand in for incident outcome or government performance. Add date/scope filters and data-quality indicators. |
| Official PDF export | Schema only/not complete | An export-oriented RPC/JSON foundation exists, but no official PDF generation, snapshot, client action, or approval flow was found. | Generate server-side from an immutable snapshot; include report/incident reference, classification, sources, timeline, actors, generated-at/by, page numbers, attachments manifest, and a verification hash/QR. Audit every export. |
| System admin overview | Partial | Invitation metrics and recent invitations work. | Keep system administration separate from operational command. Finish accounts, access review, sessions, integrations, audit, and configuration; avoid granting admins automatic incident-content authority. |
| Audit | Partial | Status history and contact-access logs are strong foundations. | Add append-only events for login/security changes, invitations, account state/role/scope, publication/update/cancel, resource and center changes, moderation, exports, configuration, and sensitive reads. |
| Records management | Not found | No approved classification, retention, legal hold, archival, or disposition workflow was found. | Establish records series and retention/disposition with the records officer and National Archives requirements before promising deletion or indefinite retention. |

## 4. Feature inventory by current user journey

### Resident capabilities already present

- Welcome/onboarding and protected Expo Router navigation.
- Phone OTP registration; name, birth month/year, and barangay collection; terms acceptance; six-digit PIN.
- PIN login, persistent session, rate limiting/lockout, forgot-PIN flow, and generalized security messages.
- Location permission, high-accuracy GPS capture, nearest-barangay approximation, manual map correction, and barangay selection.
- Live camera-only evidence: one to three photos and one video with a 30-second total limit.
- Required title/description validation, review, local queueing, idempotent upload, reconnect/foreground retry, and submission feedback.
- Realtime report/map updates and private signed report media.
- Home announcements, hotlines, facilities, and map preview.
- Community feed with latest/relevance/oldest sorting, five-item pagination, report media, upvotes, comments, and replies.
- Map clustering and report/facility/evacuation-center layers.
- Profile display and logout.

### Official capabilities already present

- Invite-bound registration and official email/password login.
- Role-specific portals for barangay DRRM, MDRRMO, and Mayor/LCE views.
- Scoped report queues and report detail.
- Barangay verification/escalation; MDRRMO reverification/resolution; Mayor read-only status access.
- Actor-attributed status history and notes.
- Masked reporter contact with audited reveal before dialing.
- Official-origin report creation/editing with optional media.
- Announcement publication and pin hierarchy.
- Scoped comment hide/restore for authorized operational roles.
- Hotline and facility maintenance.
- Evacuation-center creation/status management and Mayor priority marking.
- Basic command counts, priority reports, and center counts.

### Administrator capabilities already present

- Create, list, copy, and revoke official invitations.
- Active/used invitation metrics and recent invitation overview.
- Protected admin tab shell.
- An account-management placeholder that correctly avoids exposing fake data.

### Useful backend foundations that are not complete user features

- RLS-enabled application tables and private storage policies.
- Report, media, history, engagement, comments, flags, notifications, push tokens, resources, and invitation schema.
- Edge Functions for resident authentication/reporting, official invites, official reports, announcement creation, and SMS provider handling.
- Notification outbox/enqueue triggers.
- Basic analytics/export database functions.

## 5. Critical modifications before adding more feature breadth

### 5.1 Make emergency help accessible without an account

The current useful safety information is behind authentication. Provide a public/guest mode with:

- “Call 911” and verified municipal/barangay contacts.
- Current official alerts and evacuation instructions.
- Evacuation centers and critical facilities, with a low-bandwidth list fallback.
- A clear statement about whether reports are continuously monitored.
- A safe way to start a report, then authenticate only if required for submission/follow-up.

Until the municipality staffs and governs the channel as emergency dispatch, use prominent copy such as: “For immediate danger, call 911. DisasterLink reports support situational awareness and may not receive an immediate response.” The final wording must be approved by MDRRMO and legal/DPO reviewers.

### 5.2 Reduce reporting friction and protect evidence integrity

Requiring live GPS, a photo, and a video can exclude users with low bandwidth, disabilities, unsafe surroundings, denied permissions, or older devices. It can also encourage filming instead of moving to safety.

Recommended intake:

1. First show immediate-safety guidance and emergency call action.
2. Capture location if available; show accuracy and permit a landmark/manual barangay.
3. Accept a short category and description.
4. Encourage, but do not require, one safe photo or short video.
5. Submit immediately; collect additional evidence through official follow-up.

Preserve original media metadata, compute a server-side hash, record capture/import source, and never claim that “live capture” alone proves authenticity. If gallery media is later allowed, label its provenance rather than rejecting useful historical evidence.

### 5.3 Enforce suspension and least privilege in the database

The highest-priority security defect is that central role helper functions and several direct-write policies appear to rely on role/scope without consistently requiring `status = 'active'`. A suspended official with a still-valid session may retain database privileges even when the UI redirects them.

Required fix:

- Make active status part of canonical authorization helpers.
- Rebuild dependent RLS policies and RPC checks around those helpers.
- Revoke/terminate sessions when an account is suspended or its role/scope changes.
- Route high-impact writes through narrowly scoped server functions with validation and audit.
- Add automated negative RLS tests for resident, cross-barangay official, suspended official, Mayor, MDRRMO, and system admin.
- Keep the Supabase service-role key only in trusted server environments.

### 5.4 Minimize public exposure of people and exact coordinates

Current authenticated reads expose broad report/map data, including exact coordinates and reporter-display information, more widely than an operational need-to-know model permits. The public map should use an obfuscated point, grid/cell, barangay centroid, or incident area for sensitive residential reports. Exact coordinates, reporter identity, and contact should be separately permissioned and audited.

Apply field-level product views:

- Public/guest: official alerts, generalized incident locations, approved public descriptions.
- Resident: the public view plus their own exact submissions and official follow-up.
- Barangay responder: exact operational data only within authorized scope or assigned incident.
- MDRRMO: municipal operational data based on duty and purpose.
- Mayor/LCE: decision dashboard and approved detail; access to personal data should not be automatic merely because of rank.
- System admin: system metadata by default, not operational personal data.

### 5.5 Replace the online-only prototype map dependency

The WebView currently depends on remote Leaflet/cluster assets and best-effort OpenStreetMap tiles, accepts broad origins, and hides map attribution. The OpenStreetMap Foundation requires visible attribution and explains that its standard tile service has no SLA and does not permit offline bulk download. See the [official OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

For government use:

- Bundle approved map-rendering code or pin and integrity-check hosted assets.
- Restrict WebView origins/content and define a CSP.
- Restore visible attribution.
- Use a contracted provider with an appropriate SLA/offline license or self-host an approved Minglanilla extract.
- Cache an offline safety pack: barangay boundaries, critical facilities, evacuation-center list, hotlines, and last valid alerts. Do not bulk-download OSM standard tiles.
- Provide a list mode whenever the map cannot load.

### 5.6 Finish notifications as an accountable service

An outbox row is not a delivered warning. Add:

- Device token registration/rotation/removal and user notification preferences.
- A trusted worker with retry, exponential backoff, dead-letter handling, idempotency, and provider receipts.
- In-app notification inbox with unread/acknowledged state.
- Targeting by affected barangay/area and role, not indiscriminate broadcast.
- Alert update/cancel/supersede behavior.
- Delivery metrics and operator-visible failures.
- SMS, social/radio/manual dissemination checklists where the approved SOP requires them.
- Cebuano, Filipino, and English templates reviewed by local communicators.

### 5.7 Align privacy notices, consent, and records promises

The current combined terms/privacy text is not enough to establish government readiness. It appears to rely broadly on bundled consent, lacks a complete DPO/controller/processor description, does not present purpose-specific retention, and implies deletion through a barangay administrator. Public records may require controlled retention and authorized disposition, not unconditional deletion.

The DPO and records officer should define:

- The LGU as personal information controller, named DPO contact, processors/subprocessors, hosting locations, and contracts.
- Lawful basis and purpose for each data field and action; consent only where appropriate.
- Whether birth month/year is necessary. Remove it if age-related decisions are not part of the approved purpose.
- Separate consent/version evidence for optional processing; withdrawal behavior.
- Minor/child reporting and guardian/safeguarding rules.
- Retention by record series: account, raw report, incident record, media, location, audit, notification receipt, and export.
- Access, correction, objection, complaint, breach-notification, legal hold, archival, anonymization, and authorized disposal workflows.
- A Privacy Impact Assessment before pilot and after material changes.

NPC Circular No. 2023-06 strengthened security-of-personal-data requirements, including privacy management, access controls, storage/retention, business continuity, backup/restore, and risk-appropriate controls. Government/mobile processing will also need DPO and data-processing-system registration assessment through the NPC. See the [NPC circular overview](https://privacy.gov.ph/npc-issues-circulars-to-strengthen-personal-data-protection-in-ph/), [NPC FAQ](https://privacy.gov.ph/pips-and-pics/faqs/), [registration reminder](https://privacy.gov.ph/reminder-on-mandatory-data-protection-officer-and-data-processing-system-registration/), and [Data Privacy Act IRR](https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/).

Republic Act No. 9470 treats LGU records as public records and requires authorized records-disposition processes. The National Archives’ electronic records guidance calls for inventory, accountable records management, and approved retention/disposition. See [RA 9470](https://lawphil.net/statutes/repacts/ra2007/ra_9470_2007.html) and the [National Archives ERMP primer](https://nationalarchives.gov.ph/wp-content/uploads/2025/04/ERMP-PRIMER25.pdf).

## 6. Government and industry alignment

### 6.1 Philippine DRRM operating model

Republic Act No. 10121 assigns local DRRM structures responsibilities that extend well beyond collecting citizen posts: local risk mapping, multi-hazard early warning through diverse media, continuous monitoring, hazard and risk information, databases of personnel/equipment/directories/critical infrastructure/capacity, partnerships, emergency operations, response/recovery, and reporting. It also identifies the barangay body as the **Barangay Disaster Risk Reduction and Management Committee (BDRRMC)**. See [RA 10121](https://lawphil.net/statutes/repacts/ra2010/ra_10121_2010.html).

Accordingly:

- Use “BDRRMC” or “authorized Barangay DRRM responder” in policy/UI copy after stakeholder approval. The current `BDRRMO` enum can remain temporarily as an internal compatibility value.
- Treat MDRRMO as the municipal operational owner, with Mayor/LCE oversight as locally authorized—not as a generic social-media hierarchy.
- Add EOC/incident roles rather than relying on a permanent account role to describe every operational responsibility.
- Capture duty shifts, handover, incident assignments, and accountable approvals.

The 2024 National Disaster Response Plan uses the cluster approach and Incident Command System and expects local plans to translate national arrangements. Its references include EOC, incident-management-team interoperability, emergency alert/warning, and standardized messages. See the [NDRP 2024](https://ndrrmc.gov.ph/attachments/article/4125/National_Disaster_Response_Plan_NDRP_2024.pdf) and [NDRRM Operations Center SOPG 2024](https://ndrrmc.gov.ph/attachments/article/4125/NDRRMOC_SOPG_2024.pdf).

DisasterLink should therefore support, at minimum:

- An incident number and incident commander/lead.
- Operational period and duty status.
- Objectives, actions, assignments, decisions, and handover notes.
- Resource/team requests and deployment.
- Situation reports with cut-off time and data sources.
- Escalation/referral to provincial, regional, or national partners.
- Warning source, approval, dissemination checklist, update/cancel, and delivery evidence.

It does not need to recreate every ICS form in the first release. It does need a data model that will not block later alignment. ISO 22320 is a useful incident-management design reference for roles, tasks, resources, and joint coordination; see [ISO 22320:2018](https://www.iso.org/standard/67851.html).

DILG's Operation L!STO materials provide hazard-specific, step-by-step preparedness guidance for LGUs before, during, and after emergencies. DisasterLink screens and checklists should be configured from Minglanilla's approved plans and the applicable L!STO manual—not from a generic software workflow. This includes critical preparedness actions, public warnings, drills, response, recovery, and post-disaster needs assessment where applicable. See the [DILG Operation L!STO DRR-CCA resources](https://lgrc.calabarzon.dilg.gov.ph/ppa-1-drr-cca-activities/) and a [current DILG explanation of the earthquake preparedness/recovery manual](https://region6.dilg.gov.ph/dilg-calls-on-lgus-to-maximize-lsto-manual-for-earthquake-preparedness-and-recovery/).

### 6.2 E-governance and citizen service

The E-Governance Act applies to LGUs and emphasizes citizen-centered, interoperable, resilient, accessible, secure, privacy-by-design digital government, including records/knowledge management and secure interfaces. Use it as a governance baseline rather than a reason to add superficial digitization. See [RA 12254](https://lawphil.net/statutes/repacts/ra2025/ra_12254_2025.html).

If DisasterLink becomes an official channel through which a citizen requests or receives a government service, the municipality should assess its obligations under RA 11032 and publish the applicable service definition, responsible office/person, requirements, processing time, feedback/complaint path, and escalation. See [RA 11032](https://lawphil.net/statutes/repacts/ra2018/ra_11032_2018.html).

### 6.3 Security, continuity, and accessibility targets

Use these as verifiable engineering targets rather than logo-level “compliance” claims:

- **OWASP MASVS:** secure storage, cryptography, authentication, network communication, platform interaction, code quality, resilience, and privacy. See [OWASP MASVS](https://mas.owasp.org/MASVS/).
- **ISO 22301:2019 with Amd 1:2024:** business-continuity management target for governance, exercises, recovery, and continuous improvement. Certification is optional; tested continuity is not. See [ISO 22301:2019](https://www.iso.org/standard/75106.html) and its [2024 amendment](https://www.iso.org/standard/88412.html).
- **WCAG 2.2 Level AA:** accessible labels, contrast, focus, target sizes, reflow, error identification, screen-reader behavior, captions/transcripts, and reduced-motion support. See [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- **Secure software delivery:** protected branches, mandatory review, dependency and secret scanning, signed/reproducible releases where feasible, software inventory, environment separation, and documented vulnerability response.

For the app specifically, test large text, screen readers, one-handed use, low vision, low-end Android devices, intermittent 2G/3G-like connectivity, power loss, denied location/camera permission, and Cebuano/Filipino/English content. Emergency-critical information must never exist only as color, an icon, a map, audio, or video.

## 7. Minglanilla-specific operating fit

### 7.1 What local evidence suggests

Minglanilla has 19 barangays. Historic government situation reports show operational patterns such as 24/7 OpCen activation, advisories relayed to BDRRMCs by SMS, equipment/vehicle inventory and prepositioning, public information activity, and EOC alert-level activation. These are useful requirements because they show that the product must support shift work, multi-channel communication, readiness inventory, and time-stamped operational status—not only a public feed. See an [NDRRMC situation report referencing Minglanilla’s 24/7 OpCen and prepositioning](https://ndrrmc.gov.ph/attachments/article/4139/SitRep_no_07_re_TD_VICKY_as_of_26DEC2020.pdf) and an [NDRRMC situation report recording Minglanilla EOC Blue Alert](https://ndrrmc.gov.ph/attachments/article/4271/SitRep_No._4_for_TC_KRISTINE.pdf).

Government sources also document location-specific hazards and mitigation work, including a historical MGB identification of Tungkil as storm-surge prone and recurring flooding/drainage work around Calajo-an. These examples must not be converted into permanent app classifications without current technical validation; they show why source, date, version, and affected-area geometry matter. See [MGB Region VII’s Minglanilla reference](https://r7.mgb.gov.ph/pr-01-july-2015/) and the [Cebu Provincial Government’s Calajo-an flood-control project](https://www.cebu.gov.ph/13624/cebu-capitol-starts-p60-9m-river-control-drainage-projects-to-address-minglanilla-flooding/).

Use GeoRiskPH and the responsible agencies as authoritative inputs for current hazard/risk layers rather than manually invented overlays. See [GeoRisk Philippines](https://www.georisk.gov.ph/).

### 7.2 Local validation workshop required before pilot

The product team should not guess the following. Conduct one signed workflow/data-validation workshop with MDRRMO, selected BDRRMC representatives, Mayor/LCE representative, DPO, records officer, IT/system administrator, PIO, health/social welfare/engineering representatives as relevant, and emergency telecommunications contacts.

Validate:

1. Official organization names, account roles, authority, alternates, and duty shifts.
2. Who may acknowledge, verify, create an incident, assign a team, escalate, publish, update, cancel, pin, close, reopen, redact, and export.
3. Alert approval and source chain for flood, severe weather, earthquake/tsunami, landslide, fire, health, and other local hazards.
4. Operating alert levels and what each level changes in the system.
5. All 19 barangay names, PSGC codes, official polygons, contacts, and escalation destinations.
6. Official hotlines, facilities, evacuation centers, capacity, accessibility, services, owner, and verification interval.
7. Response targets and coverage hours. Never promise 24/7 monitoring unless staffing and handover actually provide it.
8. Required SitRep fields, cut-off schedule, signatories, recipients, and formats.
9. Public versus restricted fields, particularly precise coordinates, vulnerable persons, contact data, medical details, and media.
10. Records series, retention/disposition, legal holds, and export classification.
11. SMS/push/social/radio/PA-system/manual fallback procedures and who records completion.
12. Continuity targets, alternate EOC, provider ownership, escalation contacts, RTO/RPO, and manual fallback.

## 8. Recommended target operating flows

### 8.1 Resident observation and emergency flow

1. User sees verified emergency contacts and active official warnings before login.
2. If immediate danger is declared, the app offers 911/local call actions and short safety instructions first.
3. User submits the minimum viable observation: category, short description, and location/landmark. Media is optional and only captured when safe.
4. The client assigns a stable local ID, stores a protected durable draft, and clearly says `Queued on this device` until server acknowledgement.
5. Server validates municipality/geometry, input limits, authorization, rate limits, MIME/content, and idempotency.
6. User receives an official reference only after server acceptance.
7. The system routes by polygon and operational rules; it does not declare the observation verified.
8. An assigned official acknowledges it, records triage, requests clarification if needed, and links it to an existing or new incident.
9. The resident receives meaningful status updates without receiving restricted operational notes.
10. Closure distinguishes “report handled” from “incident resolved,” and the resident can provide feedback/correction.

### 8.2 Official triage and incident flow

1. Duty queue sorts first by unacknowledged/severity/age, not popularity.
2. Authorized barangay staff acknowledge in scope and record a triage category.
3. They corroborate through call, media, other reports, field team, sensor, or agency information and record the basis.
4. Duplicate observations are linked; original records remain intact.
5. An authorized official creates/updates the incident, assigns lead/team, objectives, actions, and resource needs.
6. Escalation records reason, requested capability, destination, time, and acceptance—not just a color/status.
7. MDRRMO coordinates municipal action and external referrals through the approved EOC/ICS arrangement.
8. Each operational period has a handover and SitRep snapshot.
9. Closure requires outcome, remaining risks, responsible approver, public message where applicable, and follow-up/recovery actions.

### 8.3 Official alert flow

1. Warning data is received from an approved source or an authorized local observation.
2. Operator selects a controlled template and affected geometry/barangays.
3. System records source, sent time, effective/onset/expiry, urgency, severity, certainty, instructions, and contacts.
4. A server-enforced approval rule applies according to hazard/SOP; emergency override is named and audited.
5. Publish creates one immutable version and targets in-app, push, SMS/manual channels as authorized.
6. Dashboard displays sent/delivered/failed/acknowledged and required manual-channel completion.
7. Updates reference the prior alert; expiry or cancellation is explicit and propagated.

### 8.4 Evacuation and resource flow

1. MDRRMO opens/activates a validated center and assigns a manager.
2. Authorized center/barangay staff post time-stamped occupancy and capability updates.
3. Thresholds warn before “full,” including accessible spaces and critical supply constraints.
4. Resource needs become requests linked to an incident/center.
5. Dispatch and receipt are confirmed by accountable actors.
6. Public users see only approved capacity/status and directions; sensitive household/vulnerability details remain restricted.
7. Closure records remaining occupants, transfer, inventory return, issues, and after-action items.

## 9. Recommended role and permission model

| Role | Default authority |
|---|---|
| Public guest | Read approved emergency contacts, active alerts, and public facility/center data; no personal data. |
| Resident | Guest rights plus create/view own observations, receive follow-up, and engage where enabled. |
| Authorized BDRRMC responder | Scoped acknowledgement/triage and assigned incident actions for authorized barangay; no municipality-wide publication by default. |
| BDRRMC supervisor | Scoped approval, assignment, escalation, center updates, and local advisory publication per SOP. |
| MDRRMO duty officer | Municipality queue, incident coordination, assignments, resources, warnings as delegated, and SitRep drafting. |
| MDRRMO supervisor/head | Approval/override, municipal publication, incident closure/reopen, export/sign-off, access review. |
| Mayor/LCE authorized representative | Strategic dashboard and approvals defined by local SOP; not automatic unrestricted personal-data access. |
| PIO/alert publisher | Draft/publish/update/cancel communications within approved scope and templates. |
| DPO/privacy or authorized auditor | Read audit/privacy evidence needed for oversight; no operational editing. |
| Records officer | Classification, retention, legal hold, archival/disposition authorization; no incident-command authority. |
| System administrator | Accounts, configuration, health, integrations, and audit metadata; no default authority to read/edit report content. |

Implement permissions as explicit grants and organizational assignments rather than expanding one fixed role enum indefinitely. Keep RLS as the final enforcement layer.

## 10. Minimum target data changes

Do not implement all of these in one migration. Establish the domain split first, migrate safely, enable RLS before client access, and add policy tests with every table.

### P0 corrections to existing data

- Add active-status enforcement to authorization helpers and policies.
- Add official PSGC municipality/barangay codes and versioned polygon geometry.
- Add location accuracy, captured-at, source, and public-obfuscation fields.
- Add report category and evidence/provenance metadata.
- Replace destructive/edit-in-place behavior with revision/event records where official history matters.
- Add an append-only general audit event model with actor, purpose, target, before/after summary or event payload, device/session, and time.

### Core incident domain

- `incidents`: reference number, type, severity, priority, state, affected area, lead, opened/closed fields.
- `incident_report_links`: many observations to one incident, relationship, duplicate/master designation.
- `incident_assignments`: organization/user/team, role, period, accepted/released times.
- `incident_actions`: objective/task/decision/update, accountable owner, due/status, immutable history.
- `incident_escalations`: from/to, reason, capability requested, accepted/rejected, timestamps.
- `operational_periods` and `handover_notes`.

### Warning and notification domain

- Versioned alerts with CAP-aligned fields, source, affected geometry, approval, update/cancel references, and language variants.
- Channel deliveries/receipts, retry/dead-letter, deduplication, and manual-channel checklist.
- Device tokens and preferences with lifecycle timestamps and minimal metadata.

### Resource and evacuation domain

- Teams/personnel availability at a non-sensitive operational level.
- Vehicles/equipment/supplies with readiness, custodian, location, and last verification.
- Requests, allocations, dispatch, receipt, return, and loss/damage events.
- Center status snapshots, occupancy/capability summaries, manager, and verification time.
- Sensitive evacuee/household data should be a separate, narrowly authorized module only if MDRRMO/DPO approve a concrete need.

### Records and reporting domain

- Immutable SitRep/export snapshots, data cut-off, classification, preparer/approver, hash, and distribution log.
- Records classification, retention rule reference, legal hold, archival/disposition request and authorization.
- Do not permit client-side hard deletion of official records under ordinary roles.

## 11. Engineering quality findings from this review

### Static checks run on 1 August 2026

- `npx.cmd tsc --noEmit` **failed**. A type mismatch in `lib/announcements.ts` leaves the fallback query shape without the expected `upvote_count` and `comment_count` fields.
- `npx.cmd eslint . --no-cache` **failed** with five errors and eight warnings. Findings include a plain-JavaScript `scripts/expo-start.js`/`__dirname` issue, Deno Edge Function import-resolution issues that may require environment-specific lint configuration, unused imports/variables, and hook dependency warnings.
- The normal lint path also attempted to write Expo cache data and encountered the local permission environment; the no-cache run above still produced actionable lint results.
- No automated unit, integration, RLS, Edge Function, navigation, end-to-end, accessibility, load, or recovery tests were found.
- No CI workflow or production build/release configuration evidence was found.
- `npm audit --omit=dev` reported **19 production dependency advisories: 1 critical, 5 high, and 13 moderate**, mainly in transitive Expo/toolchain dependencies. The suggested automatic resolution includes a major Expo upgrade, so it should not be applied blindly. Triage reachability, select an Expo-compatible upgrade path, regenerate/verify the lockfile, and re-run builds/tests.

Other material engineering findings:

- The package application identifiers still use `com.yourcompany.disasterlink`; government ownership, signing keys, store accounts, deep-link domains, and environment identifiers must be established.
- `expo-secure-store` is available but authentication persistence and sensitive queued report content rely on AsyncStorage patterns.
- Temporary `file://` media references may not survive long retry periods or OS cleanup.
- A queued local report can reach a screen titled “Report Submitted” before server acceptance; copy must distinguish saved, uploading, accepted, and failed states.
- Storage validation should verify real content type/signature, size, duration, dimensions, and safe media processing—not only client-provided extension/path/metadata.
- Search, notification bell, flag, share, and some navigation affordances are decorative or incomplete. Remove or label unavailable actions until they work.
- Home links users to view hotlines on the map, but the map does not provide a hotline layer.
- Home’s map preview and “happening near you” experience do not yet show a reliable live local summary.
- The report title is described as optional by one migration name/history, while current client/server validation requires it. Make schema, API, copy, and documentation agree.

## 12. Delivery roadmap and acceptance gates

Time estimates should be produced only after the municipality answers the decisions in Section 7.2 and the team sizes each accepted story. Sequence is more important than optimistic dates.

### Gate 0 — Product and government ownership

**Goal:** authorize what the system is and who is accountable.

- Approve the intended service: situational-awareness/reporting pilot versus official dispatch/alert system.
- Name product owner, MDRRMO operational owner, DPO, records officer, technical owner, security incident contact, and provider owners.
- Approve terminology, role/authority matrix, coverage hours, emergency disclaimer, service targets, and escalation SOP.
- Validate official local data and authoritative hazard/warning sources.
- Complete an initial PIA, threat model, records inventory, data-flow diagram, and processor/hosting review.

**Exit evidence:** signed scope/RACI, approved workflows, data dictionary, privacy/records decisions, and pilot risk acceptance.

### P0 — Blockers before any public pilot

1. Fix active/suspended authorization across RLS/RPC/Edge Functions and revoke sessions on privilege change.
2. Add real official email proofing and MFA for privileged accounts.
3. Minimize public report/coordinate/identity exposure and audit sensitive access.
4. Implement official polygons/PSGC codes and strict server routing.
5. Remove mandatory photo+video, add emergency/public safety access, and correct queued-versus-accepted messaging.
6. Make offline drafts durable/protected and provide explicit retry/cancel state.
7. Fix TypeScript/lint failures and add baseline automated tests, especially RLS negative cases.
8. Restore map attribution, remove unrestricted remote-code behavior, and establish a supported provider/degraded mode.
9. Complete account suspension/recovery and audit basics.
10. Resolve or formally risk-accept dependency advisories after tested compatible upgrades.

**Exit evidence:** clean required checks; signed authorization test matrix; security review; device test report; no unresolved critical vulnerability without formal exception; pilot rollback procedure.

### P1 — Controlled situational-awareness pilot

- Separate observation, verification, workflow, escalation, and incident records.
- Add acknowledgement/triage/assignment, duplicate linking, resident contribution/status view, and correction/follow-up.
- Finish misinformation flag/moderation and safe feed ranking.
- Complete verified directory/center management and data freshness warnings.
- Deliver in-app notification inbox plus reliable push for non-life-critical updates.
- Add basic operational dashboard and a first immutable official export.
- Run a small selected-barangay pilot with trained duty staff and a parallel manual process.

**Exit evidence:** scenario exercise, delivery metrics, response-time data, DPO/records approval, accessibility checks, help/support path, and documented after-action corrections.

### P2 — Official warning and EOC integration

- Implement approved CAP-aligned alert lifecycle, source chain, approval, update/cancel, geographic targeting, and multi-channel evidence.
- Add incident roles, operational periods, actions, handover, resource requests/deployment, and SitRep generation.
- Add evacuation occupancy/capability snapshots with strict privacy separation.
- Establish observability, on-call procedures, provider SLAs, backup/restore, alternate communications, and recovery exercises.
- Perform independent penetration testing, load/resilience testing, and operational drills.

**Exit evidence:** MDRRMO-approved exercise showing source-to-alert-to-delivery-to-cancel; EOC handover/SitRep scenario; successful restore; remediation of material test findings.

### P3 — Mature government service

- Secure interoperability with approved LGU/provincial/national systems through versioned APIs.
- Records lifecycle automation and archive transfer where required.
- Expanded logistics/resource management only where operational evidence justifies it.
- Public transparency/open-data outputs using anonymized/aggregated data.
- Continuous performance, accessibility, privacy, security, continuity, and after-action improvement program.

## 13. Verification strategy

### Automated minimum

- TypeScript compile and environment-aware lint with zero errors.
- Unit tests for validation, state machines, ranking, geometry, and redaction.
- Supabase local integration tests for every role/scope/status and every CRUD/RPC/storage action.
- Edge Function contract tests for auth, replay/idempotency, rate limits, malformed media, out-of-bound coordinates, and provider failure.
- Navigation/deep-link tests for resident, official, admin, expired invite, suspended user, and stale session.
- End-to-end resident report, offline retry, official triage, incident link, notification, and export flows.
- Accessibility checks plus manual screen-reader/large-text verification.
- Dependency, secret, static analysis, migration drift, and build checks in CI.

### Operational exercises

- Network loss during every report/media stage and during an alert update.
- 1,000+ residents attempting to load alerts/map and burst-reporting after a severe event, with agreed capacity targets.
- SMS/push provider outage, delayed receipts, duplicate delivery, and expired tokens.
- Supabase/database outage and recovery from backup to the approved RPO/RTO.
- Lost/stolen official phone, suspended account with active session, and role/scope transfer.
- False/duplicate viral report and coordinated abuse of upvotes/comments/flags.
- Wrong barangay GPS near a boundary and a point outside Minglanilla.
- EOC shift change with open incidents, resource requests, and an active alert.
- Alert update/cancel across in-app, push, SMS/manual dissemination.
- Records hold/export followed by an authorized disposition request.

### Government pilot acceptance examples

- Given a suspended official with a valid cached session, every protected direct query, storage action, RPC, and Edge Function denies access and writes a security audit event where appropriate.
- Given an unsafe/no-bandwidth situation, a resident can submit a minimal observation without photo/video and sees whether it is queued or server-accepted.
- Given two reports about one flood, an official can preserve both originals, link them to one incident, assign an action, and show residents a privacy-safe update.
- Given an official PAGASA warning, an authorized operator can record its source, target affected barangays, obtain required approval, publish, see channel delivery results, and later update/cancel it without deleting history.
- Given the map service is unavailable, verified contacts, active alerts, centers, and a list-based reporting/location fallback remain usable.
- Given a SitRep cut-off, the export reproduces an immutable approved snapshot and its hash/reference can be verified later.

## 14. Product decisions that should replace parts of the rough scope

These are deliberate recommendations, not omissions:

1. **Do not require both live photo and video.** Safety, accessibility, and speed matter more than a false sense of authenticity.
2. **Do not call every resident report an incident.** Keep observations immutable and aggregate them into official incidents.
3. **Do not auto-verify official posts.** Record official source separately from corroboration.
4. **Do not use engagement as the primary disaster relevance signal.** Authority, geography, severity, verification, and freshness come first.
5. **Do not make the Mayor role a universal superuser.** Strategic oversight does not automatically establish a need to see all personal information.
6. **Do not make system administrators operational superusers.** Separate system maintenance from emergency authority.
7. **Do not promise account/report deletion without a records rule.** Support lawful correction, restriction, anonymization, archival, and authorized disposition.
8. **Do not claim background upload, delivered notification, exact barangay, email verification, or official PDF until each is end-to-end proven.**
9. **Do not treat an app-only notification as an early-warning system.** Use approved sources, multi-channel dissemination, delivery evidence, and manual fallbacks.
10. **Do not build multi-municipality administration unless it is actually required.** First make one municipality secure and operationally coherent.

## 15. Final recommendation

Continue with the existing Expo/Supabase architecture; it is appropriate for the current team and already contains useful reusable patterns. A rewrite is not justified. The next milestone should also not be another broad UI expansion.

The correct milestone is a **government-controlled situational-awareness pilot** with:

- corrected authorization and privacy boundaries;
- public emergency information;
- safe low-friction resident intake;
- verified Minglanilla geometry and directories;
- an observation-to-incident domain split;
- accountable triage and audit;
- reliable status notifications;
- baseline automated and operational evidence;
- signed MDRRMO, DPO, records, and technical ownership.

Only after that pilot is exercised and measured should DisasterLink add official multi-channel warning, full incident-command coordination, resource deployment, and production-grade SitRep/records workflows.

## Appendix A — Primary repository evidence reviewed

The assessment traced, among others:

- Expo Router routes under `app/`, including resident, official, and admin layouts/screens.
- Resident and official flow hooks under `hooks/`.
- Supabase client helpers and domain modules under `lib/`.
- Shared components and screen styles under `components/` and `styles/`.
- All local Supabase migrations under `supabase/migrations/`.
- Edge Functions for authentication, reports, invites, announcements, and SMS under `supabase/functions/`.
- Package scripts/dependencies, TypeScript, ESLint, and Expo configuration.
- `docs/context.md` as product intent, not as proof of completed behavior.

## Appendix B — Standards/reference register

- [Republic Act No. 10121 — Philippine Disaster Risk Reduction and Management Act](https://lawphil.net/statutes/repacts/ra2010/ra_10121_2010.html)
- [National Disaster Response Plan 2024](https://ndrrmc.gov.ph/attachments/article/4125/National_Disaster_Response_Plan_NDRP_2024.pdf)
- [NDRRM Operations Center SOPG 2024](https://ndrrmc.gov.ph/attachments/article/4125/NDRRMOC_SOPG_2024.pdf)
- [Republic Act No. 10639 — Free Mobile Disaster Alerts Act](https://lawphil.net/statutes/repacts/ra2014/ra_10639_2014.html)
- [PAGASA products and services](https://www.pagasa.dost.gov.ph/products-and-services)
- [GeoRisk Philippines](https://www.georisk.gov.ph/)
- [NPC security circular overview](https://privacy.gov.ph/npc-issues-circulars-to-strengthen-personal-data-protection-in-ph/)
- [Data Privacy Act implementing rules and regulations](https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/)
- [Republic Act No. 9470 — National Archives of the Philippines Act](https://lawphil.net/statutes/repacts/ra2007/ra_9470_2007.html)
- [National Archives ERMP primer](https://nationalarchives.gov.ph/wp-content/uploads/2025/04/ERMP-PRIMER25.pdf)
- [Republic Act No. 12254 — E-Governance Act](https://lawphil.net/statutes/repacts/ra2025/ra_12254_2025.html)
- [Republic Act No. 11032 — Ease of Doing Business and Efficient Government Service Delivery Act](https://lawphil.net/statutes/repacts/ra2018/ra_11032_2018.html)
- [PSA PSGC — Minglanilla barangays](https://psa.gov.ph/classification/psgc/barangays/0702232000)
- [ITU Common Alerting Protocol](https://www.itu.int/en/ITU-D/Emergency-Telecommunications/Pages/Common-Alerting-Protocol-and-Call-to-Action.aspx)
- [OWASP Mobile Application Security Verification Standard](https://mas.owasp.org/MASVS/)
- [DILG Operation L!STO DRR-CCA resources](https://lgrc.calabarzon.dilg.gov.ph/ppa-1-drr-cca-activities/)
- [ISO 22301:2019 — Business continuity management systems](https://www.iso.org/standard/75106.html)
- [ISO 22320:2018 — Emergency management, incident management](https://www.iso.org/standard/67851.html)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
