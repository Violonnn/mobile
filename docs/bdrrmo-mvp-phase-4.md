# BDRRMO MVP — Phase 4 status

## Completed

- BDRRMO and MDRRMO now use the Community / Resources switch. Existing
  `/official/resources` links redirect to the Resources section so bookmarks
  and older navigation remain compatible.
- BDRRMO uses the shared official header on Community, Resources, and Map. The
  header identifies the role and the assigned barangay name, for example
  `BDRRMO — Tunghaan`; it does not invent role suffixes such as “BDRRMO A”.
- The BDRRMO directory view shows all local hotline/facility records and only
  active municipality-wide records. The same distinction is enforced by RLS,
  not just the client query.
- BDRRMO can create, edit, activate, or archive only local hotlines and
  facilities. Facility coordinates continue to come from the existing map
  picker. The national emergency hotline is unavailable for BDRRMO editing,
  archiving, or creation both in the UI and in a database trigger.
- BDRRMO sees only evacuation centers assigned to its barangay and has only
  the status actions. The existing database trigger rejects metadata,
  barangay, capacity, location, and priority changes by BDRRMO.
- The official map now requests BDRRMO reports by assigned barangay, filters
  its Realtime subscription accordingly, and excludes device-local unsent
  resident reports. It includes local facilities, active municipality-wide
  facilities, and local evacuation centers. Report deep links outside the
  current scope show an unavailable message.
- BDRRMO Settings is available in the shared operational navigation and keeps
  its identity and barangay scope read-only.

## Deployment and verification

Apply the pending migrations before testing:

```sh
npx supabase db push
```

Verify with BDRRMO accounts assigned to Tunghaan and Ward II:

1. Open `/official/resources` as BDRRMO; confirm it redirects to Community’s
   Resources section.
2. Confirm Tunghaan BDRRMO sees Tunghaan records and active municipal records,
   but not inactive municipal or Ward II records.
3. Add or edit a Tunghaan facility using the map picker; try to submit a Ward II
   barangay ID directly and confirm the database rejects it.
4. Confirm the national emergency hotline has no BDRRMO edit/archive action;
   direct mutation and local national-emergency creation must also fail.
5. Change a Tunghaan evacuation center’s status. Attempt a priority, capacity,
   or center-name change through a direct request and confirm it is denied.
6. Open a Tunghaan report map link, then substitute a Ward II report ID and
   confirm the clear unavailable message.

Static verification: `npm run typecheck` passes. Run `npm run lint` before
deployment; Supabase permission tests require a local Docker-backed Supabase
instance in this workspace.

## Deferred

- Barangay polygons, hazard layers, and occupancy/capability tracking remain
  outside the MVP.
- Android/iOS device smoke checks, intermittent-connectivity checks, and full
  cross-role handoff verification remain Phase 5 work.
