# DisasterLink Media Egress and Performance Audit

- Audit date: September 15, 2026
- Scope: Supabase Storage delivery, report and announcement feeds, maps, uploads, device memory, and rendering performance
- Status: Investigation and implementation guide; no application behavior is changed by this document

## Bottom line

The current Supabase usage problem is media delivery, not normal database traffic.

From the supplied Usage screenshot:

- Uncached egress used: **4.53 GB of 5 GB**, or about **90.6%**.
- Uncached egress remaining: about **0.47 GB / 470 MB**.
- Storage Egress accounts for about **99.1%** of the measured usage.
- At roughly 1 GB on each of the recent high-usage days, the remaining allowance can be consumed in less than one active test day.

Supabase currently gives Free organizations separate **5 GB uncached** and **5 GB cached** egress quotas. Egress already served cannot be recovered by deleting files; it resets at the next billing cycle. The exact reset date must be read from the organization's Usage/Billing page, not inferred from the chart dates. See [Supabase: Manage Egress Usage](https://supabase.com/docs/guides/platform/manage-your-usage/egress) and [Supabase: Bandwidth and Storage Egress](https://supabase.com/docs/guides/storage/serving/bandwidth).

The repository audit found several strong explanations for the Storage usage:

1. Feed cards generate video thumbnails from the **remote original video URL**. A user can therefore cause a Storage video request without pressing Play.
2. The resident feed fetches **every authorized report and every attachment** before displaying only six reports.
3. Map loaders use the same media-heavy report query even though a map pin normally needs only coordinates and small text fields.
4. Official report queues load up to 100 reports, sign every attachment with per-report requests, and also sign the first photo separately.
5. A new signed URL is created on reload. Supabase documents that different signed tokens are separate CDN cache keys, so continuously re-signing the same object reduces cache reuse.
6. Report photos are quality-reduced but not resized by pixel dimensions. Announcement photos are uploaded without a compression or resize step, and announcement attachments are converted to Base64 in memory.
7. Remote report media uses React Native `Image`, while the already-installed `expo-image` caching path is used only for profile pictures.
8. Several feeds render many cards through `ScrollView` plus `.map()` instead of a virtualized list, so off-screen media can remain mounted and decoded.

The highest-impact solution is simple: **feeds and maps must receive small, stored thumbnails only; an original photo or video must not be requested until the user opens its detail view, and video must not be requested until the user presses Play.**

## What is confirmed and what still needs measurement

### Confirmed by the Supabase dashboard supplied with this request

- Storage is the dominant egress source.
- The uncached egress quota is almost exhausted.
- Deleting stored objects will not reverse bandwidth already transferred.

### Confirmed by the current repository

| Finding | Current evidence | Effect |
| --- | --- | --- |
| Remote video is used to create a feed thumbnail | `components/report/ReportDetailCard.tsx` calls `VideoThumbnails.getThumbnailAsync(uri)` at 500 ms | Likely creates a ranged or full request against the original video before Play |
| Resident feed loads all reports | `app/(main)/feed.tsx` calls `useReports({ loadAll: true })`, then slices display data to six | Extra database work, signed URLs, JavaScript objects, and opportunities to mount media |
| Home also loads all reports | `app/(main)/home.tsx` calls `useReports({ realtime: true, loadAll: true })` | Duplicates a large data set and keeps a live reload path active |
| Map query includes all attachment URLs | `lib/reports.ts` signs media inside `fetchMapReports`; resident and official map screens call `useReports` | Map payload is much heavier than marker rendering requires |
| Report page size is large | `lib/reports.ts` uses a 200-report page and can loop through every page | Slow first load and high memory growth as the project accumulates reports |
| Official queue signs media with an N+1 pattern | `lib/officialReports.ts` runs `signReportMedia` for each of up to 100 reports and separately runs `signFirstQueuePhotos` | Many Storage signing calls and duplicate signing of first photos on every reload |
| Announcement list signs every attachment | `lib/announcements.ts` signs all media for up to 20, 40, or 50 announcements | Summary screens receive full-media URLs that they do not need |
| Reloads create new one-hour signed URLs | `lib/reports.ts`, `lib/officialReports.ts`, and `lib/announcements.ts` call `createSignedUrls(..., 3600)` with no shared URL cache | New token URLs weaken both device-cache and CDN-cache reuse |
| Report images use React Native `Image` | `components/report/ReportDetailCard.tsx` imports `Image` from `react-native` | No explicit shared cache policy or stable storage-path cache key |
| Hidden hero slides remain mounted | `components/official/ResidentFeedFeaturedHero.tsx` maps every slide and changes opacity | Several photos or remote-video thumbnail jobs may start even when only one slide is visible |
| Official updates are not virtualized | `app/(main)/feed.tsx` maps as many as 50 announcements inside a `ScrollView` | Off-screen cards and media stay mounted |
| Official report queue is client-sliced | `app/official/community.tsx` and `components/official/MdrrmoCommunityFeed.tsx` slice an already-loaded queue | “Show more” changes rendering only; it does not reduce the server fetch |
| Report photo dimensions are not capped | `lib/reportMedia.ts` sets camera `quality: 0.7` but performs no resize | A compressed 12 MP image still has a large transfer and decoded-memory cost |
| Video bytes are not capped | Client and Edge Functions validate 30 seconds, but `report-media` and `announcement-media` migrations do not set bucket file-size or MIME restrictions | A short high-bitrate video can still be large |
| Announcement uploads use Base64 | `lib/announcementMedia.ts` reads the complete file as Base64 before upload | Base64 adds memory overhead and can cause pauses or crashes on low-memory devices |
| The app does not use React Query | `package.json` and the source contain no TanStack/React Query dependency | Repeated fetches come from separate custom hook instances, not React Query defaults |

Creating a signed URL is not itself the large byte transfer. Egress occurs when an image, video player, thumbnail generator, or other client performs a Storage GET. Bulk signing still matters because it increases work and produces changing URLs that the UI can request and cache poorly.

### Positive behavior that should be preserved

- Report and announcement evidence buckets are private and protected by Storage RLS policies.
- The mobile client does not contain a Supabase service-role key.
- Report uploads already use `ArrayBuffer` instead of Base64.
- Report capture already limits combined video duration to 30 seconds and photos to three.
- Full remote video playback is placed in the preview modal rather than autoplayed directly in every card.
- Profile photos are already cropped and resized to 512 x 512 JPEG and use an immutable UUID path. Profile pictures are not the priority problem.
- Local report media is persisted for offline retry and cleaned up through report-specific helpers.

## Why the current flow is expensive

The current high-risk path is:

```text
Screen loads or reloads
  -> query many reports/announcements
  -> query every attachment row
  -> create a new signed URL for every original object
  -> render multiple cards or hidden hero slides
  -> photo view requests original photo
  -> video thumbnail code requests original video
  -> Storage bytes count as egress
```

On Supabase, every distinct signed token is a distinct CDN cache key. Supabase explicitly warns that generating a new signed URL on every request prevents that URL's cache from becoming warm. Smart CDN improves this behavior, but Smart CDN is currently a Pro-plan feature. See [Supabase: Smart CDN and signed URL caching](https://supabase.com/docs/guides/storage/cdn/smart-cdn).

On the device, a signed URL is also a poor default image cache identity because its token changes. `expo-image` supports a stable custom `cacheKey`, disk caching, memory caching, and recycling keys. See [Expo Image](https://docs.expo.dev/versions/latest/sdk/image/).

A compressed image's file size is not its decoded memory size. A 4000 x 3000 photo can require roughly 48 MB as a 4-byte-per-pixel bitmap, before component and cache overhead. Several mounted originals can exhaust a low-end Android device even if each JPEG is only a few megabytes.

## First: identify the exact objects being downloaded

Run this in the Supabase SQL Editor with the query source changed to **Logs**. It is the diagnostic query published in the Supabase Storage egress documentation:

```sql
select
  log_attributes['request.method'] as http_verb,
  log_attributes['request.path'] as filepath,
  (log_attributes['response.headers.cf_cache_status'] = 'HIT') as cached,
  count() as num_requests
from logs
where source = 'edge_logs'
  and (
    log_attributes['request.path'] like '%storage/v1/object/%'
    or log_attributes['request.path'] like '%storage/v1/render/%'
  )
  and log_attributes['request.method'] = 'GET'
group by http_verb, filepath, cached
order by num_requests desc
limit 100;
```

For the top paths, record:

- Bucket: `report-media`, `announcement-media`, or `profile-photos`.
- Object type and stored byte size.
- Request count.
- Cache HIT or MISS.
- Which test action caused the requests: feed open, pull-to-refresh, map open, report detail, or video Play.

Estimate each object's contribution with `stored bytes x request count`. Repeat one controlled flow at a time so the results are attributable. This is necessary to prove whether report videos, announcement videos, original photos, or a smaller repeated asset is the top offender.

Do not clear the app's media cache between ordinary tests. A cache clear deliberately forces cold downloads and increases egress. Use one cold-cache run only for the baseline, then test warm refresh and revisit behavior separately.

## Implementation order

### Priority 0: stop accidental original-video delivery

This is the fastest and most important egress reduction.

1. Add `thumbnail_storage_path` to `report_media` and `announcement_media`. Keep it nullable for legacy rows.
2. When a video is captured or selected, generate a small poster locally from approximately 500 ms, resize it to a maximum 480 px long edge, compress it, and upload it beside the video.
3. Store the poster path in the corresponding media row through the existing trusted report/announcement create flow.
4. Replace `VideoThumbnail` in `components/report/ReportDetailCard.tsx`. Feed, home, hero, queue, and map-summary UI must display the stored poster only.
5. For legacy videos with no poster, show a lightweight video placeholder. Do **not** fall back to generating a thumbnail from the remote original.
6. Resolve the original video URL only after the user taps the video. Mount one `VideoPlayer` in the open modal, and release it on close.

Why: a 100–160 KB poster is predictable. A 10–30 MB video is not. A 20 MB clip touched 20 times can transfer about 400 MB.

Acceptance checks:

- Opening, scrolling, refreshing, and reopening a feed causes **zero GET requests for original video paths**.
- Opening a map causes **zero GET requests for report videos**.
- One original video request begins only after Play.
- At most one remote video player exists at a time.

### Priority 1: create and serve purpose-sized image derivatives

Use three roles for report and announcement photos:

| Asset | Starting target | Used by |
| --- | --- | --- |
| Thumbnail | 480 px long edge, JPEG/WebP, target 100–160 KB | Feed cards, home, map preview, official queues, hero |
| Display image | 1600 px long edge, JPEG/WebP, target at or below 1.5 MB | Full-screen/detail viewing on phones and tablets |
| Original evidence | Existing captured file, private, never used in a list | Explicit evidence/export workflow only if retention policy requires it |

These are initial engineering budgets, not legal evidence-retention rules. Do not delete or replace original evidence until the project has an approved evidence and retention policy. If originals do not need forensic preservation, storing only the optimized display image can save Storage space, but that is a product/security decision rather than a performance shortcut.

For Free-plan projects, generate and upload derivatives once because Supabase on-demand Image Transformations are currently available on Pro and above. If the organization later upgrades, signed image transformations can replace some stored derivatives, but video posters and lazy playback are still required. See [Supabase: Image Transformations](https://supabase.com/docs/guides/storage/serving/image-transformations).

Implementation targets:

- `lib/reportMedia.ts`: resize captured photos with the already-installed `expo-image-manipulator`; create thumbnail and display variants; retain only local URIs and metadata in React state.
- `lib/announcementMedia.ts`: apply the same derivative process to gallery images and video posters.
- `components/report/ReportDetailCard.tsx`: use thumbnail URLs in all card/collage contexts and the display URL only inside the open photo preview.
- `components/home/HomeUpdateCard.tsx` and `components/official/ResidentFeedFeaturedHero.tsx`: use only thumbnail assets.
- `lib/reports.ts`, `lib/announcements.ts`, and `lib/officialReports.ts`: return storage paths and dimensions appropriate to summary versus detail responses.

### Priority 2: enforce media byte and type limits

Duration alone does not control video size. Start with the following delivery budgets and adjust only after testing real Android and iOS captures:

| Media | Target | Hard rejection starting point |
| --- | --- | --- |
| Photo thumbnail | <= 160 KB | 300 KB |
| Photo display image | <= 1.5 MB | 2 MB |
| Video poster | <= 160 KB | 300 KB |
| 30-second playback video | 720p H.264/AAC, ideally <= 15 MB | 20 MB |

Required enforcement:

1. Reject over-budget media on the client before upload with clear copy and a Retake/Choose another action.
2. Add bucket-level `file_size_limit` and `allowed_mime_types` for `report-media` and `announcement-media` in a migration. Existing accepted iOS types such as `video/quicktime` must be handled deliberately rather than accidentally blocked.
3. Add `file_size_bytes`, `width`, `height`, `thumbnail_storage_path`, and, if retained, `display_storage_path` to both media tables. Make new columns nullable during legacy rollout.
4. Update the Edge Functions and report RPC to validate the submitted paths and server-observed Storage metadata. Never trust a client-supplied MIME type, dimensions, or byte count by itself.
5. Preserve RLS. Keep report and announcement evidence private; do not make these buckets public merely to improve CDN hit rates.
6. Roll out compatible clients before lowering a production bucket limit that existing captures may exceed.

Supabase recommends standard uploads mainly for files no larger than 6 MB and recommends resumable TUS uploads above that size. Evaluate TUS for accepted videos so interrupted mobile connections do not restart an entire large transfer. See [Supabase: Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads) and [Supabase: Bucket restrictions](https://supabase.com/docs/guides/storage/buckets/fundamentals).

The current `videoQuality: Medium` setting should stay as a capture hint, but it is not a reliable byte budget across every camera and platform. Reliable 720p/bitrate normalization requires either an approved native video-compression dependency or a trusted server/media pipeline. Until one is selected, enforce the byte cap and ask the user to retake an oversized clip rather than silently uploading it.

### Priority 3: separate summary queries from detail media

The data layer should stop placing full attachment URLs in every map marker and feed record.

Use two explicit shapes:

```ts
type MediaSummary = {
  id: string;
  type: 'photo' | 'video';
  thumbnailStoragePath: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
};

type MediaDetail = MediaSummary & {
  displayStoragePath: string | null;
  originalStoragePath: string;
  fileSizeBytes: number | null;
};
```

Apply the following boundaries:

- Map query: report ID, coordinates, status, title, time, and count only. Fetch one report's media summary/detail after a marker is selected.
- Resident community feed: server-side page of 10–15 report summaries. Do not use `loadAll: true` and then slice in memory.
- Home: request only the number of reports and announcements the screen can show.
- Official queue: server-side page of queue summaries with one thumbnail and media count. Remove `Promise.all(reportIds.map(signReportMedia))` and the duplicate first-photo signing.
- Report detail: fetch and sign all attachments for exactly one report.
- Announcement list: fetch one thumbnail summary per announcement. Fetch all announcement attachments only when its detail sheet opens.

Prefer cursor/keyset pagination using the active sort's timestamp plus ID. Offset pagination is acceptable for the first localized fix, but the network query must still honor the requested page size. Search and status/scope filters should run in Supabase rather than after loading all rows.

The activity-sorted resident feed currently reads large status-history and official-comment result sets and computes latest activity on the client. Move `latest_activity_at` into a safe server-side view/RPC or a trigger-maintained report column, then paginate by it. Any new view must use the repository's security-invoker pattern, and all base tables must keep RLS enabled.

### Priority 4: reuse signed URLs and stable device cache keys

Add one shared media URL resolver because reports and announcements currently duplicate this logic.

Required behavior:

- Cache signed URLs in memory by `bucket + storage path + variant` until shortly before their one-hour expiry.
- Batch only paths needed by the current page or open detail.
- Do not create a new signed URL during harmless rerenders.
- Never log signed URLs or store them as permanent database values.
- On sign-out, clear the in-memory signed URL cache.
- Continue to use immutable UUID object paths; upload a changed asset to a new path.

For remote photos/posters, create a small shared component backed by the already-installed `expo-image` package:

- Set `source.cacheKey` from the stable bucket and storage path, not the signed URL token.
- Use `cachePolicy="disk"` for feed thumbnails as the low-memory default. Test `memory-disk` only where repeated decode speed materially helps.
- Set `recyclingKey` to the media ID/path in virtualized rows.
- Use `contentFit`, a fixed aspect ratio, a placeholder, and an error fallback so layouts do not jump.
- Render the stored thumbnail dimensions; never decode an original 12 MP photo into a small card.

For an explicitly played video, pass a `VideoSource` with `useCaching: true` on Android/iOS and reuse the current signed URL while valid. Set a bounded app video cache, such as 128 MB, once before any player is created; Expo's default preferred cache size is currently 1 GB. Keep in mind that the OS may evict this cache. See [Expo Video caching](https://docs.expo.dev/versions/latest/sdk/video/#caching-videos).

Do not set a one-year browser/CDN TTL for private incident evidence without reviewing moderation/takedown requirements. A one-hour cache TTL is a safer initial value for evidence that an official may need to remove. Signed URL expiry and response cache TTL are separate controls.

### Priority 5: virtualize lists and keep inactive screens quiet

Current resident community reports already use `SectionList`, but official updates use a `ScrollView`, and official community content is client-rendered after loading much larger arrays.

Changes:

- Use `FlatList`/`SectionList` for both report and announcement feeds.
- Start low-end tuning with `initialNumToRender` around 4–6, `maxToRenderPerBatch` around 4–6, and `windowSize` around 5–7; measure before fixing final values.
- Use `removeClippedSubviews` on Android only after testing modals, shadows, and absolute-positioned media because clipping can cause visual regressions.
- Memoize media-heavy cards only after props and callbacks are stable.
- Mount only the current hero slide and, at most, one prepared next thumbnail. Do not mount all hidden slides.
- Load the next page near the list end, show a footer spinner, and expose a retry action after a page failure.
- Cancel or ignore stale page/signing requests when filters, tabs, or screens change.

`useReports` and `useOfficialReportQueue` create Realtime subscriptions in normal effects, while screen data is reloaded on focus. With mounted tab screens, separate Home, Map, and official views can retain their own copies and subscriptions. Make subscriptions focus-scoped, or introduce one shared report cache/provider for screens that genuinely share the same query. Realtime events should patch a changed record or invalidate one page/detail; they should not reload and re-sign the entire media collection.

### Priority 6: remove upload memory spikes

Preserve the report upload's existing `ArrayBuffer` path and apply the same approach to announcement attachments. Remove the announcement Base64 conversion.

On low-memory devices:

- Process and upload one large media item at a time, or use a concurrency limit of two for small photos.
- Never keep Base64 strings or full media bytes in React state; store local URI plus metadata only.
- Release each buffer before reading the next file.
- Show per-file and total upload progress.
- Persist prepared derivatives needed for offline retry, then delete only DisasterLink-owned draft files after success or explicit cancellation.
- Prevent duplicate submit taps and keep retries idempotent with the existing UUID paths.
- For videos above 6 MB, prefer resumable upload instead of restarting a standard upload after every connection drop.

## File-by-file implementation map

| File/folder | Required responsibility |
| --- | --- |
| `supabase/migrations/` | Add derivative paths and verified media metadata; add bucket restrictions; preserve/extend RLS policies |
| `supabase/functions/create-report/index.ts` | Validate new media contract, caller-owned paths, existence, server-observed size/type, and derivative relationship |
| `supabase/functions/create-official-report/index.ts` | Apply the same validation to optional official evidence |
| `supabase/functions/update-official-report/index.ts` | Preserve validation for media changes and immutable paths |
| `supabase/functions/create-official-announcement/index.ts` | Validate announcement originals/posters/derivatives and observed metadata before inserting rows |
| `lib/reportMedia.ts` | Prepare photo variants and video posters, enforce byte budgets, upload without Base64, clean local drafts |
| `lib/announcementMedia.ts` | Prepare announcement variants, remove Base64, enforce budgets, support reliable retry/cleanup |
| `lib/reports.ts` | Split map/feed summaries from single-report media detail; remove eager original signing; support real pagination |
| `lib/announcements.ts` | Return paged summaries and load all media only for one opened announcement |
| `lib/officialReports.ts` | Remove N+1 signing and duplicate first-photo work; page queue summaries; load originals in detail only |
| `hooks/useReports.ts` | Support paged summary loads, focused Realtime, request cancellation, and targeted invalidation |
| `hooks/useAnnouncements.ts` | Support paged summaries and targeted Realtime updates |
| `hooks/useOfficialReports.ts` | Keep queue summaries separate from detail and stop full queue reloads for every change |
| New shared media URL/cache utility under `lib/` | Batch and reuse signed URLs by bucket/path/variant with expiry and sign-out clearing |
| New shared remote media image under `components/` | Render `expo-image` thumbnails with stable cache keys, disk cache, placeholder, and error state |
| `components/report/ReportDetailCard.tsx` | Remove remote thumbnail extraction; thumbnails in lists; display media in detail; video only after Play |
| `components/official/ResidentFeedFeaturedHero.tsx` | Mount only the active/next thumbnail rather than every hidden media slide |
| `app/(main)/feed.tsx` | Real server pagination and virtualization for both tabs; no `loadAll` |
| `app/(main)/home.tsx` | Fetch only visible summaries; disable unrelated full-data Realtime reloads |
| `app/(main)/map.tsx` and `app/official/map.tsx` | Marker-only query; fetch one detail after selection |
| `app/official/community.tsx` and `components/official/MdrrmoCommunityFeed.tsx` | Server pagination and virtualized mixed feed |

## Security and behavior constraints

- Keep `report-media` and `announcement-media` private. Evidence access must remain authenticated and RLS-protected.
- Do not use the service-role key in the mobile app. Server-observed media validation belongs in trusted Edge Functions/RPCs.
- Do not weaken Storage read policies merely to obtain public CDN URLs.
- Treat signed URLs as temporary credentials: do not log, persist indefinitely, or include them in analytics.
- Derivative objects must live under the same owner/report or owner/announcement path and follow the same read/delete scope as their original.
- Reject paths containing traversal or objects outside the authenticated user's folder.
- Deleting a database media row must also remove its original and all derivatives through the Storage API; never delete only `storage.objects` metadata with SQL.
- A failed derivative upload must not publish a media row that points to missing assets. Cleanup partial uploads on cancellation/failure where safe.
- Preserve offline queued reports. Store all prepared local URIs and metadata needed for a later retry.
- Preserve current report limits and role rules. Performance work must not change who can view, submit, verify, escalate, resolve, or moderate a report.
- Provide loading, empty, retry, and partial-media-error states. A failed thumbnail must not remove the whole report or map.

## Verification plan

### Automated checks

Run the repository's existing commands:

```powershell
npm run test:unit
npm run typecheck
npm run lint
npm test
npm run test:rls
```

Add focused unit coverage for:

- Media byte/duration/count validation.
- Variant and poster path construction.
- Stable cache-key construction independent of signed tokens.
- Signed URL cache hit, expiry, batch, sign-out clearing, and failure behavior.
- Cursor pagination merge/deduplication.
- Summary mapping never exposes an original URL.
- Detail mapping returns only RLS-authorized media.
- Realtime updates patch one record without a full-media refetch.

Add RLS coverage for:

- Authenticated readers can view allowed evidence and derivatives.
- Anonymous users cannot read private report/announcement media.
- A user cannot upload, replace, or delete media in another user's folder.
- New file-size and MIME restrictions reject invalid objects.
- Official moderation behavior remains limited to the existing authorized scope.

### Manual network scenarios

Use a Free-plan test organization or a safe test project with representative media. Record Supabase Logs and device network traffic for each scenario.

1. Cold-open Home: only visible thumbnails and avatars download; no original video or original photo request.
2. Warm-reopen Home: cached thumbnails cause no device network request.
3. Open resident Community: only the first page loads; original-video GET count remains zero.
4. Scroll one page: only newly visible thumbnail paths download.
5. Pull-to-refresh without data changes: stable device cache keys prevent duplicate thumbnail downloads.
6. Open Map and pan: report-media GET count stays zero until a report detail is opened.
7. Open a report detail: display photo may load; original video still does not load.
8. Press Play: exactly the selected video begins transfer; closing stops playback and releases the player.
9. Replay the same clip: the bounded video cache is used where supported.
10. Trigger a Realtime status update: one record/page updates without re-signing every attachment.
11. Publish maximum allowed resident and announcement media on slow/interrupted data: progress, retry, and no duplicate rows/objects.
12. Attempt an oversized or invalid MIME upload: both client and server reject it with useful feedback.

### Device and smoothness matrix

At minimum test:

- Low-memory Android device, 2–3 GB RAM.
- Current mid-range Android device.
- Older supported iPhone.
- Current iPhone or iPad/tablet.
- Small screen, large font scale, light mode, and dark mode.
- Slow 3G/4G, unstable connection, Wi-Fi, offline, and reconnect.

Use React Native performance monitoring and Android Studio/Xcode profilers to check:

- JS/UI frame drops while scrolling media feeds.
- Native/JavaScript memory before scroll, after 50–100 cards, and after leaving the screen.
- Number of mounted image views and video players.
- Network bytes per screen open, refresh, page, photo detail, and video play.
- Temporary and persistent media-cache disk usage.

## Definition of done

This optimization is complete when all of the following are true:

- Feed, home, hero, queue, and map-summary screens never request original video files.
- Map screens do not sign or retrieve bulk report attachments.
- Original media is resolved only for one open detail, and video transfer begins only after Play.
- Resident and official feeds use real server pagination and virtualized rendering.
- Reopening or refreshing unchanged media uses a stable local cache identity despite signed URL changes.
- New report and announcement media has enforced type and byte limits on both client and Supabase Storage/server paths.
- Announcement uploads no longer create a full Base64 copy in memory.
- Private evidence buckets remain private with RLS enabled and verified by tests.
- The controlled before/after Supabase Logs comparison shows materially fewer Storage GETs, zero accidental video GETs, and a large reduction in transferred bytes per feed session.
- Low-memory device tests complete without an out-of-memory crash, runaway cache growth, or persistent scroll stutter.

## Expected result

The first three priorities should reduce egress by orders of magnitude for video-heavy feeds: tens of megabytes per visible video become roughly 100–160 KB poster requests, and repeated views can use the device's disk cache. Pagination and virtualization then keep startup time, JavaScript state, decoded image memory, and background work bounded as DisasterLink's report history grows.

Upgrading Supabase may provide more quota, Smart CDN, and image transformations, but it should not be treated as the primary fix. Without the application changes above, a larger quota only delays the same failure pattern.
