import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getNotificationDateGroup,
  groupNotificationsByDate,
} from '../lib/notificationDates.ts';

const now = new Date(2026, 8, 12, 12, 0, 0);

test('today covers local midnight through 23:59', () => {
  assert.equal(
    getNotificationDateGroup(new Date(2026, 8, 12, 0, 0, 0).toISOString(), now),
    'today',
  );
  assert.equal(
    getNotificationDateGroup(new Date(2026, 8, 12, 23, 59, 59).toISOString(), now),
    'today',
  );
});

test('this week starts Sunday and ends Saturday', () => {
  assert.equal(
    getNotificationDateGroup(new Date(2026, 8, 6, 0, 0, 0).toISOString(), now),
    'thisWeek',
  );
  assert.equal(
    getNotificationDateGroup(new Date(2026, 8, 11, 23, 59, 59).toISOString(), now),
    'thisWeek',
  );
});

test('dates before the current Sunday are earlier', () => {
  assert.equal(
    getNotificationDateGroup(new Date(2026, 8, 5, 23, 59, 59).toISOString(), now),
    'earlier',
  );
});

test('empty date groups are not rendered', () => {
  const sections = groupNotificationsByDate(
    [{ id: 'one', createdAt: new Date(2026, 8, 12, 9, 0, 0).toISOString() }],
    now,
  );
  assert.deepEqual(sections.map((section) => section.title), ['Today']);
});
