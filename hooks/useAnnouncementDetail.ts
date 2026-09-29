// hooks/useAnnouncementDetail.ts — local state for one opened official update.
// Full media is loaded only when the resident opens a post, keeping feed rows
// lightweight and the bottom-sheet animation smooth.
import { useCallback, useEffect, useState } from 'react';

import {
  fetchAnnouncementById,
  type AnnouncementRecord,
} from '../lib/announcements';

const DETAIL_CACHE_TTL_MS = 2 * 60 * 1000;
const MAX_CACHED_ANNOUNCEMENT_DETAILS = 24;

type CachedAnnouncementDetail = {
  announcement: AnnouncementRecord;
  cachedAt: number;
};

// This cache is memory-only and scoped to the signed-in resident. It avoids
// re-signing media when a resident reopens an update during the same session.
const announcementDetailCache = new Map<string, CachedAnnouncementDetail>();

function getCacheKey(cacheScope: string | null | undefined, announcementId: string): string | null {
  if (!cacheScope) return null;
  return `${cacheScope}:${announcementId}`;
}

function getCachedAnnouncementDetail(
  cacheScope: string | null | undefined,
  announcementId: string,
): AnnouncementRecord | null {
  const cacheKey = getCacheKey(cacheScope, announcementId);
  if (!cacheKey) return null;

  const cachedDetail = announcementDetailCache.get(cacheKey);
  if (!cachedDetail) return null;
  if (Date.now() - cachedDetail.cachedAt < DETAIL_CACHE_TTL_MS) {
    return cachedDetail.announcement;
  }

  announcementDetailCache.delete(cacheKey);
  return null;
}

function cacheAnnouncementDetail(
  cacheScope: string | null | undefined,
  announcement: AnnouncementRecord,
): void {
  const cacheKey = getCacheKey(cacheScope, announcement.id);
  if (!cacheKey) return;

  const now = Date.now();
  announcementDetailCache.forEach((cachedDetail, key) => {
    if (now - cachedDetail.cachedAt >= DETAIL_CACHE_TTL_MS) {
      announcementDetailCache.delete(key);
    }
  });
  if (announcementDetailCache.size >= MAX_CACHED_ANNOUNCEMENT_DETAILS) {
    const oldestEntry = announcementDetailCache.entries().next().value;
    if (oldestEntry) announcementDetailCache.delete(oldestEntry[0]);
  }

  announcementDetailCache.set(cacheKey, { announcement, cachedAt: now });
}

export function useAnnouncementDetail(
  sourceAnnouncement: AnnouncementRecord | null,
  options?: { cacheScope?: string | null },
) {
  const cacheScope = options?.cacheScope;
  const [announcement, setAnnouncement] = useState<AnnouncementRecord | null>(sourceAnnouncement);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [previousSourceAnnouncement, setPreviousSourceAnnouncement] = useState(sourceAnnouncement);

  const cachedSourceAnnouncement = sourceAnnouncement
    ? getCachedAnnouncementDetail(cacheScope, sourceAnnouncement.id)
    : null;

  if (sourceAnnouncement !== previousSourceAnnouncement) {
    setPreviousSourceAnnouncement(sourceAnnouncement);
    if (sourceAnnouncement) {
      setAnnouncement(cachedSourceAnnouncement ?? sourceAnnouncement);
    }
    setRefreshError(null);
  }

  const refresh = useCallback(
    async (refreshOptions?: { showRefreshIndicator?: boolean }) => {
      if (!sourceAnnouncement) return;

      const showRefreshIndicator = refreshOptions?.showRefreshIndicator ?? true;
      if (showRefreshIndicator) setRefreshing(true);
      const result = await fetchAnnouncementById(sourceAnnouncement.id);
      if (showRefreshIndicator) setRefreshing(false);

      if (result.error || !result.announcement) {
        setRefreshError(result.error ?? 'Could not refresh this official update.');
        return;
      }

      setAnnouncement(result.announcement);
      cacheAnnouncementDetail(cacheScope, result.announcement);
      setRefreshError(null);
      // The inline comments hook observes this token and refreshes only the
      // currently open thread after the resident manually refreshes it.
      setRefreshVersion((current) => current + 1);
    },
    [cacheScope, sourceAnnouncement],
  );

  useEffect(() => {
    if (
      !sourceAnnouncement ||
      sourceAnnouncement.mediaDetailLoaded ||
      cachedSourceAnnouncement?.mediaDetailLoaded
    ) {
      return;
    }

    // Let the sheet skeleton render before resolving full media and comments.
    const timer = setTimeout(
      () => void refresh({ showRefreshIndicator: false }),
      0,
    );
    return () => clearTimeout(timer);
  }, [cachedSourceAnnouncement?.mediaDetailLoaded, refresh, sourceAnnouncement]);

  const visibleAnnouncement =
    announcement?.id === sourceAnnouncement?.id
      ? announcement
      : cachedSourceAnnouncement ?? sourceAnnouncement;

  return {
    announcement: visibleAnnouncement,
    refreshing,
    refreshError,
    refreshVersion,
    refresh,
  };
}
