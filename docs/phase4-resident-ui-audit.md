# Phase 4 resident UI audit — 6 November 2026

Compared the resident screens with the original tracked layouts at `0fbf497`,
their existing style files, and the BDRRMO/MDRRMO map, feed and timeline patterns.
This correction restores those presentation patterns while retaining Phase 4's
limited public data and private source-report access.

## Findings and corrections

| Owner feedback / finding | Correction |
| --- | --- |
| Home's original nearby panel was replaced by a generic incident card | Restored the map hero, count badge, previous/next pager, compact status/title/location row, arrow action and accent update block using the original Home styles. Selecting a map area selects the panel item; the arrow opens details. |
| The connected timeline became one isolated status node | Restored connected milestone dots and labels. Progress comes from recorded lifecycle facts. Confirmation leaves Response ongoing pending; assessment never implies confirmation. Resolved summaries do not invent a completed response event. Legacy resolutions do not invent confirmation history. |
| Community gained a duplicate Incidents tab | Restored two tabs: Official updates and Community reports. The existing Community reports destination now displays the privacy-limited incident projection. |
| Community gained My reports despite Your contributions | Removed that tab. Private submissions remain in Map → Your contributions. Old private-report feed links redirect there. |
| The map's floating filters were replaced by a bottom sheet | Restored the original floating panel, switches, compact chips and collapse control. Added Community reports/status content alongside Your contributions, Facilities and Evacuation centers. The panel scrolls on short screens and allows more width with enlarged text. |
| The floating Barangay incident list duplicated Community | Removed the always-visible list button. The filter panel offers a smaller link for loaded reports without public map pins. It lists only no-coordinate cases; Community remains the main public list. |
| Approximate location appeared to describe an actual emergency extent | Removed the arbitrary 800-metre circles. Shading now represents the 0.01-degree coordinate rounding cell. Copy explicitly says location uncertainty, not incident extent or barangay boundary. |
| Generic incident tiles did not match the original Community feed | Public entries use a compact post layout with timestamp, official public text, status, location, progress and discussion action. A source reporter's avatar, identity, private description and original evidence are not substituted into public posts. |
| Nearby public map markers looked like green numbered circles | Public markers now use the incident type glyph on the current public status color, with a separate exclamation badge. Selected nearby incidents get a larger pulsing halo. Incidents sharing one rounded point stay grouped and their pager IDs are preserved. Overlap uses a stack mark rather than a number badge. |
| Community public posts showed a generic resident heading and map actions | The post header now shows the published incident type; the title/caption continue to come from screened public fields. Community cards and detail no longer offer View on map, and the generic shield/Resident report label is removed. Support and discussion remain available. |
| Contribution preview did not load full owner detail/activity | Selecting a contribution now fetches its owner-scoped detail through the existing `useReportDetail` cache and shows the same resident activity timeline/retry state used by map report details. The no-photo category banner is a 64px icon tile in Your contributions only. |
| Public incident detail was heavier than the map report detail | Map and Home public detail omit social action controls and retain the screened title/type, status, location, progress and three newest official updates. Community keeps the full official update list and discussion actions. No private source report fields are used. |
| Private-report notification depended on currently loaded pins | Added an owner-scoped fetch for a requested report outside the loaded list and open its detail on Map. Public-incident notifications continue to open Community discussion. Errors offer retry. |
| Public incident search used the facility icon | Uses the report warning icon. |
| Public map areas could be lost during iOS WebView startup | Buffers public incident data until Leaflet is ready, matching the original private-pin startup handling. A runtime regression check executes the generated map script with early data, no-pin records, approximate cells, exact safety pins and layer clearing. |
| A decorative ellipsis suggested an unavailable menu | Replaced it with a forward chevron matching the card's open action. |

## What the barangay list meant

Some published cases deliberately have no public coordinates: barangay-only
publication and sensitive cases. Those cases cannot be represented by a map pin.
The Phase 4 list was an alternate way to open their updates/discussion. It was
not a second report-submission system, an officer work queue, or a new barangay
database. The restored UI keeps access inside Map filters and avoids repeating
the entire Community feed as a floating map control.

## Where Tunghaan and the approximate location came from

The barangay name comes from the public incident RPC's `barangay_name`, derived
from the incident/barangay database record. Tunghaan was not a hardcoded name in
the resident location label. The old **800-metre radius was hardcoded in the UI**.

The hosted projection publishes coordinates rounded to two decimal places for
`approximate_area`. The client now shades the corresponding cell: the rounded
latitude/longitude plus or minus 0.005 degrees. This is a display of coordinate
uncertainty, not a measured hazard radius, surveyed barangay boundary or municipal
coverage polygon. Barangay-only cases receive no public coordinate. A precise
public pin still requires the explicit safety-location mode and reason.

## Files affected and reuse

- `components/home/NearbyReportsPanel.tsx`: original Home structure and styles.
- `app/(main)/feed.tsx`, `components/report/PublicIncidentFeed.tsx` and
  `PublicIncidentCard.tsx`: two-tab Community structure and public post list.
- `app/(main)/map.tsx`, `components/map/InteractiveMap.tsx`: floating filters,
  no-pin access, honest location display, status/type public markers and
  private-report deep links.
- `components/report/PublicIncidentPost.tsx`, `PublicIncidentCard.tsx`,
  `PublicIncidentDetail.tsx` and `PublicIncidentFeed.tsx`: public title/type
  hierarchy and Community/map detail actions.
- `components/map/YourContributionsPanel.tsx`,
  `ResidentReportPreviewSheet.tsx` and `styles/components/yourContributions.styles.ts`:
  owner-scoped detail/activity loading and a compact no-photo banner.
- `components/notifications/NotificationsModal.tsx`: route private reports to Map.
- `components/report/ReportStatusTimeline.tsx`, `lib/reportLifecycle.ts`:
  reusable fact-derived connected progress, including private report previews.
- `lib/publicIncidents.ts`: shared public status options, lifecycle mapping and
  location/status copy reused by Home, Community, Map and detail.
- Lifecycle/public-record regression tests, this audit, implementation notes,
  changelog and the Expo Go test checklist.

No schema migration or hosted data mutation is needed for these UI corrections.
Phase 4's hosted privacy restrictions, source evidence access, public discussion,
official workflows and photo-publication restriction remain in place.

## Remaining checks and improvements

- Validation passed: 145 unit tests, TypeScript, full ESLint/Deno lint, Expo web
  export and tracked-diff whitespace checks. No SQL changed in this correction;
  the earlier backend verification is recorded separately in the phone checklist.
- The 6 November marker/detail correction adds a grouped public-marker regression
  assertion for category glyphs, alert badges, selected highlighting and grouped
  click IDs. `npm test` passed: 146 unit tests, TypeScript, ESLint and Deno lint.
  No backend migration or hosted-data change was part of this correction.
- Physical iPhone acceptance remains pending. Check normal/enlarged text,
  portrait/landscape, map gestures versus Home scrolling, filter panel scrolling,
  paging, empty/error states and private/public notification destinations.
- Automated browser inspection did not complete because computer-access approval
  timed out. A build/export is not a visual acceptance pass.
- New public photo approval remains disabled pending metadata-removal verification.
  This is a known Phase 4 requirement, not missing card content.
- Public status/search/sort currently operate on loaded pages. Use Load more when
  searching older records. Server-side filtering is a potential later enhancement.
- Public changes refresh while focused approximately every 60 seconds; pull to
  refresh for an immediate check. A poll reloads the first page.
- Follow [the Expo Go checklist](phase4-expo-go-test-checklist.md) for the actual
  hosted resident/official walkthrough. No fresh hosted fixtures were inserted
  for this UI audit.

## Can the map show only Minglanilla?

Yes. Leaflet supports pan bounds and a minimum zoom, which can keep the viewport
focused on the municipality. Those bounds are rectangular and can still show
neighboring land around the edges. See the official
[Leaflet 1.9.4 map options](https://leafletjs.com/reference-1.9.4.html#map-maxbounds).

To visually hide everything outside the actual municipal outline, use a verified
Minglanilla boundary polygon and an outside-area mask, together with pan/zoom
bounds. A coverage bounding box or rounded public location cell should not be
presented as the municipal boundary. No verified municipal boundary asset was
found in this repository. This question has been assessed; no map restriction
was added in this UI correction.
