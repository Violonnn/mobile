import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLocationRequestTracker,
  distanceBetweenCoordinates,
  getCachedOrFreshReportGpsPosition,
  getRecentAccurateReportGpsPosition,
  getReportLocationAdjustmentLimit,
  REPORT_GPS_CACHE_MAX_AGE_MS,
} from '../lib/reportLocation.ts';

test('report pin uses a 150 meter normal adjustment limit', () => {
  assert.equal(getReportLocationAdjustmentLimit(12), 150);
  assert.equal(getReportLocationAdjustmentLimit(null), 150);
});

test('report pin allowance follows GPS accuracy but caps at 300 meters', () => {
  assert.equal(getReportLocationAdjustmentLimit(220), 220);
  assert.equal(getReportLocationAdjustmentLimit(900), 300);
});

test('coordinate distance is zero for the immutable device point', () => {
  const coordinate = { latitude: 10.2447, longitude: 123.7967 };
  assert.equal(distanceBetweenCoordinates(coordinate, coordinate), 0);
});

test('coordinate distance reports a nearby adjustment in meters', () => {
  const distance = distanceBetweenCoordinates(
    { latitude: 10.2447, longitude: 123.7967 },
    { latitude: 10.2457, longitude: 123.7967 },
  );
  assert.ok(distance > 110 && distance < 112);
});

test('report startup accepts only a recent cached fix within the accuracy threshold', () => {
  const now = 1_000_000;
  const position = {
    latitude: 10.2447,
    longitude: 123.7967,
    accuracyMeters: 100,
    timestamp: now - REPORT_GPS_CACHE_MAX_AGE_MS,
  };

  assert.deepEqual(getRecentAccurateReportGpsPosition(position, now), {
    latitude: position.latitude,
    longitude: position.longitude,
    accuracyMeters: position.accuracyMeters,
  });
});

test('report startup rejects stale, future, inaccurate, and invalid cached fixes', () => {
  const now = 1_000_000;
  const candidate = {
    latitude: 10.2447,
    longitude: 123.7967,
    accuracyMeters: 20,
    timestamp: now,
  };

  assert.equal(
    getRecentAccurateReportGpsPosition(
      { ...candidate, timestamp: now - REPORT_GPS_CACHE_MAX_AGE_MS - 1 },
      now,
    ),
    null,
  );
  assert.equal(
    getRecentAccurateReportGpsPosition({ ...candidate, timestamp: now + 1 }, now),
    null,
  );
  assert.equal(
    getRecentAccurateReportGpsPosition({ ...candidate, accuracyMeters: 100.1 }, now),
    null,
  );
  assert.equal(
    getRecentAccurateReportGpsPosition({ ...candidate, accuracyMeters: null }, now),
    null,
  );
  assert.equal(
    getRecentAccurateReportGpsPosition({ ...candidate, latitude: 91 }, now),
    null,
  );
});

test('report startup falls back to a fresh fix when the cached fix is unusable', async () => {
  const freshPosition = {
    latitude: 10.2448,
    longitude: 123.7968,
    accuracyMeters: 8,
    timestamp: 1_000_000,
  };
  let freshRequestCount = 0;
  const position = await getCachedOrFreshReportGpsPosition(
    {
      latitude: 10.2447,
      longitude: 123.7967,
      accuracyMeters: 450,
      timestamp: 999_999,
    },
    async () => {
      freshRequestCount += 1;
      return freshPosition;
    },
    1_000_000,
  );

  assert.equal(freshRequestCount, 1);
  assert.deepEqual(position, {
    latitude: freshPosition.latitude,
    longitude: freshPosition.longitude,
    accuracyMeters: freshPosition.accuracyMeters,
  });
});

test('report startup skips fresh GPS when a strict cached fix is usable', async () => {
  const cachedPosition = {
    latitude: 10.2447,
    longitude: 123.7967,
    accuracyMeters: 35,
    timestamp: 995_000,
  };
  let freshRequestCount = 0;
  const position = await getCachedOrFreshReportGpsPosition(
    cachedPosition,
    async () => {
      freshRequestCount += 1;
      throw new Error('Fresh GPS should not be requested.');
    },
    1_000_000,
  );

  assert.equal(freshRequestCount, 0);
  assert.deepEqual(position, {
    latitude: cachedPosition.latitude,
    longitude: cachedPosition.longitude,
    accuracyMeters: cachedPosition.accuracyMeters,
  });
});

test('location request tracker invalidates older async results after retry or close', () => {
  const requests = createLocationRequestTracker();
  const firstRequest = requests.start();
  const retryRequest = requests.start();

  assert.equal(requests.isCurrent(firstRequest), false);
  assert.equal(requests.isCurrent(retryRequest), true);

  requests.invalidate();
  assert.equal(requests.isCurrent(retryRequest), false);
});
