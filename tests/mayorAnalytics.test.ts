import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mayorPercentage,
  normalizeMayorBarangayFilter,
  normalizeMayorStatusFilter,
  reduceMayorActivityTotals,
  reduceMayorDashboardSnapshot,
  reduceMayorReportActivity,
} from '../lib/mayorAnalyticsReducer.ts';

const BARANGAY_A = 'a1000000-0000-4000-8000-000000000001';
const BARANGAY_B = 'a1000000-0000-4000-8000-000000000002';

const barangays = [
  { id: BARANGAY_A, name: 'Tunghaan' },
  { id: BARANGAY_B, name: 'Ward II' },
];

const rows = [
  { barangay_id: BARANGAY_A, barangay_name: 'Tunghaan', status: 'unverified', report_count: 3 },
  { barangay_id: BARANGAY_A, barangay_name: 'Tunghaan', status: 'verified', report_count: 1 },
  { barangay_id: BARANGAY_B, barangay_name: 'Ward II', status: 'unverified', report_count: 1 },
  { barangay_id: BARANGAY_B, barangay_name: 'Ward II', status: 'escalated', report_count: 2 },
  { barangay_id: null, barangay_name: 'Unassigned', status: 'resolved', report_count: 2 },
];

test('all-time aggregate reduction reconciles status and unassigned totals', () => {
  const snapshot = reduceMayorDashboardSnapshot(rows, barangays, {
    barangayId: 'all',
    status: 'all',
  }, '2026-08-02T00:00:00.000Z');

  assert.equal(snapshot.matchingTotal, 9);
  assert.deepEqual(snapshot.statusCounts, {
    unverified: 4,
    verified: 1,
    escalated: 2,
    resolved: 2,
  });
  assert.equal(snapshot.unassignedCount, 2);
  assert.equal(snapshot.barangayTotals[0]?.barangayName, 'Tunghaan');
});

test('barangay selection retains the full status context while matching total respects status', () => {
  const snapshot = reduceMayorDashboardSnapshot(rows, barangays, {
    barangayId: BARANGAY_A,
    status: 'unverified',
  });

  assert.equal(snapshot.matchingTotal, 3);
  assert.deepEqual(snapshot.statusCounts, {
    unverified: 3,
    verified: 1,
    escalated: 0,
    resolved: 0,
  });
  assert.equal(snapshot.unassignedCount, 0);
  assert.equal(snapshot.barangayTotals.length, 1);
});

test('route filters reject unknown values and percentages are safe at zero', () => {
  assert.equal(normalizeMayorStatusFilter('not-a-status'), 'all');
  assert.equal(normalizeMayorStatusFilter(['resolved']), 'resolved');
  assert.equal(normalizeMayorBarangayFilter('not-a-uuid', barangays), 'all');
  assert.equal(normalizeMayorBarangayFilter(BARANGAY_B, barangays), BARANGAY_B);
  assert.equal(mayorPercentage(4, 0), 0);
  assert.equal(mayorPercentage(1, 3), 33);
});

test('activity buckets become clean status lines with the requested x-axis labels', () => {
  const series = reduceMayorReportActivity([
    { bucket: '2026-08-03T00:00:00+08:00', status: 'unverified', report_count: 2 },
    { bucket: '2026-08-04T00:00:00+08:00', status: 'unverified', report_count: 0 },
    { bucket: '2026-08-03T00:00:00+08:00', status: 'verified', report_count: 5 },
    { bucket: '2026-08-04T00:00:00+08:00', status: 'verified', report_count: 0 },
    { bucket: '2026-08-03T00:00:00+08:00', status: 'escalated', report_count: 0 },
    { bucket: '2026-08-04T00:00:00+08:00', status: 'escalated', report_count: 0 },
    { bucket: '2026-08-03T00:00:00+08:00', status: 'resolved', report_count: 0 },
    { bucket: '2026-08-04T00:00:00+08:00', status: 'resolved', report_count: 1 },
  ], '7d');

  assert.equal(series.length, 4);
  assert.equal(series.find((line) => line.status === 'unverified')?.points[0]?.label, 'Mon');
  assert.equal(series.find((line) => line.status === 'verified')?.points[0]?.count, 5);
  assert.equal(series.find((line) => line.status === 'resolved')?.points[1]?.count, 1);

  assert.deepEqual(reduceMayorActivityTotals(series).map((point) => point.count), [7, 1]);
});
