# BDRRMO MVP — Phase 0 status

## Completed

- Added `has_active_profile()` as the shared database authorization predicate.
- Updated official role helpers so suspended profiles fail BDRRMO, MDRRMO,
  Mayor, admin, municipality-management, and official checks immediately.
- Scoped BDRRMO access to its own barangay for reports, report media/history,
  report engagement/comments, local resources, evacuation centers, local
  announcements, and private published announcement media.
- Kept municipality-wide resources available to BDRRMO where the MVP permits
  them, while blocking local-record access across barangays.
- Restricted announcement publication to the server-side Edge Function.
- Added an active-resident check to the resident report Edge Function.
- Added pgTAP coverage for active BDRRMO, cross-barangay BDRRMO, suspended
  official, MDRRMO, Mayor, admin, and resident access.
- Added `typecheck`, `test`, and `test:rls` package scripts.

## Verification

Run the static checks:

```sh
npm run typecheck
npm run lint
```

`npm run typecheck` passes. Lint has no errors and retains these eight
pre-existing warnings: unused animation imports and missing animation-effect
dependencies in `app/index.tsx`; a missing `flow` effect dependency in
`app/invite.tsx`; a missing `detail` effect dependency in `app/official/[id].tsx`;
an unused `View` import in `components/report/MediaPreview.tsx`; a missing
`startEntranceAnimation` dependency in `components/ui/WelcomeModal.tsx`; and an
unused `parseEdgeFunctionMeta` import in `lib/login.ts`.

Run the database authorization test after Docker and the local Supabase stack
are available:

```sh
npx supabase start
npm run test:rls
```

The RLS test is [active_profile_authorization.sql](../supabase/tests/active_profile_authorization.sql).

## Deferred to later phases

- BDRRMO shell, shared header/context, Settings, Command cards, and the
  unavailable-notification message (Phase 1).
- Report list/detail UI, transition confirmation, and realtime queue work
  (Phase 2).
- BDRRMO media composer and server-derived local announcement creation
  (Phase 3).
- Scoped Map/Resources UI and compatible deep-link handling (Phase 4).
- Cross-role device smoke checks and MVP handoff exercises (Phase 5).
