import { useCallback, useEffect, useState } from 'react';

import {
  fetchPrioritizedReportComments,
  type ReportComment,
} from '../lib/comments';
import { supabase } from '../lib/supabase';
import { useRealtimeChannelName } from './useRealtimeChannelName';

/** Read-only, three-comment summary used by resident map and Home details. */
export function usePrioritizedReportComments(
  targetId: string | null,
  refreshSignal = 0,
  targetKind: 'report' | 'incident' = 'report',
) {
  const [comments, setComments] = useState<ReportComment[]>([]);
  const [loading, setLoading] = useState(Boolean(targetId));
  const [error, setError] = useState<string | null>(null);
  const channelName = useRealtimeChannelName(
    `map-comment-highlights-${targetId ?? 'none'}`,
  );

  const load = useCallback(async () => {
    if (!targetId) {
      setComments([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const result = await fetchPrioritizedReportComments(targetId, targetKind);
    setLoading(false);
    setError(result.error);
    if (result.error) return;
    setComments(result.comments);
  }, [targetId, targetKind]);

  useEffect(() => {
    const loadTimer = setTimeout(() => void load(), 0);
    return () => clearTimeout(loadTimer);
  }, [load, refreshSignal]);

  useEffect(() => {
    // Incident comments are refreshed by the parent's public-record poll instead
    // of subscribing residents to the incident discussion table.
    if (!targetId || targetKind !== 'report') return;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `report_id=eq.${targetId}`,
        },
        () => void load(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelName, load, targetId, targetKind]);

  return { comments, loading, error, reload: load };
}
