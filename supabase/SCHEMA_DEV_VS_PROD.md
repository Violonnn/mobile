# DisasterLink Schema — Dev vs. Production Checklist

Covers the migrations `20250617000000` … `20250617000900` plus the later
`202607*` report/map/engagement projections (barangays/app_profiles,
officials/invites, reports/media/history, map data, announcements/engagement,
notifications/outbox, analytics/export, storage, create-report/map helpers,
`reports_map` engagement counts, `report_comments` + comments Realtime).
Read alongside [SECURITY.md](../SECURITY.md), which covers the resident phone/OTP/PIN flow.

## Apply order

Phase 4 resident/public cutover (5 November 2026) is **applied locally and to
hosted project `wkblsbtypaxvdgvkiopc` for owner-authorized Expo Go testing**:
`20261105000100_resident_public_cutover.sql`. It replaces resident source-report
access with limited public incident RPCs, adds incident discussion/support,
owner-only lifecycle/timeline projections, office snapshots, and safe response
notifications. Its 708 local pgTAP assertions and public-schema SQL lint pass.
All 13 hosted catalog/grant checks and read-only authenticated-role checks pass;
the 19 checked routine definitions match the tested local database fingerprint
`dd265846275cc59dcbcdf3f1377fb537`. Report/incident/evidence fingerprints and
existing audit/notification counts are unchanged. No hosted test fixtures were
created. The final dry run is up to date. Phone/R5 acceptance remains pending;
this is controlled testing, not operational release. Restart Metro and follow
[the Phase 4 phone checklist](../docs/phase4-expo-go-test-checklist.md).

New photo approval is intentionally disabled by the server and client until
location metadata removal is proven. Existing approvals are revoked; revocation
and sensitivity/location controls remain available. Free-text legacy source
comments require explicit lead-office screening before copying to the public
incident discussion. Mayor raw reports/evidence are unavailable; role-checked
aggregate charts remain usable while the Phase 5 replacements are pending.

Phase 3 official workflow (31 October 2026): migrations
`20261102000000_official_workflow_cutover.sql`,
`20261102000100_scope_official_edit_attribution.sql`, and
`20261102000200_keep_closed_reports_private.sql` are applied **locally and to
hosted project `wkblsbtypaxvdgvkiopc`** for owner-authorized Expo Go testing.
These migrations append the
report-map lifecycle columns; add authenticated, server-paginated office queues;
retain BDRRMO/supporter reads after transfer; scope content/location edits to the
lead-office rules; and add service-only atomic jurisdiction intake/routing.
No new table is introduced, and the Phase 2 operational-table RLS remains active.

The updated `create-report` function is deployed as version **7**, ACTIVE, with
JWT verification enabled; the Phase 3 migrations were applied first. The
existing `.env` targets this project, so restart Metro with `npm start -- --clear`
and reload Expo Go for manual testing. Thirteen hosted catalog/permission checks
pass, the routine fingerprint matches the tested local database, and existing
report/incident counts and states are unchanged. The final migration dry run is
up to date. G1/manuscript/R5 gates and authenticated visual/phone acceptance
remain pending before operational release. Version enforcement stays off.
Phase 3 has 513 passing local pgTAP assertions, including 49 new queue, routing,
and post-transfer authorization checks. Its public-schema SQL checker is clean.

Phase 2 report-response foundation (30 October 2026): migrations
`20261101000000`–`20261101001200` are implemented and applied **locally and to
hosted project `wkblsbtypaxvdgvkiopc`**. The updated `create-official-report`
function is deployed as version 6, ACTIVE, with JWT verification enabled.
The enum migration must commit before the remaining migrations use `closed`
and the new notification values. Deploy all ordered migrations before deploying
the updated `create-official-report` Edge Function. The new Edge Function requires
the atomic channel-aware RPC and deliberately has no direct-insert fallback.

Owner confirmed Phase 1 phone acceptance before the hosted rollout. All 27
report statuses were preserved; nine incidents, two pending legacy transfers,
and five historical municipal findings were reconciled. Sixteen hosted checks
pass, and the Phase 2 routine-definition fingerprint matches the tested local
database. The deployment generated no notification or history rows. No hosted
test fixtures were inserted. See `docs/report-response-flow-plan.md` and
`docs/changelogs.md` for the deployment record. Repeat a phone workflow against
the deployed backend to record the post-deployment smoke test.

For any additional environment, review the backfill's status reconciliation
and outstanding legacy-escalation query. A historical escalation without a
barangay stops the migration and must be routed first. No backfill invents
MDRRMO acceptance or outcome summaries. Public incident/storage cutover remains
in Phase 4; the Mayor activity chart retains four status buckets until Phase 5.

Local verification:

```bash
npm run test:rls
node --no-warnings --experimental-strip-types scripts/verify-report-flow-concurrency.ts
npx supabase db lint --local --schema public --level error
```

Migrations are timestamp-ordered and must run in sequence:

```bash
cd mobile
supabase db push          # or: supabase migration up
supabase gen types typescript --linked > lib/database.types.ts   # regenerate types
```

There is currently **no generated types file** in the repo — generate one after
applying so the client is typed against the new tables.

## Hard gate BEFORE applying migration 1 to a shared/prod DB

Barangay backfill is exact-name-match. Audit first:

```sql
select barangay, count(*) as n
from public.profiles
group by barangay
order by barangay;
```

Any value not matching a `public.barangays.name` row backfills to
`barangay_id = NULL`, and that resident silently drops out of their BDRRMO's
queue. Fix aliases/typos (or add a mapping step) before pushing. The canonical
19 names live both in the seed and in
[components/register/DetailsStep.tsx](../components/register/DetailsStep.tsx) —
keep them in sync.

## Environment-specific items (differ per environment)

| Item | Dev / local | Production | Notes |
|------|-------------|------------|-------|
| `DEV_OTP_BYPASS` secret | may be `true` for demos (logs OTP, skips SMS) | **must be unset / `false`** | Lives in [functions/iprogsms-hook/index.ts](functions/iprogsms-hook/index.ts). Over-flagged on purpose: a dev-only OTP bypass leaking into prod is exactly the past incident. Verify it is not set in prod secrets. |
| `SEND_SMS_HOOK_SECRET`, `IPROG_SMS_API_TOKEN` | test values | real approved-sender values | Per-project secrets, never committed. |
| `SUPABASE_URL` / `ANON` / `SERVICE_ROLE_KEY` | local stack values | project values | `service_role` only ever in Edge Functions / trusted server — never in the Expo bundle. |
| First mayor/admin (bootstrap) | seed a test admin via SQL editor | create once, manually, per env | See the bootstrap block in [migrations/20250617000100_officials_invites.sql](migrations/20250617000100_officials_invites.sql). Never hardcode a bootstrap account in a migration. |
| `barangays.centroid` | can stay NULL | populate real reference points | Needed for the nearest-centroid fallback when reverse-geocoding can't name a barangay. |
| Connection string | direct is fine locally | **Supavisor pooled** string for Edge Functions / long-lived clients | Pooling is provided by Supabase; just use the pooled URL. |

## service_role usage (must stay server-side)

`service_role` bypasses RLS and is granted full DML across the new tables. It is
used only by Edge Functions / the notification worker:

- `notification_outbox` has **no** authenticated policies — worker (service_role) only.
- Resident→`app_profiles` sync, `redeem_invite`, counter/fan-out triggers run
  `SECURITY DEFINER` and do not require the client to hold elevated rights.
- The Expo client uses the **anon** key + user JWT exclusively (see
  [lib/supabase.ts](lib/supabase.ts)). Do not add the service-role key to the app.

## Seed vs. real data

| Data | Seed (dev) | Real (prod) |
|------|-----------|-------------|
| `barangays` | seeded by migration 1 (names) | same names; add real `centroid` |
| `app_profiles` residents | via test registrations | via live registration (auto-synced from `profiles`) |
| officials/mayor/admin | seed test accounts + invites | bootstrap first admin, then invite-only |
| reports / media | throwaway test rows + test bucket objects | real submissions |
| hotlines / facilities / evacuation_centers | sample rows | real municipal data (MDRRMO-entered) |

Reports and announcements use **status transitions / soft hiding, never hard
DELETE**. This keeps the Supabase Realtime DELETE exception (delete events are
not RLS-filtered; the old-record payload is PK-only when RLS is on) a non-issue.
If a "delete test report" admin action is ever added, revisit Realtime exposure
first.

## Storage (`report-media` bucket)

- Bucket is **private**. Path convention: `{reporter_user_id}/{report_id}/{media_id}.{ext}`.
- Display + PDF export use **signed URLs**, not public URLs.
- Supabase Storage edge-caches objects — no separate CDN needed.
- Media rules (1–3 photos + ≥1 video, combined ≤30s) are enforced at the data
  layer by deferred constraint triggers. The step-based report flow uses
  live camera capture only (no gallery): photos one at a time up to 3, and one
  or more recorded clips whose combined duration is validated client-side from
  each asset's real duration to stay ≤30s. The DB can't tell captured from picked
  media, so the count/duration rules above are the source of truth. Title is
  optional; description is required.

## Expo push notifications (SDK 54)

- Android **Expo Go cannot receive remote push** (deprecated SDK 52, removed
  SDK 53+). Only **local** notifications work in Expo Go on Android.
- iOS Expo Go remote push still works (EAS auto-configures it).
- **Android remote push must be tested with a development build** (`eas build
  --profile development`), not Expo Go.
- `push_tokens.platform` lets the worker skip/special-case devices. Register
  local notifications regardless so Android-in-Expo-Go still gets in-app alerts
  during dev.

## Query timeouts

- `authenticated` role: `statement_timeout = '5s'` (migration 1) for interactive
  screens (feed, map, officer queue, home).
- PDF export runs through `export_report()`, which re-checks caller scope. The
  export **Edge Function must raise `statement_timeout` on its DB session as a
  separate statement** before calling it (a `SET LOCAL` inside the function
  cannot extend the already-armed in-flight call):

  ```ts
  await sql`set statement_timeout = '60s'`;      // own statement
  await sql`select public.export_report(${reportId})`;
  ```

  Do **not** raise the global `authenticated` role timeout for export. Tune both
  once real query shapes/volume exist.

## Rate limiting

- OTP limits already exist server-side (see SECURITY.md).
- Extend the same pattern to **report creation** in the create-report Edge
  Function/RPC (sliding window or last-submission check per `app_profiles`)
  before insert — a real disaster is exactly when duplicate/panic submissions
  spike.

## Post-apply verification

- Security Advisor: RLS enabled + policies present; function `search_path`
  pinned; no unexpected public EXECUTE.
- `EXPLAIN` an officer queue query hits `idx_reports_barangay_status_created`.
- Insert/delete an upvote and a comment → `reports.upvote_count` /
  `comment_count` move correctly.
- Realtime: `reports` and `comments` are in the `supabase_realtime`
  publication. Map clients subscribe to `reports` (and patch counter-only
  updates in place). Comment sheets subscribe to `comments` filtered by
  `report_id` only while open. A BDRRMO subscription filtered to their
  `barangay_id` receives only their barangay's report changes.
- Invite redemption is single-use (second attempt on the same token fails).
