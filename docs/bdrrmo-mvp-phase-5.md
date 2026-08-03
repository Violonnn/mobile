# BDRRMO MVP — Phase 5 handoff

## Automated verification

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript | Passed | `npm run typecheck` |
| ESLint and Edge Function lint | Passed with 8 existing warnings | `npm run lint` |
| Database permission tests | Blocked locally | Docker/local Supabase is not running at `127.0.0.1:54322` |
| Unit, component, and end-to-end tests | Not configured | `package.json` contains no runner beyond static checks and pgTAP |
| Android/iOS smoke checks | Not run | This Windows workspace has no connected emulator/device tooling |

`test:rls` now downloads the current Supabase CLI when it is absent. It still
requires Docker and a local Supabase stack:

```sh
npx supabase start
npm run test:rls
```

The pgTAP suite contains 25 assertions covering active/suspended accounts,
Tunghaan and Ward II barangay isolation, report handoff, announcement audience
and pin behavior, local resources, national-hotline protection, and
evacuation-center status-only authority.

## Cross-role exercise checklist

Run these checks only after applying all pending migrations and deploying the
changed announcement Edge Function:

```sh
npx supabase db push
npx supabase functions deploy create-official-announcement
```

1. Resident report → BDRRMO in the same barangay → Verify → Resolve locally.
   Confirm the timeline records every actor, time, and optional note.
2. Resident report → BDRRMO Verify/Escalate → MDRRMO Reverify/Resolve.
   Confirm the report leaves BDRRMO’s actionable queue and remains in history.
3. BDRRMO official observation → scoped queue → escalation to MDRRMO.
4. Tunghaan BDRRMO media announcement/pin → Tunghaan resident feed. Confirm
   Ward II accounts cannot read the post or signed attachment.
5. Tunghaan BDRRMO resource update → resident resource and map display.
6. MDRRMO center creation → assigned BDRRMO status update. Confirm BDRRMO
   cannot edit center metadata or priority.
7. Suspend a signed-in BDRRMO, then retry reports, resources, media, and center
   operations. Repeat with a BDRRMO assigned to a different barangay.
8. Sign in as a BDRRMO and open Command. Confirm the shared official header has
   its standard title treatment, the assigned-barangay unverified-report cards
   appear first with report titles matching the Unverified status color, the four
   status counts are stacked vertically below them, and no Quick Actions section
   is shown.

For the device pass, cover a small phone, large text, keyboard avoidance,
denied location, map failure, intermittent connectivity, and an expired session.
Record the device/build used and any failures beside this checklist.

## MVP stopping point

The BDRRMO implementation is ready for deployment and the manual cross-role
exercise. Do not present push notifications, a notification inbox, PDF exports,
barangay analytics, occupancy/capability tracking, authoritative hazard layers,
MFA, or CAP warnings as operational; they remain deferred MVP work.
