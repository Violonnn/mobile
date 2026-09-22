# MDRRMO Screen Optimization Plan

## Goal

Make every MDRRMO tab feel as responsive as the resident area by replacing initial spinners with layout-matched skeletons and resetting temporary controls whenever a cached tab regains focus.

## Shared implementation

- Add `components/ui/OfficialScreenSkeletons.tsx`, built from the existing `SkeletonBlock` and `SkeletonGroup` in `components/ui/Skeleton.tsx`.
- Match each skeleton to the real screen layout and reuse the existing theme tokens. Do not duplicate data fetching or create timers to simulate loading.
- Show skeletons only for the first load when no usable data exists. Keep pull-to-refresh, pagination, form submission, and button-level `ActivityIndicator`s unchanged.
- Keep existing error, empty, retry, and stale-data behavior. If cached data exists during refresh, continue showing it.

## Screen work

| MDRRMO screen | Files | Required skeleton/reset |
| --- | --- | --- |
| Command | `app/official/index.tsx`, `components/official/MdrrmoCommandDashboard.tsx` | Skeleton for header, command summary/status cards, priority queue, and community preview. Replace the initial report/announcement spinners; do not block the whole screen for background refreshes. |
| Incidents | `app/official/incidents.tsx`, `components/official/MdrrmoReportsWorkspace.tsx` | Skeleton for header controls and report rows. On focus, close the search field, filter sheet, and add menu; preserve the applied status/sort values and search text, matching the resident feed behavior. |
| Community | `app/official/community.tsx`, `components/official/MdrrmoCommunityFeed.tsx` | Skeleton for tabs, composer, and feed cards for the active tab. On focus, close search, filters, and the barangay picker; preserve applied filters, sort, tab, and search text. |
| Map | `app/official/map.tsx`, `components/map/InteractiveMap.tsx`, `components/map/EscalatedReportsPanel.tsx` | Skeleton for the map shell and collapsed queue header while initial map data loads. Make layer-panel visibility controlled by the screen. On focus, dismiss/blur map search suggestions, hide the layer filter panel, close report/resource detail sheets, and settle Escalated Reports to its collapsed/lowered position. Keep selected layer values intact. |
| Resources | `app/official/resources.tsx` | Skeleton for the directory header, search/tabs, summary, and resource cards. On focus, dismiss temporary menus/sheets; keep the selected directory tab and applied search/filter values unless current resident behavior already resets an equivalent value. |
| Settings | `app/official/settings.tsx`, `components/official/MdrrmoSettingsWorkspace.tsx` | Skeleton for profile identity and settings rows while the profile is initially loading. Keep action-specific spinners for password changes, photo updates, and logout. |

Also replace the centered access/scope spinners in `app/official/_layout.tsx` and the route-level scope-loading branches with an official shell skeleton so tab content does not flash between blank states.

## Focus-reset pattern

Use Expo Router's `useFocusEffect` with a memoized callback. Reset presentation state only:

- hidden: search UI, map layer filter, modal/filter sheets, menus, and search suggestions;
- lowered: the MDRRMO Escalated Reports panel;
- preserved: fetched data, map layers, applied filters/sort, active feed tab, and search text.

If `InteractiveMap` owns state that the route must reset, add narrow controlled props or an explicit reset signal instead of remounting the map. Remounting would discard map position and cause avoidable WebView/map reloads.

## Acceptance checks

- First visits to all six MDRRMO tabs show stable, layout-matched skeletons with no full-page spinner flash.
- Returning to Incidents or Community shows the compact header with search and filter surfaces closed.
- Returning to Map shows the layer filter hidden, suggestions dismissed, and Escalated Reports collapsed; the map position and selected layers remain unchanged.
- Refreshing with existing data never replaces content with a skeleton.
- Error, empty, retry, navigation, accessibility labels, and MDRRMO business rules remain unchanged.
- Verify on small and large phones, portrait and landscape, including rapid tab switching and back navigation from report/resource details.
