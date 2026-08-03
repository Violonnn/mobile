// hooks/useAnnouncementComments.ts — paged comment data for one announcement.
// Mirrors useComments (report threads) with announcement-specific tables.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addAnnouncementComment,
  fetchAnnouncementCommentReplies,
  fetchTopLevelAnnouncementComments,
  type AnnouncementComment,
} from '../lib/announcementComments';
import { supabase } from '../lib/supabase';

const INITIAL_COMMENT_COUNT = 3;
const PAGE_SIZE = 5;

export type AnnouncementReplyPageState = {
  replies: AnnouncementComment[];
  total: number;
  limit: number;
  loading: boolean;
  error: string | null;
};

export function useAnnouncementComments(
  announcementId: string | null,
  options?: { includeHidden?: boolean },
) {
  const includeHidden = options?.includeHidden ?? false;
  const [comments, setComments] = useState<AnnouncementComment[]>([]);
  const [totalComments, setTotalComments] = useState(0);
  const [commentLimit, setCommentLimit] = useState(INITIAL_COMMENT_COUNT);
  const [replyPages, setReplyPages] = useState<Map<string, AnnouncementReplyPageState>>(
    new Map(),
  );
  const replyPagesRef = useRef(replyPages);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    replyPagesRef.current = replyPages;
  }, [replyPages]);

  const channelName = useMemo(
    () =>
      `announcement-comments-${announcementId ?? 'none'}-${Math.random().toString(36).slice(2)}`,
    [announcementId],
  );

  const load = useCallback(async () => {
    if (!announcementId) return;
    const {
      comments: fetched,
      total,
      error: fetchError,
    } = await fetchTopLevelAnnouncementComments(
      announcementId,
      commentLimit,
      includeHidden,
    );
    setLoading(false);
    setLoadingMore(false);
    if (fetchError) {
      setError(fetchError);
      return;
    }
    setError(null);
    setComments(fetched);
    setTotalComments(total);
  }, [announcementId, commentLimit, includeHidden]);

  const loadReplies = useCallback(
    async (parentCommentId: string, limit: number) => {
      if (!announcementId) return;
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

      const result = await fetchAnnouncementCommentReplies(
        announcementId,
        parentCommentId,
        limit,
        includeHidden,
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
    [announcementId, includeHidden],
  );

  const reloadVisible = useCallback(async () => {
    await load();
    await Promise.all(
      Array.from(replyPagesRef.current.entries()).map(([parentId, page]) =>
        loadReplies(parentId, page.limit),
      ),
    );
  }, [load, loadReplies]);

  useEffect(() => {
    if (!announcementId) {
      setComments([]);
      setTotalComments(0);
      setCommentLimit(INITIAL_COMMENT_COUNT);
      setReplyPages(new Map());
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void load();
  }, [announcementId, load]);

  useEffect(() => {
    if (!announcementId) return;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcement_comments',
          filter: `announcement_id=eq.${announcementId}`,
        },
        () => void reloadVisible(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [announcementId, channelName, reloadVisible]);

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
      if (!announcementId) return { error: 'No announcement selected.' };
      setSubmitting(true);
      const { error: submitError } = await addAnnouncementComment(
        announcementId,
        body,
        parentCommentId,
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
    [announcementId, load, loadReplies, replyPages],
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
