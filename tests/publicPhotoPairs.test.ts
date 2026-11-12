import assert from 'node:assert/strict';
import test from 'node:test';

import { mapPublicPhotoUrlPairs } from '../lib/publicPhotoPairs.ts';

test('public photo signing keeps each thumbnail beside its matching display image', () => {
  const signedUrls = new Map([
    ['first-display', 'https://signed.example/first-display'],
    ['first-thumbnail', 'https://signed.example/first-thumbnail'],
    ['second-thumbnail', 'https://signed.example/second-thumbnail'],
  ]);

  const pairs = mapPublicPhotoUrlPairs(
    ['first-display', 'second-display'],
    ['first-thumbnail', 'second-thumbnail'],
    signedUrls,
  );

  assert.equal(pairs.length, 2);
  assert.deepEqual(pairs[0], {
    identity: 'first-display',
    displayUrl: 'https://signed.example/first-display',
    thumbnailUrl: 'https://signed.example/first-thumbnail',
  });
  assert.deepEqual(pairs[1], {
    identity: 'second-display',
    displayUrl: null,
    thumbnailUrl: 'https://signed.example/second-thumbnail',
  });
});

test('public photo pairing keeps null slots and unmatched photo order', () => {
  const pairs = mapPublicPhotoUrlPairs(
    [null, 'second-display'],
    ['first-thumbnail'],
    new Map([['first-thumbnail', 'https://signed.example/first-thumbnail']]),
  );

  assert.deepEqual(pairs, [
    { identity: 'first-thumbnail', displayUrl: null, thumbnailUrl: 'https://signed.example/first-thumbnail' },
    { identity: 'second-display', displayUrl: null, thumbnailUrl: null },
  ]);
});
