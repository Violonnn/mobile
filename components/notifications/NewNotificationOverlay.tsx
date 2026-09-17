import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNotifications } from '../../hooks/useNotifications';
import { notificationStyles as styles } from '../../styles/components/notifications.styles';
import { spacing } from '../../styles/theme';
import NotificationMailContent, {
  toRemoteNotificationItem,
  type NotificationDisplayItem,
} from './NotificationMailContent';
import NotificationsModal from './NotificationsModal';

const POPUP_VISIBLE_DURATION_MS = 6000;
const POPUP_HIDDEN_OFFSET = -180;

export default function NewNotificationOverlay() {
  const insets = useSafeAreaInsets();
  const { notifications, loading, error } = useNotifications();
  const knownNotificationIds = useRef<Set<string> | null>(null);
  const [translateY] = useState(
    () => new Animated.Value(POPUP_HIDDEN_OFFSET),
  );
  const [pendingNotifications, setPendingNotifications] =
    useState<NotificationDisplayItem[]>([]);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [highlightedNotificationId, setHighlightedNotificationId] =
    useState<string | null>(null);

  useEffect(() => {
    if (loading || error) return;

    const currentIds = new Set(
      notifications.map((notification) => notification.id),
    );

    // The first successful load establishes a baseline so old mail does not pop up.
    if (!knownNotificationIds.current) {
      knownNotificationIds.current = currentIds;
      return;
    }

    const newlyReceivedNotifications = notifications.filter(
      (notification) => !knownNotificationIds.current?.has(notification.id),
    );

    currentIds.forEach((notificationId) => {
      knownNotificationIds.current?.add(notificationId);
    });

    if (newlyReceivedNotifications.length > 0) {
      // Show burst arrivals in the order they were created.
      setPendingNotifications((currentNotifications) => [
        ...currentNotifications,
        ...newlyReceivedNotifications.reverse().map(toRemoteNotificationItem),
      ]);
    }
  }, [error, loading, notifications]);

  const popupNotification = pendingNotifications[0] ?? null;

  const dismissPopup = useCallback(() => {
    Animated.timing(translateY, {
      toValue: POPUP_HIDDEN_OFFSET,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setPendingNotifications((currentNotifications) =>
          currentNotifications.slice(1),
        );
      }
    });
  }, [translateY]);

  useEffect(() => {
    if (!popupNotification || inboxOpen) return;

    translateY.setValue(POPUP_HIDDEN_OFFSET);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const dismissTimer = setTimeout(dismissPopup, POPUP_VISIBLE_DURATION_MS);

    return () => {
      clearTimeout(dismissTimer);
      translateY.stopAnimation();
    };
  }, [dismissPopup, inboxOpen, popupNotification, translateY]);

  const openHighlightedNotification = useCallback(() => {
    if (!popupNotification) return;

    // Opening the inbox only focuses the mail; its unread state is unchanged.
    setHighlightedNotificationId(popupNotification.id);
    setPendingNotifications((currentNotifications) =>
      currentNotifications.slice(1),
    );
    setInboxOpen(true);
  }, [popupNotification]);

  const closeInbox = useCallback(() => {
    setInboxOpen(false);
    setHighlightedNotificationId(null);
  }, []);

  return (
    <>
      <View pointerEvents="box-none" style={styles.popupLayer}>
        {popupNotification && !inboxOpen ? (
          <Animated.View
            style={[
              styles.popupPosition,
              {
                paddingTop: insets.top + spacing.sm,
                transform: [{ translateY }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.popupCard}
              onPress={openHighlightedNotification}
              activeOpacity={0.84}
              accessibilityRole="button"
              accessibilityLabel={`Open notifications. ${popupNotification.actorName ?? popupNotification.title}. ${popupNotification.body}`}
            >
              <NotificationMailContent
                item={popupNotification}
                trailing="chevron"
              />
            </TouchableOpacity>
          </Animated.View>
        ) : null}
      </View>

      <NotificationsModal
        visible={inboxOpen}
        onClose={closeInbox}
        highlightedNotificationId={highlightedNotificationId}
      />
    </>
  );
}
