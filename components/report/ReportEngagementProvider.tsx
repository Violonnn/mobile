// components/report/ReportEngagementProvider.tsx
// Screen-level engagement state shared with every EngagementActions row.
//
// Design (matches the engagement realtime strategy):
//  - Counts come from the reports markers (the reports_map view, kept fresh by
//    pull-to-refresh on the feed and Realtime on the map). We only layer a small
//    optimistic override on top so the current user's own upvote/comment feels
//    instant before the authoritative count arrives.
//  - "Has the current user upvoted?" is fetched once per set of report ids, not
//    on every count change, so live count patches never trigger extra queries.
//  - Comment threads themselves live inline in the opened report details (see
//    CommentsSection); this provider only bumps the optimistic comment count
//    when a comment is posted (via notifyCommentAdded).
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { fetchMyUpvotedReportIds, toggleReportUpvote } from '../../lib/engagement';
import { type MapReportMarker } from '../../lib/reports';

export type EngagementState = {
  upvoteCount: number;
  commentCount: number;
  hasUpvoted: boolean;
};

type CountOverride = { upvoteCount?: number; commentCount?: number };

type EngagementContextValue = {
  getState: (report: MapReportMarker) => EngagementState;
  toggleUpvote: (report: MapReportMarker) => void;
  /** Optimistically bump a report's comment count after a comment is posted. */
  notifyCommentAdded: (reportId: string) => void;
};

const ReportEngagementContext = createContext<EngagementContextValue | null>(null);

/**
 * Engagement state falls back to the raw marker counts when no provider is
 * mounted, so an EngagementActions row always renders even outside a provider.
 */
export function useReportEngagement(): EngagementContextValue {
  const context = useContext(ReportEngagementContext);
  if (context) return context;
  return {
    getState: (report) => ({
      upvoteCount: report.upvoteCount,
      commentCount: report.commentCount,
      hasUpvoted: false,
    }),
    toggleUpvote: () => {},
    notifyCommentAdded: () => {},
  };
}

export function ReportEngagementProvider({
  reports,
  children,
}: {
  reports: MapReportMarker[];
  children: React.ReactNode;
}) {
  const [myUpvotes, setMyUpvotes] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Map<string, CountOverride>>(new Map());

  // Stable key for the current set of report ids — changes only when reports are
  // added/removed, not when their counts change (so map count patches are free).
  const reportIdsKey = useMemo(
    () => reports.map((report) => report.id).sort().join(','),
    [reports],
  );

  // Fetch the current user's upvotes once per set of visible reports.
  useEffect(() => {
    let cancelled = false;
    const ids = reportIdsKey ? reportIdsKey.split(',') : [];
    void (async () => {
      const upvoted = await fetchMyUpvotedReportIds(ids);
      if (!cancelled) setMyUpvotes(upvoted);
    })();
    return () => {
      cancelled = true;
    };
  }, [reportIdsKey]);

  // Drop an optimistic override once the authoritative marker count matches it
  // (server caught up via refresh/Realtime). Overrides for reports whose count
  // hasn't caught up yet are kept.
  useEffect(() => {
    setOverrides((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      for (const [id, override] of prev) {
        const marker = reports.find((report) => report.id === id);
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
  }, [reports]);

  const getState = useCallback(
    (report: MapReportMarker): EngagementState => {
      const override = overrides.get(report.id);
      return {
        upvoteCount: override?.upvoteCount ?? report.upvoteCount,
        commentCount: override?.commentCount ?? report.commentCount,
        hasUpvoted: myUpvotes.has(report.id),
      };
    },
    [overrides, myUpvotes],
  );

  const toggleUpvote = useCallback(
    (report: MapReportMarker) => {
      // Pending (offline-queue) reports are not on the server yet.
      if (report.isPending) return;

      const currentlyUpvoted = myUpvotes.has(report.id);
      const base = overrides.get(report.id)?.upvoteCount ?? report.upvoteCount;
      const nextUpvoted = !currentlyUpvoted;
      const nextCount = Math.max(0, base + (nextUpvoted ? 1 : -1));

      // Optimistic: flip the vote + count immediately.
      setMyUpvotes((prev) => {
        const next = new Set(prev);
        if (nextUpvoted) next.add(report.id);
        else next.delete(report.id);
        return next;
      });
      setOverrides((prev) => {
        const next = new Map(prev);
        next.set(report.id, { ...next.get(report.id), upvoteCount: nextCount });
        return next;
      });

      void (async () => {
        const { error } = await toggleReportUpvote(report.id, nextUpvoted);
        if (!error) return;
        // Revert on failure.
        setMyUpvotes((prev) => {
          const next = new Set(prev);
          if (nextUpvoted) next.delete(report.id);
          else next.add(report.id);
          return next;
        });
        setOverrides((prev) => {
          const next = new Map(prev);
          const override = { ...next.get(report.id) };
          delete override.upvoteCount;
          if (override.commentCount === undefined) next.delete(report.id);
          else next.set(report.id, override);
          return next;
        });
      })();
    },
    [myUpvotes, overrides],
  );

  const notifyCommentAdded = useCallback(
    (reportId: string) => {
      const marker = reports.find((report) => report.id === reportId);
      const base =
        overrides.get(reportId)?.commentCount ?? marker?.commentCount ?? 0;
      setOverrides((prev) => {
        const next = new Map(prev);
        next.set(reportId, { ...next.get(reportId), commentCount: base + 1 });
        return next;
      });
    },
    [reports, overrides],
  );

  const value = useMemo(
    () => ({ getState, toggleUpvote, notifyCommentAdded }),
    [getState, toggleUpvote, notifyCommentAdded],
  );

  return (
    <ReportEngagementContext.Provider value={value}>
      {children}
    </ReportEngagementContext.Provider>
  );
}
