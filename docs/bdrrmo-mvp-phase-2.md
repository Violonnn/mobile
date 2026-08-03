# BDRRMO MVP — Phase 2 status

## Completed

- The BDRRMO report queue uses the same officer search, filter, sort, card,
  loading, empty, error, retry, and pull-to-refresh format as MDRRMO.
- BDRRMO defaults to the Unverified queue while still retaining scoped history
  filters. Queue reads and Realtime subscriptions use the assigned barangay;
  RLS remains the database enforcement layer.
- Shared official report details provide the verified, local-resolution,
  escalation, MDRRMO reverification, and MDRRMO-resolution actions already
  supported by the status-transition RPC.
- Status actions require confirmation and accept an optional 500-character
  timeline note. Reporter-contact reveal remains purpose-confirmed and audited.
- BDRRMO official observations now show only the assigned barangay. The client
  always submits that scope, and the Edge Function/RPC independently enforce it.
- Added a status guard that prevents an already reverified report from being
  escalated by a stale or malicious BDRRMO client.

## Deployment and verification

Apply the pending migrations before testing the workflow:

```sh
npx supabase db push
```

Then verify these flows with test accounts:

1. Submit a resident report in the BDRRMO barangay; it appears in the BDRRMO
   Unverified queue and can be verified or locally resolved.
2. Verify and escalate it; it leaves the BDRRMO default actionable queue and
   appears in MDRRMO's Escalated queue.
3. Reverify and resolve it as MDRRMO; inspect actor, time, and optional note in
   the report timeline.
4. Attempt a report detail deep link, reporter-contact reveal, official report
   submission, and directory update outside the BDRRMO barangay. Each must be
   unavailable or denied by the backend.

Static verification remains clean: `npm run typecheck` passes and `npm run lint`
has the eight documented baseline warnings only.

## Deferred

- Shared role-aware header/context and BDRRMO Settings completion (Phase 1
  items not included in this Phase 2 change).
- BDRRMO local media announcements and pins (Phase 3).
- Scoped Resources/Map UI and deep-link routing (Phase 4).
- Device, connectivity, and full cross-role smoke exercises (Phase 5).
