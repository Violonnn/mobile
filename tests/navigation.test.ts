import assert from 'node:assert/strict';
import test from 'node:test';
import type { ImperativeRouter } from 'expo-router';
import { goBackOrReplace } from '../lib/navigation.ts';

function createRouter(canGoBack: boolean) {
  let backCalls = 0;
  const replacedRoutes: unknown[] = [];

  const router = {
    back: () => {
      backCalls += 1;
    },
    canGoBack: () => canGoBack,
    replace: (route: unknown) => {
      replacedRoutes.push(route);
    },
  } as ImperativeRouter;

  return {
    router,
    getBackCalls: () => backCalls,
    replacedRoutes,
  };
}

test('goes back when navigation history exists', () => {
  const navigation = createRouter(true);

  goBackOrReplace(navigation.router, '/(auth)/login');

  assert.equal(navigation.getBackCalls(), 1);
  assert.deepEqual(navigation.replacedRoutes, []);
});

test('replaces with the fallback when the screen is the root route', () => {
  const navigation = createRouter(false);

  goBackOrReplace(navigation.router, '/(auth)/login');

  assert.equal(navigation.getBackCalls(), 0);
  assert.deepEqual(navigation.replacedRoutes, ['/(auth)/login']);
});
