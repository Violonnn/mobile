# Phase 4 marker repair — 8 November 2026

## Cross-role map presentation — 9 November 2026

The resident map is the reference for Resident, BDRRMO, MDRRMO and Mayor maps,
including embedded command maps and selected-report popups. This amendment
supersedes the earlier role-specific marker shapes and palettes below.

- Report markers use a status-colored triangle and an incident-type glyph.
  Selection increases the icon frame from 44 to 50 pixels and adds a matching
  pulse. Clearing selection restores that report's own color and glyph.
- Map status colors follow `RESIDENT_STAGE_TONES`: review is rose, assessment
  amber, confirmed teal, actual response blue, resolved green, corrections copper
  and closed outcomes neutral. Legacy verified/escalated records do not imply a
  response action. Official workflow labels remain role-appropriate.
- Incident-type badges use `incidentTypeTone` for their icon, text and soft fill;
  category color is separate from the marker's lifecycle color.
- Official callouts reuse the resident card, tags, close and details controls.
  Status badges and their soft backgrounds follow the same map presentation.
- Facilities, evacuation centers and priority accents share one resource palette.
  Priority evacuation centers retain their green fill and yellow priority ring.
- Location privacy, rounded-point grouping, role scope, report text, discussion
  targets and navigation retain their existing behavior. This is a client
  presentation change; no database migration is required.

Shared code: `getMapReportPresentation` in `lib/reports.ts`,
`lib/mapResourceTones.ts`, `InteractiveMap.tsx`, `ResidentMapCallout.tsx` and its
official compatibility wrapper, and `IncidentTypeBadge.tsx`. The official map
route, Mayor map/list panels, BDRRMO/MDRRMO embedded maps and map-detail tags use
these helpers. Official marker conversion retains lifecycle for color selection
without adding a new discussion target. Tests are in `mapPresentation.test.ts`
and `publicIncidents.test.ts`; the unit script includes both.

Validation: 166 unit tests pass, including 17 focused map/public-projection
checks. TypeScript, the final Expo web export and ESLint/Deno lint pass; lint
has two pre-existing array-type style warnings and no errors. Generated-map
checks preserve location privacy/grouped IDs and cover normal, selected, swapped
and cleared markers. Review found and corrected a preview-sheet hook warning.

Physical-iPhone acceptance remains pending. Check normal/enlarged text, long
official labels and category names, selected/deselected markers, overlapping
points, filter legends and reduced-motion settings in each role. An automated
build or generated-map runtime test does not establish phone visual acceptance.
The isolated browser host was unavailable during this task; no new browser or
phone visual acceptance is claimed.

## Follow-up status, 8 November 2026

The later resident marker update restores a status-colored pulsing halo for
selected/highlighted report markers on Home and Map and makes them slightly
larger. The halo indicates selection only; it does not represent a distance,
coverage area or incident extent. The no-pulse notes below describe the earlier
repair checkpoint and are historical. Physical-phone visual acceptance remains
pending.

## Earlier repair checkpoint

- Resident own-report selection did not enable the triangle rendering path.
  Resident Map now opts into the same status/type triangle used by public pins.
- The public triangle contained a nested, fixed-size SVG, which made incident
  glyphs too small. Both selected marker paths now draw the same glyph directly
  inside the triangle. Selected triangles are larger than unselected triangles.
- At this checkpoint, circular highlight pulses behind triangles were removed
  from report markers. The later follow-up above restores a status-colored
  selection halo; facility and evacuation markers retain separate behavior.
- The HTML version appeared only in metadata. Version v10 is now a WebView key
  and an explicit HTML-builder input, so updated map content replaces the old view.
- Home's type chip could extend into its arrow. Its chip/text are bounded and
  shrink inside the text column; map callout tags also keep their close-button space.
- Home and public map callouts show short barangay metadata. Location precision
  remains available in details and map tooltips.

## Report text and identity

Published report cards use their screened title and description, and the approved
reporter name/avatar when owner sharing and official approval allow them. The
generic “Confirmed by…” fallback is removed. A missing public description is
labelled as missing rather than replaced with invented report text.

Legacy incident entries are labelled **Official incident summary**, with an
office icon, rather than an anonymous resident report. A read-only hosted check
on 7 November found zero individually published posts, zero name opt-ins and
zero exact-location opt-ins. That explains why the existing records still show
incident summaries and rounded locations. No data was automatically published.

Rounded points can coincide, so grouped reports remain selectable through their
pager. The marker is not a geographic radius. Exact individual report points
require the already agreed owner permission and official publication review.
Private report activity remains owner-only; public details show official updates.

## Files and reuse

The changes are in `InteractiveMap.tsx`, resident `map.tsx`,
`NearbyReportsPanel.tsx`, `ResidentMapCallout.tsx`, `PublicIncidentPost.tsx`,
the shared public location-label helpers, and `publicIncidents.test.ts`.
The two selected marker paths reuse one incident glyph function. The compact
barangay helper is shared by Home and map callouts. No migration is needed.

## Verification and phone check at the repair checkpoint

- Full suite: 149 unit tests, TypeScript, ESLint and Deno lint passed.
- Generated-map runtime checks: 13 focused tests passed at this checkpoint,
  including grouped report IDs, selected own triangles, no report pulses, and
  the updated HTML version. The later halo update has not had phone visual
  acceptance.
- `tmp/create-map-preview.ts` generates `tmp/phase4-map-marker-preview.html`
  from the actual map builder/injection functions using synthetic report data.
- Browser visual inspection remains incomplete: the isolated browser host was
  unavailable. Automatic review also rejected reading an unrelated Brave window
  and opening a new window through it. No phone visual acceptance is claimed.

Restart Expo with `npm.cmd start -- --clear`, reopen the project in Expo Go, then
select a nearby report on Home and your own report on Map. Both selected markers
should be status-colored triangles containing the incident icon, with a
status-colored pulsing selection halo and a slight size increase. Check a long
incident tag and the short barangay line. Open details to see location precision
and, for your own report, private activity.
