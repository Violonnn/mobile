// hooks/useComments.ts — paged comment data for one opened report.
// Top-level comments start at 3 and grow by 5. Replies remain collapsed and,
// when opened, also grow by 5. Realtime reloads only the currently visible
// pages for this report.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addReportComment,
  fetchCommentReplies,
  fetchTopLevelComments,
  type ReportComment,
} from '../lib/comments';
import { supabase } from '../lib/supabase';
import { useRealtimeChannelName } from './useRealtimeChannelName';

const INITIAL_COMMENT_COUNT = 3;
const PAGE_SIZE = 5;

export type ReplyPageState = {
  replies: ReportComment[];
  total: number;
  limit: number;
  loading: boolean;
  error: string | null;
};

export function useComments(
  reportId: string | null,
  options?: { includeHidden?: boolean; targetKind?: 'report' | 'incident' },
) {
  const includeHidden = options?.includeHidden ?? false;
  const targetKind = options?.targetKind ?? 'report';
  const [comments, setComments] = useState<ReportComment[]>([]);
  const [totalComments, setTotalComments] = useState(0);
  const [commentLimit, setCommentLimit] = useState(INITIAL_COMMENT_COUNT);
  const [replyPages, setReplyPages] = useState<Map<string, ReplyPageState>>(
    new Map(),
  );
  const replyPagesRef = useRef(replyPages);
  const [loading, setLoading] = useState(Boolean(reportId));
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const threadKey = `${targetKind}:${reportId ?? 'none'}`;
  const [previousThreadKey, setPreviousThreadKey] = useState(threadKey);

  if (threadKey !== previousThreadKey) {
    setPreviousThreadKey(threadKey);
    setComments([]);
    setTotalComments(0);
    setCommentLimit(INITIAL_COMMENT_COUNT);
    setReplyPages(new Map());
    setError(null);
    setLoading(Boolean(reportId));
  }

  useEffect(() => {
    replyPagesRef.current = replyPages;
  }, [replyPages]);

  // Unique channel name so reopening a sheet never collides with a stale channel.
  const channelName = useRealtimeChannelName(`${targetKind}-comments-${reportId ?? 'none'}`);

  const load = useCallback(async () => {
    if (!reportId) return;
    const {
      comments: fetched,
      total,
      error: fetchError,
    } = await fetchTopLevelComments(reportId, commentLimit, includeHidden, targetKind);
    setLoading(false);
    setLoadingMore(false);
    if (fetchError) {
      setError(fetchError);
      return;
    }
    setError(null);
    setComments(fetched);
    setTotalComments(total);
  }, [reportId, commentLimit, includeHidden, targetKind]);

  const loadReplies = useCallback(
    async (parentCommentId: string, limit: number) => {
      if (!reportId) return;
      setReplyPages((current) => {
        const next = new Map(current);
        const existing = next.get(parentCommentId);
        next.set(parentCommentId, {
          replies: existing?.replies ?? [],
          total: existing?.total ?? 0,
          limit,
          loading: true,
          error: null,
        });
        return next;
      });

      const result = await fetchCommentReplies(
        reportId,
        parentCommentId,
        limit,
        includeHidden,
        targetKind,
      );
      setReplyPages((current) => {
        const next = new Map(current);
        next.set(parentCommentId, {
          replies: result.comments,
          total: result.total,
          limit,
          loading: false,
          error: result.error,
        });
        return next;
      });
    },
    [reportId, includeHidden, targetKind],
  );

  const reloadVisible = useCallback(async () => {
    await load();
    await Promise.all(
      Array.from(replyPagesRef.current.entries()).map(([parentId, page]) =>
        loadReplies(parentId, page.limit),
      ),
    );
  }, [load, loadReplies]);

  // Reset + fetch whenever the selected report changes.
  useEffect(() => {
    if (!reportId) return;
    const loadTimer = setTimeout(() => void load(), 0);
    return () => clearTimeout(loadTimer);
  }, [reportId, load]);

  // Live thread: refetch on any change to this report's comments.
  useEffect(() => {
    if (!reportId) return;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: targetKind === 'incident' ? 'incident_comments' : 'comments',
          filter: `${targetKind === 'incident' ? 'incident_case_id' : 'report_id'}=eq.${reportId}`,
        },
        () => void reloadVisible(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reportId, channelName, reloadVisible, targetKind]);

  const loadMoreComments = useCallback(() => {
    if (loadingMore || comments.length >= totalComments) return;
    setLoadingMore(true);
    setCommentLimit((current) => current + PAGE_SIZE);
  }, [loadingMore, comments.length, totalComments]);

  const showReplies = useCallback(
    (parentCommentId: string) => {
      void loadReplies(parentCommentId, PAGE_SIZE);
    },
    [loadReplies],
  );

  const hideReplies = useCallback((parentCommentId: string) => {
    setReplyPages((current) => {
      const next = new Map(current);
      next.delete(parentCommentId);
      return next;
    });
  }, []);

  const loadMoreReplies = useCallback(
    (parentCommentId: string) => {
      const page = replyPages.get(parentCommentId);
      if (!page || page.loading || page.replies.length >= page.total) return;
      void loadReplies(parentCommentId, page.limit + PAGE_SIZE);
    },
    [loadReplies, replyPages],
  );

  const addComment = useCallback(
    async (body: string, parentCommentId: string | null = null) => {
      if (!reportId) return { error: 'No report selected.' };
      setSubmitting(true);
      const { error: submitError } = await addReportComment(
        reportId,
        body,
        parentCommentId,
        targetKind,
      );
      if (!submitError) {
        await load();
        if (parentCommentId) {
          const currentLimit =
            replyPages.get(parentCommentId)?.limit ?? PAGE_SIZE;
          await loadReplies(parentCommentId, currentLimit);
        }
      }
      setSubmitting(false);
      return { error: submitError };
    },
    [reportId, load, loadReplies, replyPages, targetKind],
  );

  return {
    comments,
    totalComments,
    replyPages,
    loading,
    loadingMore,
    error,
    submitting,
    addComment,
    loadMoreComments,
    showReplies,
    hideReplies,
    loadMoreReplies,
    reload: reloadVisible,
  };
}
