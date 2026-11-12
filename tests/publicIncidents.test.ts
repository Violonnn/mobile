import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as reportLifecycle from '../lib/reportLifecycle.ts';
import { mapPublicPhotoUrlPairs } from '../lib/publicPhotoPairs.ts';
import { MAP_RESOURCE_TONES } from '../lib/mapResourceTones.ts';
import type { MapReportMarker } from '../lib/reports.ts';
import { colors } from '../styles/theme.ts';

function loadModule(path: string, dependencies: Record<string, unknown>): Record<string, unknown> {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const runtimeExports: Record<string, unknown> = {};
  runInNewContext(compiled.outputText, { exports: runtimeExports, module: { exports: runtimeExports },
    require(name: string) { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; },
  });
  return runtimeExports;
}

const publicRow = {
  incident_case_id: 'b4000000-0000-4000-8000-000000000001', incident_type: 'other',
  public_type_label: 'Other incident', barangay_name: 'Public Local', public_location_mode: 'approximate_area',
  approx_latitude: 10.25, approx_longitude: 123.8, exact_latitude: null, exact_longitude: null,
  safety_location_reason: null, public_status: 'confirmed', public_summary: null, public_correction: null,
  linked_report_count: 2, public_photo_display_paths: ['approved/display.jpg'], public_photo_thumbnail_paths: ['approved/thumbnail.jpg'],
};

function loadPublicRuntime(options?: { row?: Record<string, unknown>; signingError?: string; rpcError?: boolean; notFound?: boolean; reports?: Record<string, unknown>[] }) {
  const signedPaths: string[] = [];
  const requests: { name: string; parameters: Record<string, unknown> }[] = [];
  const runtime = loadModule('../lib/publicIncidents.ts', {
    './incidentTypes': { isIncidentType: (value: string) => ['fire','flood','other'].includes(value) },
    './reportLifecycle': reportLifecycle,
    './publicPhotoPairs': { mapPublicPhotoUrlPairs },
    './reportPublication': { mapPublicResidentReportRecord: async (row: Record<string, unknown>) => row },
    './supabase': { supabase: { rpc: async (name: string, parameters: Record<string, unknown>) => {
      requests.push({ name, parameters });
      if (options?.rpcError) throw new Error('Offline');
      const row = options?.row ?? publicRow;
      return { data: name === 'list_public_community_posts'
        ? (options?.reports ?? []).length ? options!.reports!.map((post_data) => ({ post_kind: 'report', post_data })) : [{ post_kind: 'incident', post_data: row }]
        : options?.notFound ? null : {
        incident: row, updates: [{ occurred_at: '2026-11-05T08:00:00Z', entry_type: 'progress_update', public_text: 'Public update' }],
      }, error: null };
    } } },
    './mediaUrlCache': { resolveSignedMediaUrls: async ({ storagePaths }: { storagePaths: string[] }) => {
      signedPaths.push(...storagePaths);
      return { urls: new Map(options?.signingError ? [] : storagePaths.map((path) => [path, `signed:${path}`])), error: options?.signingError ?? null };
    } },
  }) as unknown as typeof import('../lib/publicIncidents');
  return { runtime, signedPaths, requests };
}

test('public community list uses the bounded combined projection and signs only approved legacy derivatives', async () => {
  const fixture = loadPublicRuntime();
  const result = await fixture.runtime.fetchPublicIncidents({ limit: 999, offset: -1 });
  assert.equal(result.error, null);
  const incidentRequest = fixture.requests.find((request) => request.name === 'list_public_community_posts');
  assert.equal(incidentRequest?.parameters.p_limit, 100);
  assert.equal(incidentRequest?.parameters.p_offset, 0);
  assert.deepEqual(fixture.signedPaths, ['approved/display.jpg', 'approved/thumbnail.jpg']);
  assert.equal(result.incidents[0].exactLocation, null);
  assert.equal(result.incidents[0].approximateArea?.latitude, 10.25);
  assert.equal(result.incidents[0].publicPhotoDisplays[0], 'signed:approved/display.jpg');
  assert.equal(result.incidents[0].reportId, undefined, 'legacy incident summaries have no resident post identity');
  assert.equal(result.incidents[0].reporterName, undefined, 'legacy incident summaries do not impersonate anonymous residents');
});

test('individual public posts keep report IDs while engagement stays on their incident case', async () => {
  const individualReport = {
    reportId: 'report-a', incidentCaseId: publicRow.incident_case_id,
    publicTitle: 'Screened report title', publicDescription: 'Screened report text',
    incidentType: 'other', publicTypeLabel: 'Other incident', barangayName: 'Public Local',
    publicLocationMode: 'approximate_area', approximateArea: { latitude: 10.25, longitude: 123.8 },
    exactLocation: null, reporterName: 'Resident A', reporterAvatarPath: null, reporterAvatarUrl: null,
    createdAt: '2026-11-05T08:00:00Z', publicStatus: 'confirmed', confirmedAt: null,
    latestPublicUpdateAt: null, latestPublicUpdate: null, publicSummary: null, publicCorrection: null,
    engagement: { upvoteCount: 3, commentCount: 4, hasUpvoted: true },
    publicPhotos: [
      { identity: 'report-a-photo-display', displayUrl: 'signed:report-a-photo-display', thumbnailUrl: 'signed:report-a-photo-thumb' },
    ],
    photoError: null,
  };
  const { runtime } = loadPublicRuntime({ reports: [individualReport] });
  const result = await runtime.fetchPublicIncidents();
  assert.equal(result.incidents.length, 1, 'the legacy case is omitted when a post represents it');
  assert.equal(result.incidents[0].reportId, 'report-a');
  assert.equal(result.incidents[0].incidentCaseId, publicRow.incident_case_id);
  assert.equal(result.incidents[0].publicTitle, 'Screened report title');
  assert.equal(result.incidents[0].publicCaption, 'Screened report text');
  assert.equal(result.incidents[0].reporterName, 'Resident A');
  assert.deepEqual(result.incidents[0].publicPhotoIdentities, ['report-a-photo-display']);
  assert.deepEqual(result.incidents[0].publicPhotoDisplays, ['signed:report-a-photo-display']);
  assert.deepEqual(result.incidents[0].publicPhotoThumbnails, ['signed:report-a-photo-thumb']);
  assert.deepEqual(result.incidents[0].engagement, { upvoteCount: 3, commentCount: 4, hasUpvoted: true });
});

test('public feed pagination keeps sibling report posts for the same incident distinct', async () => {
  const { runtime } = loadPublicRuntime();
  const [baseReport] = (await runtime.fetchPublicIncidents()).incidents;
  const reportOne = { ...baseReport, incidentCaseId: 'shared-case', reportId: 'report-one', publicTitle: 'First version' };
  const reportTwo = { ...baseReport, incidentCaseId: 'shared-case', reportId: 'report-two', publicTitle: 'Sibling report' };
  const refreshedReportOne = { ...reportOne, publicTitle: 'Updated first version' };
  const merged = runtime.mergePublicIncidentPosts([reportOne, reportTwo], [refreshedReportOne]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find((post) => post.reportId === 'report-one')?.publicTitle, 'Updated first version');
  assert.equal(merged.find((post) => post.reportId === 'report-two')?.publicTitle, 'Sibling report');
});

test('a public incident remains usable when photo signing fails', async () => {
  const fixture = loadPublicRuntime({ signingError: 'Photo unavailable' });
  const result = await fixture.runtime.fetchPublicIncidents();
  assert.equal(result.incidents.length, 1);
  assert.equal(result.error, null);
  assert.equal(result.incidents[0].photoError, 'Photo unavailable');
  assert.deepEqual(result.incidents[0].publicPhotoDisplays, [null], 'Failed photo keeps its report-owned position without inventing a URL');
});

test('barangay-only projection ignores even accidentally supplied coordinates', async () => {
  const fixture = loadPublicRuntime({ row: { ...publicRow, public_location_mode: 'barangay_only', exact_latitude: 10.25123, exact_longitude: 123.80317 } });
  const result = await fixture.runtime.fetchPublicIncidents();
  assert.equal(result.incidents[0].exactLocation, null);
  assert.equal(result.incidents[0].approximateArea, null);
});

test('exact public location requires its explicit mode and safety reason', async () => {
  const fixture = loadPublicRuntime({ row: { ...publicRow, public_location_mode: 'exact_for_safety', exact_latitude: 10.25123, exact_longitude: 123.80317, safety_location_reason: 'Road closure' } });
  const result = await fixture.runtime.fetchPublicIncident(publicRow.incident_case_id);
  assert.equal(result.incident?.exactLocation?.reason, 'Road closure');
  assert.equal(result.incident?.approximateArea, null);
  assert.equal(result.updates[0].publicText, 'Public update');
});

test('withdrawn sensitive or missing incident produces a clear unavailable state', async () => {
  const fixture = loadPublicRuntime({ notFound: true });
  const result = await fixture.runtime.fetchPublicIncident(publicRow.incident_case_id);
  assert.equal(result.incident, null);
  assert.match(result.error ?? '', /no longer publicly available/);
  assert.equal(fixture.signedPaths.length, 0);
});

test('offline public calls return errors instead of rejecting or spinning', async () => {
  const fixture = loadPublicRuntime({ rpcError: true });
  assert.match((await fixture.runtime.fetchPublicIncidents()).error ?? '', /connection/);
  assert.match((await fixture.runtime.fetchPublicIncident(publicRow.incident_case_id)).error ?? '', /connection/);
});

test('public location copy follows each published location mode and barangay', async () => {
  const { runtime } = loadPublicRuntime();
  const { incidents } = await runtime.fetchPublicIncidents();
  const incident = incidents[0];
  assert.match(runtime.publicIncidentLocationLabel(incident), /Approximate location.*Public Local/);
  assert.match(runtime.publicIncidentLocationLabel({ ...incident, barangayName: 'Another barangay' }), /Another barangay/);
  assert.match(runtime.publicIncidentLocationLabel({ ...incident, publicLocationMode: 'barangay_only' }), /Location kept private/);
  const safetyIncident = { ...incident, publicLocationMode: 'exact_for_safety' as const,
    exactLocation: { latitude: 10.25, longitude: 123.8, reason: 'Road closure' } };
  assert.match(runtime.publicIncidentLocationLabel(safetyIncident), /Safety location.*Road closure/);
});

test('public progress accepts only published lifecycle states', () => {
  const { runtime } = loadPublicRuntime();
  for (const status of ['confirmed', 'response_ongoing', 'resolved', 'withdrawn']) {
    assert.equal(runtime.publicIncidentLifecycle(status)?.primaryStage, status);
    assert.equal(runtime.publicIncidentLifecycle(status)?.coordinationBadge, null);
  }
  assert.equal(runtime.publicIncidentLifecycle('under_review'), null);
  assert.equal(runtime.publicIncidentLifecycle('unknown'), null);
});

test('public map buffers early iOS data and draws status pins without private pins or area polygons', async () => {
  const { runtime } = loadPublicRuntime();
  const { incidents } = await runtime.fetchPublicIncidents();
  const source = ts.createSourceFile('InteractiveMap.tsx', readFileSync(
    new URL('../components/map/InteractiveMap.tsx', import.meta.url), 'utf8',
  ), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  // Isolate the actual generated-map functions without loading native React modules.
  const declarations = source.statements.filter((statement) => {
    if (ts.isFunctionDeclaration(statement)) {
      return ['buildMapHtml', 'publicIncidentsToInjectScript', 'markersToInjectScript'].includes(statement.name?.text ?? '');
    }
    return ts.isVariableStatement(statement) && statement.declarationList.declarations.some(
      (declaration) => ['CENTER', 'ZOOM', 'MAP_HTML_VERSION'].includes(declaration.name.getText(source)),
    );
  }).map((statement) => statement.getText(source)).join('\n');
  const compiled = ts.transpileModule(`${declarations}\nexports.buildMapHtml = buildMapHtml;
    exports.publicIncidentsToInjectScript = publicIncidentsToInjectScript;
    exports.markersToInjectScript = markersToInjectScript;`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const mapRuntime: Record<string, unknown> = {};
  runInNewContext(compiled.outputText, {
    exports: mapRuntime,
    colors,
    MAP_RESOURCE_TONES,
    publicIncidentTone: runtime.publicIncidentTone,
  });
  const buildHtml = mapRuntime.buildMapHtml as (...parameters: unknown[]) => string;
  const injection = mapRuntime.publicIncidentsToInjectScript as (items: typeof incidents, highlightedId?: string) => string;
  const markerInjection = mapRuntime.markersToInjectScript as (
    markers: MapReportMarker[], showDetails: boolean,
    presentation: (report: MapReportMarker) => { label: string; color: string },
  ) => string;
  const window: Record<string, unknown> = {};
  const messages: string[] = [];
  window.ReactNativeWebView = { postMessage: (message: string) => messages.push(message) };
  const noPin = { ...incidents[0], incidentCaseId: 'no-pin', approximateArea: null, exactLocation: null };
  runInNewContext(injection([...incidents, noPin]), { window });
  assert.equal((window.__pendingPublicIncidents as unknown[]).length, 2);

  type Shape = {
    kind: string;
    bounds: unknown;
    tooltip?: { textContent: string };
    icon?: { options?: { html?: string; iconSize?: number[] } };
    options?: Record<string, unknown>;
  };
  const drawn: Shape[] = [];
  const markerClickHandlers: ((event: unknown) => void)[] = [];
  function layer(shape?: Shape): unknown {
    return new Proxy({}, { get: (_target, method) => {
      if (method === 'getZoom') return () => 13;
      if (method === 'clearLayers') return () => { drawn.length = 0; };
      if (method === 'addLayer') return (item: Shape) => { if (item.kind) drawn.push(item); };
      if (method === 'bindTooltip') return (tooltip: Shape['tooltip']) => { if (shape) shape.tooltip = tooltip; };
      if (method === 'setIcon') return (icon: Shape['icon']) => { if (shape) shape.icon = icon; return layer(shape); };
      if (method === 'on') return (_eventName: string, handler: (event: unknown) => void) => {
        if (shape?.kind === 'marker') markerClickHandlers.push(handler);
        return layer(shape);
      };
      if (method === 'kind') return shape?.kind;
      if (method === 'bounds') return shape?.bounds;
      if (method === 'tooltip') return shape?.tooltip;
      if (method === 'icon') return shape?.icon;
      if (method === 'options') return shape?.options;
      return () => layer(shape);
    } });
  }
  const leaflet = new Proxy({}, { get: (_target, method) => {
    if (method === 'DomEvent') return { stopPropagation() {} };
    return (...parameters: unknown[]) => {
      if (method === 'divIcon') return { options: parameters[0] as { html?: string; iconSize?: number[] } };
      if (method === 'marker') {
        const markerOptions = parameters[1] as Record<string, unknown> & { icon?: Shape['icon'] };
        const marker = { kind: 'marker', bounds: parameters[0], icon: markerOptions.icon, options: markerOptions };
        return layer(marker);
      }
      return layer(method === 'rectangle' ? { kind: String(method), bounds: parameters[0] } : undefined);
    };
  } });
  const html = buildHtml(false, 'light', false, false, 15, 0, 0, 0, 0, 0);
  // External scripts have a src attribute; execute only the generated inline startup code.
  const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(inlineScript, 'The generated Leaflet page must include its startup script');
  const environment = { window, L: leaflet,
    document: { addEventListener() {}, createElement: () => ({ textContent: '' }) },
  };
  runInNewContext(inlineScript, environment);
  assert.equal(window.__pendingPublicIncidents, null);
  assert.equal(drawn.length, 1, 'Barangay-only records must not create a public pin');
  assert.equal(drawn[0].kind, 'marker');
  assert.deepEqual(Array.from(drawn[0].bounds as number[]), [10.25, 123.8]);
  assert.match(drawn[0].tooltip?.textContent ?? '', /Approximate location/);
  const firstGroupedIncident = {
    ...incidents[0], incidentCaseId: 'first-grouped-incident', reportId: 'first-grouped-report', incidentType: 'fire' as const,
  };
  const secondNearbyIncident = {
    ...firstGroupedIncident, incidentCaseId: 'same-area-second', reportId: 'second-grouped-report',
  };
  runInNewContext(injection([firstGroupedIncident, secondNearbyIncident], secondNearbyIncident.reportId), environment);
  assert.equal(drawn.length, 1, 'Incidents at one rounded public point remain grouped');
  const groupedIconHtml = drawn[0].icon?.options?.html ?? '';
  assert.match(groupedIconHtml, /public-pin-triangle/);
  assert.match(groupedIconHtml, /public-pin-highlight-pulse/);
  assert.ok(groupedIconHtml.includes(
    `style="background:${runtime.publicIncidentTone(secondNearbyIncident.publicStatus).color}"`,
  ));
  assert.match(groupedIconHtml, /<g transform="translate\(0 3\)">/);
  assert.doesNotMatch(groupedIconHtml, /public-pin-glyph|public-pin-pulse|dashed|public-pin-alert/);
  assert.doesNotMatch(groupedIconHtml, /public-pin-count/);
  assert.deepEqual(Array.from(drawn[0].icon?.options?.iconSize ?? []), [50, 50]);
  assert.match(html, /disasterlink-map-version" content="public-incident-markers-v12/);
  assert.match(html, /\.report-pin-highlight-pulse/);
  assert.match(html, /\.public-pin-highlight-pulse/);
  markerClickHandlers.at(-1)?.({});
  assert.deepEqual(JSON.parse(messages.at(-1) ?? '{}').reportIds, [firstGroupedIncident.reportId, secondNearbyIncident.reportId]);
  assert.doesNotMatch(html, /L\.rectangle/);
  const safetyLocation = { ...incidents[0], approximateArea: null,
    exactLocation: { latitude: 10.25123, longitude: 123.80317, reason: '<b>Road closure</b>' } };
  runInNewContext(injection([safetyLocation]), environment);
  assert.equal(drawn.length, 1);
  assert.equal(drawn[0].kind, 'marker');
  assert.deepEqual(Array.from(drawn[0].bounds as number[]), [10.25123, 123.80317]);
  assert.equal(drawn[0].tooltip?.textContent, 'Exact location for safety: <b>Road closure</b>');
  runInNewContext(injection([]), environment);
  assert.equal(drawn.length, 0, 'Hiding the layer must clear already drawn public areas');

  const ownReport = {
    id: 'own-report', title: 'Flooded road', description: 'Water blocks the lane',
    incidentType: 'flood', incidentTypeOther: null, status: 'verified',
    latitude: 10.2447, longitude: 123.7967, addressText: null, barangay_id: null,
    created_at: '2026-11-07T04:00:00Z', reporter: { id: 'resident', firstName: 'Resident', middleName: null, lastName: 'A', avatarPath: null },
    media: [], upvoteCount: 0, commentCount: 0,
  } as MapReportMarker;
  const otherReport = {
    ...ownReport,
    id: 'second-report',
    title: 'Brush fire',
    incidentType: 'fire',
    status: 'unverified',
    latitude: 10.245,
    longitude: 123.797,
  } as MapReportMarker;
  const ownMapScript = markerInjection([ownReport, otherReport], false, (report) => ({
    label: report.status === 'verified' ? 'Confirmed' : 'Under review',
    color: report.id === 'own-report' ? '#367168' : '#A9475A',
  }));
  runInNewContext(ownMapScript, environment);
  const ownMarker = drawn.find((shape) => shape.options?.reportId === 'own-report');
  const secondMarker = drawn.find((shape) => shape.options?.reportId === 'second-report');
  const ownNormalIcon = ownMarker?.icon?.options?.html ?? '';
  assert.match(ownNormalIcon, /<path d="M26 3 49 44H3L26 3Z" fill="#367168"/);
  assert.match(ownNormalIcon, /<path d="M15 33h22/);
  assert.deepEqual(Array.from(ownMarker?.icon?.options?.iconSize ?? []), [44, 44]);
  assert.deepEqual(Array.from(secondMarker?.icon?.options?.iconSize ?? []), [44, 44]);

  const setHighlightedReport = window.setHighlightedReport as ((reportId: string | null) => void) | undefined;
  setHighlightedReport?.('own-report');
  const ownIconHtml = ownMarker?.icon?.options?.html ?? '';
  assert.match(ownIconHtml, /<path d="M26 3 49 44H3L26 3Z" fill="#367168"/);
  assert.match(ownIconHtml, /<path d="M15 33h22/);
  assert.match(ownIconHtml, /report-pin-highlight-pulse/);
  assert.ok(ownIconHtml.includes('style="background:#367168"'));
  assert.deepEqual(Array.from(ownMarker?.icon?.options?.iconSize ?? []), [50, 50]);

  setHighlightedReport?.('second-report');
  const restoredOwnIcon = ownMarker?.icon?.options?.html ?? '';
  assert.match(restoredOwnIcon, /<path d="M26 3 49 44H3L26 3Z" fill="#367168"/);
  assert.match(restoredOwnIcon, /<path d="M15 33h22/);
  assert.deepEqual(Array.from(ownMarker?.icon?.options?.iconSize ?? []), [44, 44]);
  assert.doesNotMatch(restoredOwnIcon, /report-pin-highlight-pulse/);

  const selectedSecondIcon = secondMarker?.icon?.options?.html ?? '';
  assert.match(selectedSecondIcon, /<path d="M26 3 49 44H3L26 3Z" fill="#A9475A"/);
  assert.match(selectedSecondIcon, /<path d="M26 15c-1 5-8 7-8 13/);
  assert.deepEqual(Array.from(secondMarker?.icon?.options?.iconSize ?? []), [50, 50]);
  setHighlightedReport?.(null);
  const restoredSecondIcon = secondMarker?.icon?.options?.html ?? '';
  assert.match(restoredSecondIcon, /<path d="M26 3 49 44H3L26 3Z" fill="#A9475A"/);
  assert.match(restoredSecondIcon, /<path d="M26 15c-1 5-8 7-8 13/);
  assert.deepEqual(Array.from(secondMarker?.icon?.options?.iconSize ?? []), [44, 44]);
  assert.doesNotMatch(restoredSecondIcon, /report-pin-highlight-pulse/);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(html, /#4B82B5/);
  assert.match(html, /#3F7B6C/);
  assert.match(html, /#EAB308/);
});

test('incident discussion pages, replies, and writes share the incident target', async () => {
  const tables: string[] = [];
  const filters: { field: string; value: unknown }[] = [];
  let inserted: Record<string, unknown> | null = null;
  const query = {
    select() { return query; }, eq(field: string, value: unknown) { filters.push({ field, value }); return query; },
    is() { return query; }, order() { return query; }, range() { return query; },
    then(resolve: (value: { data: never[]; error: null; count: number }) => unknown) { return Promise.resolve({ data: [] as never[], error: null, count: 0 }).then(resolve); },
    insert(value: Record<string, unknown>) { inserted = value; return Promise.resolve({ error: null }); },
  };
  const runtime = loadModule('../lib/comments.ts', {
    './supabase': { supabase: { from(table: string) { tables.push(table); return query; } } },
    './auth': { getActiveSession: async () => ({ user: { id: 'resident' } }) },
    './schemaCompatibility': { isProfilePhotoSchemaMissing: () => false },
  }) as unknown as typeof import('../lib/comments');
  await runtime.fetchTopLevelComments('incident', 3, false, 'incident');
  await runtime.fetchCommentReplies('incident', 'parent', 5, false, 'incident');
  await runtime.addReportComment('incident', ' Public comment ', null, 'incident');
  assert.deepEqual(tables, ['incident_comment_details', 'incident_comment_details', 'incident_comments']);
  assert.ok(filters.some((filter) => filter.field === 'report_id' && filter.value === 'incident'));
  assert.equal((inserted as unknown as Record<string, unknown>).incident_case_id, 'incident');
  assert.equal((inserted as unknown as Record<string, unknown>).report_id, undefined);
  assert.equal((inserted as unknown as Record<string, unknown>).body, 'Public comment');
});

test('notification routes accept report/incident UUIDs and safely ignore unknown entities', () => {
  const runtime = loadModule('../lib/notifications.ts', {
    './auth': {}, './supabase': {}, './schemaCompatibility': {},
  }) as unknown as typeof import('../lib/notifications');
  const id = publicRow.incident_case_id;
  assert.equal(runtime.notificationTarget({ relatedEntityType: 'report', relatedEntityId: id })?.kind, 'report');
  assert.equal(runtime.notificationTarget({ relatedEntityType: 'incident_case', relatedEntityId: id })?.kind, 'incident');
  assert.equal(runtime.notificationTarget({ relatedEntityType: 'future_type', relatedEntityId: id }), null);
  assert.equal(runtime.notificationTarget({ relatedEntityType: 'report', relatedEntityId: '../official' }), null);
});
