import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getActiveSession } from '../lib/auth';
import {
  deleteNotification,
  fetchMyNotifications,
  updateNotificationReadState,
  type InAppNotification,
} from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { useRealtimeChannelName } from './useRealtimeChannelName';

/** Standalone notification data for portals that do not mount the resident provider. */
export function useStandaloneNotifications(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const requestRef = useRef<Promise<void> | null>(null);
  const channelName = useRealtimeChannelName('my-notifications');

  const reload = useCallback(async () => {
    if (!enabled) return;
    if (requestRef.current) return requestRef.current;

    const request = (async () => {
      if (!hasLoadedRef.current) setLoading(true);
      const result = await fetchMyNotifications();
      if (!result.error) setNotifications(result.notifications);
      setError(result.error);
      hasLoadedRef.current = true;
      setLoading(false);
    })().finally(() => {
      requestRef.current = null;
    });

    requestRef.current = request;
    return request;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const initialLoadTimer = setTimeout(() => void reload(), 0);
    return () => clearTimeout(initialLoadTimer);
  }, [enabled, reload]);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    let cleanup: (() => void) | null = null;

    void getActiveSession().then((session) => {
      if (!active || !session?.user.id) return;

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${session.user.id}`,
          },
          () => void reload(),
        )
        .subscribe();

      cleanup = () => {
        void supabase.removeChannel(channel);
      };
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [channelName, enabled, reload]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  );

  const setReadState = useCallback(async (notificationId: string, isRead: boolean) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId ? { ...notification, isRead } : notification,
      ),
    );

    const updateError = await updateNotificationReadState(notificationId, isRead);
    if (updateError) {
      setError(updateError);
      await reload();
    }
  }, [reload]);

  const removeNotification = useCallback(async (notificationId: string) => {
    setNotifications((current) =>
      current.filter((notification) => notification.id !== notificationId),
    );

    const deleteError = await deleteNotification(notificationId);
    if (deleteError) {
      setError(deleteError);
      await reload();
    }
  }, [reload]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    reload,
    setReadState,
    removeNotification,
  };
}
