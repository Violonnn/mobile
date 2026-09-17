import { useCallback, useEffect, useMemo, useState } from 'react';

import { getActiveSession } from '../lib/auth';
import {
  deleteNotification,
  fetchMyNotifications,
  updateNotificationReadState,
  type InAppNotification,
} from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { useRealtimeChannelName } from './useRealtimeChannelName';

export function useNotifications() {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelName = useRealtimeChannelName('my-notifications');

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await fetchMyNotifications();
    setNotifications(result.notifications);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    const initialLoadTimer = setTimeout(() => void reload(), 0);
    return () => clearTimeout(initialLoadTimer);
  }, [reload]);

  useEffect(() => {
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
  }, [channelName, reload]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  );

  const setReadState = useCallback(async (
    notificationId: string,
    isRead: boolean,
  ) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, isRead }
          : notification,
      ),
    );

    const updateError = await updateNotificationReadState(notificationId, isRead);
    if (updateError) {
      setError(updateError);
      void reload();
    }
  }, [reload]);

  const removeNotification = useCallback(async (notificationId: string) => {
    setNotifications((current) =>
      current.filter((notification) => notification.id !== notificationId),
    );

    const deleteError = await deleteNotification(notificationId);
    if (deleteError) {
      setError(deleteError);
      void reload();
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
