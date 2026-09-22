import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { getActiveSession } from '../lib/auth';
import {
  deleteNotification,
  fetchMyNotifications,
  updateNotificationReadState,
  type InAppNotification,
} from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { useRealtimeChannelName } from '../hooks/useRealtimeChannelName';
import { useStandaloneNotifications } from '../hooks/useNotifications';

type NotificationsContextValue = {
  notifications: InAppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setReadState: (notificationId: string, isRead: boolean) => Promise<void>;
  removeNotification: (notificationId: string) => Promise<void>;
  inboxOpen: boolean;
  highlightedNotificationId: string | null;
  openInbox: (notificationId?: string | null) => void;
  closeInbox: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: PropsWithChildren) {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [highlightedNotificationId, setHighlightedNotificationId] =
    useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const requestRef = useRef<Promise<void> | null>(null);
  const channelName = useRealtimeChannelName('my-notifications');

  const reload = useCallback(async () => {
    if (requestRef.current) return requestRef.current;

    const request = (async () => {
      if (!hasLoadedRef.current) setLoading(true);
      const result = await fetchMyNotifications();
      setError(result.error);
      hasLoadedRef.current = true;
      setLoading(false);
      if (!result.error) setNotifications(result.notifications);
    })().finally(() => {
      requestRef.current = null;
    });

    requestRef.current = request;
    return request;
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

  const openInbox = useCallback((notificationId?: string | null) => {
    setHighlightedNotificationId(notificationId ?? null);
    setInboxOpen(true);
  }, []);

  const closeInbox = useCallback(() => {
    setInboxOpen(false);
    setHighlightedNotificationId(null);
  }, []);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      loading,
      error,
      reload,
      setReadState,
      removeNotification,
      inboxOpen,
      highlightedNotificationId,
      openInbox,
      closeInbox,
    }),
    [
      closeInbox,
      error,
      highlightedNotificationId,
      inboxOpen,
      loading,
      notifications,
      openInbox,
      reload,
      removeNotification,
      setReadState,
      unreadCount,
    ],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const value = useContext(NotificationsContext);
  const standalone = useStandaloneNotifications({ enabled: value === null });
  const [standaloneInboxOpen, setStandaloneInboxOpen] = useState(false);
  const [standaloneHighlight, setStandaloneHighlight] = useState<string | null>(null);

  const standaloneValue = useMemo<NotificationsContextValue>(
    () => ({
      ...standalone,
      inboxOpen: standaloneInboxOpen,
      highlightedNotificationId: standaloneHighlight,
      openInbox: (notificationId?: string | null) => {
        setStandaloneHighlight(notificationId ?? null);
        setStandaloneInboxOpen(true);
      },
      closeInbox: () => {
        setStandaloneInboxOpen(false);
        setStandaloneHighlight(null);
      },
    }),
    [standalone, standaloneHighlight, standaloneInboxOpen],
  );

  return value ?? standaloneValue;
}
