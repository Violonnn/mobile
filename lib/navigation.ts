import type { Href, ImperativeRouter } from 'expo-router';

/** Goes back when history exists, otherwise replaces the root route safely. */
export function goBackOrReplace(
  router: ImperativeRouter,
  fallbackRoute: Href,
): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallbackRoute);
}
