import { useCallback, useEffect, useState } from 'react';

import {
  fetchPrioritizedReportComments,
  type ReportComment,
} from '../lib/comments';
import { supabase } from '../lib/supabase';
import { useRealtimeChannelName } from './useRealtimeChannelName';

/** Read-only, three-comment summary used only by the resident map details. */
export function usePrioritizedReportComments(
  reportId: string | null,
  refreshSignal = 0,
) {
  const [comments, setComments] = useState<ReportComment[]>([]);
  const [loading, setLoading] = useState(Boolean(reportId));
  const [error, setError] = useState<string | null>(null);
  const channelName = useRealtimeChannelName(
    `map-comment-highlights-${reportId ?? 'none'}`,
  );

  const load = useCallback(async () => {
    if (!reportId) {
      setComments([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const result = await fetchPrioritizedReportComments(reportId);
    setLoading(false);
    setError(result.error);
    if (result.error) return;
    setComments(result.comments);
  }, [reportId]);

  useEffect(() => {
    const loadTimer = setTimeout(() => void load(), 0);
    return () => clearTimeout(loadTimer);
  }, [load, refreshSignal]);

  useEffect(() => {
    if (!reportId) return;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `report_id=eq.${reportId}`,
        },
        () => void load(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelName, load, reportId]);

  return { comments, loading, error, reload: load };
}
