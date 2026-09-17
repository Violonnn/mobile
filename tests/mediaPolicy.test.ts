import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMediaCacheKey,
  buildReportDerivativeStoragePath,
  buildReportOriginalStoragePath,
  MAX_MEDIA_DISPLAY_IMAGE_BYTES,
  MAX_MEDIA_THUMBNAIL_BYTES,
  MAX_MEDIA_VIDEO_BYTES,
} from '../lib/mediaPolicy.ts';

test('cache identity uses the stable storage path, never a signed token', () => {
  const key = buildMediaCacheKey(
    'report-media',
    'user/report/media/thumbnail.jpg',
    'thumbnail',
  );

  assert.equal(
    key,
    'report-media:thumbnail:user/report/media/thumbnail.jpg',
  );
  assert.equal(key.includes('token='), false);
});

test('report originals and derivatives remain in the same media folder', () => {
  const common = { userId: 'user-id', reportId: 'report-id', mediaId: 'media-id' };

  assert.equal(
    buildReportOriginalStoragePath({ ...common, extension: 'mp4' }),
    'user-id/report-id/media-id/original.mp4',
  );
  assert.equal(
    buildReportDerivativeStoragePath({ ...common, variant: 'thumbnail' }),
    'user-id/report-id/media-id/thumbnail.jpg',
  );
  assert.equal(
    buildReportDerivativeStoragePath({ ...common, variant: 'display' }),
    'user-id/report-id/media-id/display.jpg',
  );
});

test('delivery hard limits match the server and bucket policy', () => {
  assert.equal(MAX_MEDIA_THUMBNAIL_BYTES, 300 * 1024);
  assert.equal(MAX_MEDIA_DISPLAY_IMAGE_BYTES, 2 * 1024 * 1024);
  assert.equal(MAX_MEDIA_VIDEO_BYTES, 20 * 1024 * 1024);
});

