import assert from 'node:assert/strict';
import test from 'node:test';
import {
  distanceBetweenCoordinates,
  getReportLocationAdjustmentLimit,
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
