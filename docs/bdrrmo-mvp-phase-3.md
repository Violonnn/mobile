# BDRRMO MVP — Phase 3 status

## Completed

- BDRRMO now uses the shared official media composer rather than the legacy
  title/body form. It requires a description, retains the existing three-photo,
  one-video, and 30-second validation, and supports attachment previews,
  removal, submission feedback, and discard confirmation.
- BDRRMO can select **Pin in my barangay**. Municipal official roles retain a
  municipality-wide pin option in the same composer. Pinned posts continue to
  rank Mayor, MDRRMO, then BDRRMO before recency.
- All official publication now calls `create-official-announcement`; the
  client sends only description, selected media, and a boolean pin preference.
  It never sends author, barangay, title, or scope.
- The Edge Function accepts active BDRRMO, MDRRMO, and Mayor profiles and
  derives the stored scope, barangay, author ID, and role-specific title from
  the authenticated profile. A BDRRMO is always stored as a local
  `BDRRMO Announcement`.
- Announcement-media policies allow active official authors to upload only to
  their own private folder. The Edge Function verifies the folder and every
  uploaded path before it creates the post.
- Existing audience and moderation RLS rules continue to limit BDRRMO to
  municipal announcements plus its own barangay; residents receive municipal
  plus home-barangay posts, while municipal officials retain their operational
  view.
- The permission test now verifies BDRRMO announcement audience, pin order,
  and local-pin mutation authority.

## Deployment and verification

Apply the pending migrations and deploy the changed Edge Function:

```sh
npx supabase db push
npx supabase functions deploy create-official-announcement
```

Then verify with BDRRMO and resident accounts in two different barangays, such
as Tunghaan and Ward II:

1. Publish a photo or short video announcement and pin it as the BDRRMO
   assigned to Tunghaan.
2. Confirm Tunghaan residents and its BDRRMO see the local post after any higher-priority
   municipal pin.
3. Confirm the BDRRMO assigned to Ward II and its residents cannot load the local post or its private
   media, including through a copied URL.
4. Confirm a suspended BDRRMO cannot upload draft media or call the Edge
   Function, and that a client-supplied barangay/scope field is rejected.

Static verification: `npm run typecheck` passes. `npm run lint` should retain
only the eight documented baseline warnings. Supabase permission tests still
need a local Docker-backed Supabase instance in this workspace.

## Deferred

- The shared role-aware header and BDRRMO Settings are Phase 1 work.
- BDRRMO Resources/Map and evacuation-center operation are Phase 4 work.
- Push delivery, a functional notification inbox, formal warning workflows,
  analytics, and PDF exports remain intentionally unavailable for this MVP.
