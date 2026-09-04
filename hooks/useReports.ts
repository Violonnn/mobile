// hooks/useReports.ts — shared report-loading logic for the map and feed.
// Loads reports on focus and refreshes when a local report is queued/uploaded.
// With `realtime: true` (default) it also stays live via a Supabase Realtime
// subscription; the feed opts out and relies on pull-to-refresh instead.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { fetchMapReports, type MapReportMarker } from '../lib/reports';
import { onReportQueueChange } from '../lib/reportQueueFlush';
import { supabase } from '../lib/supabase';

type UseReportsOptions = {
  /** Subscribe to live database changes. Defaults to true (used by the map). */
  realtime?: boolean;
  /** Restrict map loading and Realtime to one barangay when an official is scoped. */
  barangayId?: string | null;
  /** Resident maps may show their local upload queue; official maps must not. */
  includePending?: boolean;
};

export function useReports({
  realtime = true,
  barangayId = null,
  includePending = true,
}: UseReportsOptions = {}) {
  const [reports, setReports] = useState<MapReportMarker[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Unique channel name per hook instance so the map and feed subscriptions
  // (which can be mounted at the same time) never collide.
  const channelName = useMemo(
    () => `reports-${Math.random().toString(36).slice(2)}`,
    [],
  );

  // Latest reports kept in a ref so the Realtime handler can diff an incoming
  // row against what we already have without re-subscribing on every change.
  const reportsRef = useRef<MapReportMarker[]>([]);
  useEffect(() => {
    reportsRef.current = reports;
  }, [reports]);

  const load = useCallback(async () => {
    const { reports: fetched, error: fetchError } = await fetchMapReports({
      barangayId,
      includePending,
    });
    setLoading(false);
    if (fetchError) {
      setError(fetchError);
      return;
    }
    setError(null);
    setReports(fetched);
  }, [barangayId, includePending]);

  // Decide how to react to a live `reports` change. Inserts, deletes, and edits
  // to pin-relevant fields (title/description/status) trigger a full reload
  // (which also re-signs media). An update that only moves the engagement
  // counters is patched in place — no refetch, no media re-signing, and no
  // Leaflet rebuild — so social activity stays cheap.
  const handleRealtimeChange = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType !== 'UPDATE') {
        void load();
        return;
      }

      const next = payload.new as Record<string, unknown>;
      const id = next?.id ? String(next.id) : null;
      if (!id) {
        void load();
        return;
      }

      const existing = reportsRef.current.find((report) => report.id === id);
      if (!existing) {
        void load();
        return;
      }

      // Anything that affects the pin or the open detail card (not just counts)
      // warrants a full reload so media/location stay in sync.
      const nextAddress = next.address_text == null ? null : String(next.address_text);
      const nextBarangayId = next.barangay_id == null ? null : String(next.barangay_id);
      const nextLatitude = Number(next.latitude ?? existing.latitude);
      const nextLongitude = Number(next.longitude ?? existing.longitude);
      const pinFieldsChanged =
        String(next.title ?? '') !== existing.title ||
        String(next.description ?? '') !== existing.description ||
        String(next.status ?? '') !== existing.status ||
        nextAddress !== existing.addressText ||
        nextBarangayId !== existing.barangay_id ||
        nextLatitude !== existing.latitude ||
        nextLongitude !== existing.longitude;
      if (pinFieldsChanged) {
        void load();
        return;
      }

      const nextUpvote = Number(next.upvote_count ?? existing.upvoteCount);
      const nextComment = Number(next.comment_count ?? existing.commentCount);
      if (
        nextUpvote === existing.upvoteCount &&
        nextComment === existing.commentCount
      ) {
        return;
      }

      setReports((prev) =>
        prev.map((report) =>
          report.id === id
            ? { ...report, upvoteCount: nextUpvote, commentCount: nextComment }
            : report,
        ),
      );
    },
    [load],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Refresh when a local report is queued or finishes uploading.
  useEffect(() => onReportQueueChange(() => void load()), [load]);

  useEffect(() => {
    if (!realtime) return;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reports',
          ...(barangayId ? { filter: `barangay_id=eq.${barangayId}` } : {}),
        },
        handleRealtimeChange,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [realtime, channelName, handleRealtimeChange, barangayId]);

  return { reports, error, loading, reload: load };
}
