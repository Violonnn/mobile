// Screen-level announcement engagement (upvotes + optimistic comment counts).
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  fetchMyUpvotedAnnouncementIds,
  toggleAnnouncementUpvote,
} from '../../lib/announcementEngagement';
import type { AnnouncementRecord } from '../../lib/announcements';

export type AnnouncementEngagementState = {
  upvoteCount: number;
  commentCount: number;
  hasUpvoted: boolean;
};

type CountOverride = { upvoteCount?: number; commentCount?: number };

type AnnouncementEngagementContextValue = {
  getState: (announcement: AnnouncementRecord) => AnnouncementEngagementState;
  toggleUpvote: (announcement: AnnouncementRecord) => void;
  notifyCommentAdded: (announcementId: string) => void;
};

const AnnouncementEngagementContext =
  createContext<AnnouncementEngagementContextValue | null>(null);

export function useAnnouncementEngagement(): AnnouncementEngagementContextValue {
  const context = useContext(AnnouncementEngagementContext);
  if (context) return context;
  return {
    getState: (announcement) => ({
      upvoteCount: announcement.upvoteCount,
      commentCount: announcement.commentCount,
      hasUpvoted: false,
    }),
    toggleUpvote: () => {},
    notifyCommentAdded: () => {},
  };
}

export function AnnouncementEngagementProvider({
  announcements,
  children,
}: {
  announcements: AnnouncementRecord[];
  children: React.ReactNode;
}) {
  const [myUpvotes, setMyUpvotes] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Map<string, CountOverride>>(new Map());

  const announcementIdsKey = useMemo(
    () => announcements.map((item) => item.id).sort().join(','),
    [announcements],
  );

  useEffect(() => {
    let cancelled = false;
    const ids = announcementIdsKey ? announcementIdsKey.split(',') : [];
    void (async () => {
      const upvoted = await fetchMyUpvotedAnnouncementIds(ids);
      if (!cancelled) setMyUpvotes(upvoted);
    })();
    return () => {
      cancelled = true;
    };
  }, [announcementIdsKey]);

  useEffect(() => {
    setOverrides((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      for (const [id, override] of prev) {
        const marker = announcements.find((item) => item.id === id);
        if (!marker) {
          next.delete(id);
          continue;
        }
        const merged: CountOverride = { ...override };
        if (merged.upvoteCount === marker.upvoteCount) delete merged.upvoteCount;
        if (merged.commentCount === marker.commentCount) delete merged.commentCount;
        if (merged.upvoteCount === undefined && merged.commentCount === undefined) {
          next.delete(id);
        } else {
          next.set(id, merged);
        }
      }
      return next.size === prev.size ? prev : next;
    });
  }, [announcements]);

  const getState = useCallback(
    (announcement: AnnouncementRecord): AnnouncementEngagementState => {
      const override = overrides.get(announcement.id);
      return {
        upvoteCount: override?.upvoteCount ?? announcement.upvoteCount,
        commentCount: override?.commentCount ?? announcement.commentCount,
        hasUpvoted: myUpvotes.has(announcement.id),
      };
    },
    [overrides, myUpvotes],
  );

  const toggleUpvote = useCallback(
    (announcement: AnnouncementRecord) => {
      const currentlyUpvoted = myUpvotes.has(announcement.id);
      const base =
        overrides.get(announcement.id)?.upvoteCount ?? announcement.upvoteCount;
      const nextUpvoted = !currentlyUpvoted;
      const nextCount = Math.max(0, base + (nextUpvoted ? 1 : -1));

      setMyUpvotes((prev) => {
        const next = new Set(prev);
        if (nextUpvoted) next.add(announcement.id);
        else next.delete(announcement.id);
        return next;
      });
      setOverrides((prev) => {
        const next = new Map(prev);
        next.set(announcement.id, {
          ...next.get(announcement.id),
          upvoteCount: nextCount,
        });
        return next;
      });

      void (async () => {
        const { error } = await toggleAnnouncementUpvote(
          announcement.id,
          nextUpvoted,
        );
        if (!error) return;
        setMyUpvotes((prev) => {
          const next = new Set(prev);
          if (nextUpvoted) next.delete(announcement.id);
          else next.add(announcement.id);
          return next;
        });
        setOverrides((prev) => {
          const next = new Map(prev);
          const override = { ...next.get(announcement.id) };
          delete override.upvoteCount;
          if (override.commentCount === undefined) next.delete(announcement.id);
          else next.set(announcement.id, override);
          return next;
        });
      })();
    },
    [myUpvotes, overrides],
  );

  const notifyCommentAdded = useCallback(
    (announcementId: string) => {
      const marker = announcements.find((item) => item.id === announcementId);
      const base =
        overrides.get(announcementId)?.commentCount ?? marker?.commentCount ?? 0;
      setOverrides((prev) => {
        const next = new Map(prev);
        next.set(announcementId, {
          ...next.get(announcementId),
          commentCount: base + 1,
        });
        return next;
      });
    },
    [announcements, overrides],
  );

  const value = useMemo(
    () => ({ getState, toggleUpvote, notifyCommentAdded }),
    [getState, toggleUpvote, notifyCommentAdded],
  );

  return (
    <AnnouncementEngagementContext.Provider value={value}>
      {children}
    </AnnouncementEngagementContext.Provider>
  );
}
