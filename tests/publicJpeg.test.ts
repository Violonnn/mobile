import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { sanitizePublicJpeg } from '../supabase/functions/_shared/public-jpeg.ts';

const JPEG_LIMIT = 2 * 1024 * 1024;
const sourceJpeg = new Uint8Array(
  readFileSync(new URL('./fixtures/public-photo.jpg', import.meta.url)),
);

function markerSegment(marker: number, payload: Uint8Array): Uint8Array {
  const segmentLength = payload.length + 2;
  if (segmentLength > 0xffff) throw new Error('Test marker payload is too large.');
  return new Uint8Array([
    0xff,
    marker,
    segmentLength >> 8,
    segmentLength & 0xff,
    ...payload,
  ]);
}

function insertAt(source: Uint8Array, offset: number, inserted: Uint8Array): Uint8Array {
  const output = new Uint8Array(source.length + inserted.length);
  output.set(source.subarray(0, offset), 0);
  output.set(inserted, offset);
  output.set(source.subarray(offset), offset + inserted.length);
  return output;
}

function findMarker(source: Uint8Array, marker: number): number {
  for (let offset = 2; offset < source.length - 1; offset += 1) {
    if (source[offset] === 0xff && source[offset + 1] === marker) return offset;
  }
  throw new Error(`JPEG marker ${marker.toString(16)} was not found.`);
}

test('public JPEG sanitizer strips metadata segments and retains the photo scan bytes', () => {
  const cleanSource = sanitizePublicJpeg(sourceJpeg, JPEG_LIMIT);
  const exif = new TextEncoder().encode('Exif\0\0GPSLatitude=10.25 GPSLongitude=123.80');
  const xmp = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0GPSPosition=10.25,123.80');
  const iptc = new TextEncoder().encode('Photoshop IPTC location metadata');
  const comment = new TextEncoder().encode('private camera note');
  const metadataSegments = [
    markerSegment(0xe1, exif),
    markerSegment(0xe1, xmp),
    markerSegment(0xed, iptc),
    markerSegment(0xfe, comment),
  ];
  const metadataLength = metadataSegments.reduce((total, segment) => total + segment.length, 0);
  const taggedSource = insertAt(
    sourceJpeg,
    2,
    new Uint8Array(metadataSegments.flatMap((segment) => Array.from(segment))),
  );
  assert.equal(taggedSource.length, sourceJpeg.length + metadataLength);

  const sanitized = sanitizePublicJpeg(taggedSource, JPEG_LIMIT);
  assert.equal(sanitized.width, 128);
  assert.equal(sanitized.height, 128);
  assert.deepEqual(sanitized.bytes, cleanSource.bytes);
  assert.equal(sanitized.bytes.length, sourceJpeg.length - 18);
  assert.doesNotMatch(new TextDecoder().decode(sanitized.bytes), /GPSLatitude|GPSPosition|IPTC|camera note/);
  assert.deepEqual(sanitizePublicJpeg(sanitized.bytes, JPEG_LIMIT).bytes, sanitized.bytes);
});

test('public JPEG sanitizer preserves stuffed entropy and restart markers byte-for-byte', () => {
  const cleanSource = sanitizePublicJpeg(sourceJpeg, JPEG_LIMIT).bytes;
  assert.ok(cleanSource.some((value, index) => value === 0xff && cleanSource[index + 1] === 0x00));

  const startOfScan = findMarker(cleanSource, 0xda);
  const scanLength = (cleanSource[startOfScan + 2] << 8) | cleanSource[startOfScan + 3];
  const scanStart = startOfScan + 2 + scanLength;
  const restartInterval = markerSegment(0xdd, new Uint8Array([0x00, 0x01]));
  const withRestartInterval = insertAt(cleanSource, startOfScan, restartInterval);
  const shiftedScanStart = scanStart + restartInterval.length;
  const endOfImage = withRestartInterval.length - 2;
  let restartOffset = shiftedScanStart + Math.floor((endOfImage - shiftedScanStart) / 2);
  while (
    withRestartInterval[restartOffset - 1] === 0xff ||
    withRestartInterval[restartOffset] === 0xff
  ) restartOffset += 1;
  const withRestartMarker = insertAt(withRestartInterval, restartOffset, new Uint8Array([0xff, 0xd0]));

  assert.deepEqual(sanitizePublicJpeg(withRestartMarker, JPEG_LIMIT).bytes, withRestartMarker);
});

test('public JPEG sanitizer rejects malformed, truncated, oversized, and trailing data', () => {
  const cleanSource = sanitizePublicJpeg(sourceJpeg, JPEG_LIMIT).bytes;
  const startOfFrame = findMarker(cleanSource, 0xc0);
  const malformedLength = cleanSource.slice();
  malformedLength[startOfFrame + 2] = 0xff;
  malformedLength[startOfFrame + 3] = 0xff;

  assert.throws(() => sanitizePublicJpeg(sourceJpeg, sourceJpeg.length - 1));
  assert.throws(() => sanitizePublicJpeg(cleanSource.subarray(0, cleanSource.length - 1), JPEG_LIMIT));
  assert.throws(() => sanitizePublicJpeg(new Uint8Array([...cleanSource, 0x00]), JPEG_LIMIT + 1));
  assert.throws(() => sanitizePublicJpeg(malformedLength, JPEG_LIMIT));
});
