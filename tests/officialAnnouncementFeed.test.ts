import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildOfficialUpdateFeed,
  type OfficialUpdateFeedScope,
} from '../lib/officialAnnouncementFeed.ts';

const RESIDENT_BARANGAY_ID = 'barangay-a';

function createAnnouncement(
  id: string,
  authorRank: number,
  createdAt: string,
  barangayId: string | null = null,
) {
  return { id, authorRank, createdAt, barangayId };
}

function buildFeed(
  scope: OfficialUpdateFeedScope,
  announcements: ReturnType<typeof createAnnouncement>[],
) {
  return buildOfficialUpdateFeed(announcements, {
    residentBarangayId: RESIDENT_BARANGAY_ID,
    scope,
    sort: 'latest',
  });
}

test('priority feed shows Mayor, MDRRMO, then the resident barangay', () => {
  const announcements = [
    createAnnouncement('other-barangay', 3, '2026-09-14T08:00:00.000Z', 'barangay-b'),
    createAnnouncement('local-barangay', 3, '2026-09-13T08:00:00.000Z', RESIDENT_BARANGAY_ID),
    createAnnouncement('mdrrmo', 2, '2026-09-12T08:00:00.000Z'),
    createAnnouncement('mayor', 1, '2026-09-11T08:00:00.000Z'),
  ];

  assert.deepEqual(
    buildFeed('priority', announcements).map((announcement) => announcement.id),
    ['mayor', 'mdrrmo', 'local-barangay'],
  );
});

test('priority feed uses the selected date order within each office group', () => {
  const announcements = [
    createAnnouncement('mayor-older', 1, '2026-09-11T08:00:00.000Z'),
    createAnnouncement('mayor-newer', 1, '2026-09-14T08:00:00.000Z'),
    createAnnouncement('mdrrmo', 2, '2026-09-15T08:00:00.000Z'),
  ];

  assert.deepEqual(
    buildFeed('priority', announcements).map((announcement) => announcement.id),
    ['mayor-newer', 'mayor-older', 'mdrrmo'],
  );
});

test('all-updates mode includes announcements from every barangay', () => {
  const announcements = [
    createAnnouncement('mayor', 1, '2026-09-11T08:00:00.000Z'),
    createAnnouncement('other-barangay', 3, '2026-09-14T08:00:00.000Z', 'barangay-b'),
    createAnnouncement('local-barangay', 3, '2026-09-13T08:00:00.000Z', RESIDENT_BARANGAY_ID),
  ];

  assert.deepEqual(
    buildFeed('all', announcements).map((announcement) => announcement.id),
    ['other-barangay', 'local-barangay', 'mayor'],
  );
});
