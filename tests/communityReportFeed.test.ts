import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCommunityReportSections,
  type CommunityReportScope,
  type CommunityReportSort,
} from '../lib/communityReportFeed.ts';
import type { MapReportMarker } from '../lib/reports.ts';

const BARANGAY_ID = 'barangay-a';
const BARANGAY_CENTER = { latitude: 10.2447, longitude: 123.7967 };

function createReport(
  id: string,
  overrides: Partial<MapReportMarker> = {},
): MapReportMarker {
  const createdAt = overrides.created_at ?? '2026-09-13T08:00:00.000Z';
  return {
    id,
    title: `Report ${id}`,
    description: 'Community incident',
    incidentType: 'flood',
    incidentTypeOther: null,
    status: 'unverified',
    latitude: BARANGAY_CENTER.latitude,
    longitude: BARANGAY_CENTER.longitude,
    addressText: 'Minglanilla, Cebu',
    barangay_id: BARANGAY_ID,
    created_at: createdAt,
    latestActivityAt: overrides.latestActivityAt ?? createdAt,
    reporter: {
      id: `reporter-${id}`,
      firstName: 'Juan',
      middleName: null,
      lastName: 'Dela Cruz',
      avatarPath: null,
    },
    media: [],
    upvoteCount: 0,
    commentCount: 0,
    ...overrides,
  };
}

function buildSections(
  reports: MapReportMarker[],
  sort: CommunityReportSort = 'activity',
  scope: CommunityReportScope = 'barangay',
) {
  return buildCommunityReportSections(reports, {
    barangayCenter: BARANGAY_CENTER,
    barangayId: BARANGAY_ID,
    searchQuery: '',
    scope,
    sort,
    statusFilter: 'all',
  });
}

test('defaults to reports from the resident barangay only', () => {
  const local = createReport('local');
  const anotherBarangay = createReport('another-barangay', {
    barangay_id: 'barangay-b',
  });

  const sections = buildSections([anotherBarangay, local]);

  assert.equal(sections.length, 1);
  assert.equal(sections[0].id, 'barangay');
  assert.deepEqual(
    sections[0].data.map((item) => item.report.id),
    ['local'],
  );
});

test('municipality scope returns all authorized reports in one feed', () => {
  const local = createReport('local');
  const anotherBarangay = createReport('another-barangay', {
    barangay_id: 'barangay-b',
  });

  const sections = buildSections(
    [anotherBarangay, local],
    'activity',
    'municipality',
  );

  assert.equal(sections[0].id, 'municipality');
  assert.deepEqual(
    sections[0].data.map((item) => item.report.id).sort(),
    ['another-barangay', 'local'],
  );
});

test('latest activity uses qualifying activity and ignores engagement totals', () => {
  const recentlyActive = createReport('recently-active', {
    created_at: '2026-09-12T08:00:00.000Z',
    latestActivityAt: '2026-09-13T11:00:00.000Z',
  });
  const newerButInactive = createReport('newer-but-inactive', {
    created_at: '2026-09-13T10:00:00.000Z',
    latestActivityAt: '2026-09-13T10:00:00.000Z',
    upvoteCount: 9_999,
    commentCount: 9_999,
  });

  assert.deepEqual(
    buildSections([newerButInactive, recentlyActive])[0].data.map(
      (item) => item.report.id,
    ),
    ['recently-active', 'newer-but-inactive'],
  );
});

test('newest and oldest use only the original report creation time', () => {
  const older = createReport('older', {
    created_at: '2026-09-12T08:00:00.000Z',
    latestActivityAt: '2026-09-14T08:00:00.000Z',
  });
  const newer = createReport('newer', {
    created_at: '2026-09-13T08:00:00.000Z',
  });

  assert.deepEqual(
    buildSections([older, newer], 'newest')[0].data.map((item) => item.report.id),
    ['newer', 'older'],
  );
  assert.deepEqual(
    buildSections([older, newer], 'oldest')[0].data.map((item) => item.report.id),
    ['older', 'newer'],
  );
});

test('search covers incident metadata and reporter identity', () => {
  const fireReport = createReport('fire', {
    incidentType: 'fire',
    reporter: {
      id: 'reporter-fire',
      firstName: 'Maria',
      middleName: 'Santos',
      lastName: 'Reyes',
      avatarPath: null,
    },
  });

  const byIncident = buildCommunityReportSections([fireReport], {
    barangayCenter: BARANGAY_CENTER,
    barangayId: BARANGAY_ID,
    searchQuery: 'fire',
    scope: 'barangay',
    sort: 'activity',
    statusFilter: 'all',
  });
  const byReporter = buildCommunityReportSections([fireReport], {
    barangayCenter: BARANGAY_CENTER,
    barangayId: BARANGAY_ID,
    searchQuery: 'maria santos reyes',
    scope: 'barangay',
    sort: 'activity',
    statusFilter: 'all',
  });

  assert.equal(byIncident[0].data[0].report.id, 'fire');
  assert.equal(byReporter[0].data[0].report.id, 'fire');
});

test('a directly opened in-scope report remains visible despite active filters', () => {
  const resolved = createReport('requested', { status: 'resolved' });

  const sections = buildCommunityReportSections([resolved], {
    barangayCenter: BARANGAY_CENTER,
    barangayId: BARANGAY_ID,
    requestedReportId: resolved.id,
    searchQuery: 'does not match',
    scope: 'barangay',
    sort: 'activity',
    statusFilter: 'active',
  });

  assert.equal(sections[0].data[0].report.id, resolved.id);
});

test('status filtering covers every workflow stage', () => {
  const reports = [
    createReport('unverified', { status: 'unverified' }),
    createReport('verified', { status: 'verified' }),
    createReport('escalated', { status: 'escalated' }),
    createReport('resolved', { status: 'resolved' }),
  ];

  const escalatedSections = buildCommunityReportSections(reports, {
    barangayCenter: BARANGAY_CENTER,
    barangayId: BARANGAY_ID,
    searchQuery: '',
    scope: 'barangay',
    sort: 'activity',
    statusFilter: 'escalated',
  });

  assert.deepEqual(
    escalatedSections[0].data.map((item) => item.report.id),
    ['escalated'],
  );
});
