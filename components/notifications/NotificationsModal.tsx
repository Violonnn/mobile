import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNotifications } from '../../context/NotificationsContext';
import {
  groupNotificationsByDate,
  type NotificationDateSection,
} from '../../lib/notificationDates';
import {
  notificationColors,
  notificationStyles as styles,
} from '../../styles/components/notifications.styles';
import { colors } from '../../styles/theme';
import NotificationMailContent, {
  toRemoteNotificationItem,
  type NotificationDisplayItem,
} from './NotificationMailContent';
import { ListRowsSkeleton } from '../ui/ResidentScreenSkeletons';

type Props = {
  visible: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
  highlightedNotificationId?: string | null;
};

export default function NotificationsModal({
  visible,
  onClose,
  onUnreadCountChange,
  highlightedNotificationId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [slideTranslateX] = useState(() => new Animated.Value(screenWidth));
  const [isClosing, setIsClosing] = useState(false);
  const {
    notifications,
    unreadCount,
    loading,
    error,
    reload,
    setReadState,
    removeNotification,
  } = useNotifications();
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [localActionError, setLocalActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    slideTranslateX.setValue(screenWidth);
    const animationFrame = requestAnimationFrame(() => {
      Animated.timing(slideTranslateX, {
        toValue: 0,
        duration: 270,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      slideTranslateX.stopAnimation();
    };
  }, [screenWidth, slideTranslateX, visible]);

  const closeScreen = useCallback(
    (afterClose?: () => void) => {
      if (isClosing) return;
      setIsClosing(true);

      Animated.timing(slideTranslateX, {
        toValue: screenWidth,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setIsClosing(false);
        onClose();
        afterClose?.();
      });
    },
    [isClosing, onClose, screenWidth, slideTranslateX],
  );

  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [onUnreadCountChange, unreadCount]);

  const items = useMemo(() => {
    return notifications.map(toRemoteNotificationItem).sort(
      (first, second) =>
        new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
    );
  }, [notifications]);

  const sections: NotificationDateSection<NotificationDisplayItem>[] = useMemo(
    () => groupNotificationsByDate(items),
    [items],
  );

  const refreshing = loading;

  const openNotification = useCallback(
    (item: NotificationDisplayItem) => {
      if (item.remoteId && !item.isRead) {
        // Reading is optimistic so navigation never waits on the network.
        void setReadState(item.remoteId, true);
      }

      if (item.relatedEntityType !== 'report' || !item.relatedEntityId) return;

      const reportId = item.relatedEntityId;
      closeScreen(() => {
        if (pathname.startsWith('/official')) {
          router.push(`/official/${reportId}` as Href);
          return;
        }

        router.push({
          pathname: '/(main)/map',
          params: { reportId, fromNotification: '1' },
        });
      });
    },
    [closeScreen, pathname, router, setReadState],
  );

  const toggleReadState = useCallback(async (item: NotificationDisplayItem) => {
    if (pendingActionId) return;
    setPendingActionId(item.id);
    setLocalActionError(null);

    try {
      if (item.remoteId) {
        await setReadState(item.remoteId, !item.isRead);
      }
    } catch {
      setLocalActionError('The notification could not be updated.');
    } finally {
      setPendingActionId(null);
    }
  }, [pendingActionId, setReadState]);

  const deleteNotificationItem = useCallback(async (
    item: NotificationDisplayItem,
  ) => {
    if (pendingActionId) return;
    setPendingActionId(item.id);
    setLocalActionError(null);

    try {
      if (item.remoteId) {
        await removeNotification(item.remoteId);
      }
    } catch {
      setLocalActionError('The notification could not be deleted.');
    } finally {
      setPendingActionId(null);
    }
  }, [pendingActionId, removeNotification]);

  const confirmDelete = useCallback((item: NotificationDisplayItem) => {
    if (pendingActionId) return;
    Alert.alert(
      'Delete notification?',
      'This removes the notification only. The incident report will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void deleteNotificationItem(item),
        },
      ],
    );
  }, [deleteNotificationItem, pendingActionId]);

  const handleRefresh = useCallback(async () => {
    setLocalActionError(null);
    await reload();
  }, [reload]);

  const visibleError = error ?? localActionError;

  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={() => closeScreen()}
    >
      <GestureHandlerRootView style={styles.screen}>
        <Animated.View
          style={[styles.screen, { transform: [{ translateX: slideTranslateX }] }]}
        >
          <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <StatusBar style="dark" />
          <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => closeScreen()}
            disabled={isClosing}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Notifications</Text>
          </View>

        {refreshing && items.length === 0 ? (
          <ListRowsSkeleton rows={6} />
        ) : visibleError && items.length === 0 ? (
          <View style={styles.state}>
            <View style={styles.stateIcon}>
              <Ionicons name="cloud-offline-outline" size={28} color={colors.navigationActive} />
            </View>
            <Text style={styles.stateTitle}>Notifications could not load</Text>
            <Text style={styles.stateBody}>Check your connection and try again.</Text>
            <TouchableOpacity style={styles.retryBar} onPress={() => void handleRefresh()}>
              <Ionicons name="refresh" size={17} color={colors.navigationActive} />
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : sections.length === 0 ? (
          <View style={styles.state}>
            <View style={styles.stateIcon}>
              <Ionicons name="notifications-outline" size={29} color={colors.navigationActive} />
            </View>
            <Text style={styles.stateTitle}>You&apos;re all caught up</Text>
            <Text style={styles.stateBody}>
              Updates about your reports and discussions will appear here.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />
            }
          >
            {visibleError ? (
              <TouchableOpacity style={styles.retryBar} onPress={() => void handleRefresh()}>
                <Ionicons name="refresh" size={17} color={colors.navigationActive} />
                <Text style={styles.retryText}>Some updates could not refresh</Text>
              </TouchableOpacity>
            ) : null}

            {sections.map((section) => (
              <View key={section.key} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.items.map((item) => (
                  <Swipeable
                    key={item.id}
                    enabled={pendingActionId == null}
                    friction={1.8}
                    rightThreshold={52}
                    overshootRight={false}
                    containerStyle={styles.swipeContainer}
                    childrenContainerStyle={styles.swipeContent}
                    renderRightActions={(_progress, _translation, swipeableMethods) => (
                      <View style={styles.swipeActions}>
                        <TouchableOpacity
                          style={styles.swipeAction}
                          onPress={() => {
                            swipeableMethods.close();
                            void toggleReadState(item);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={item.isRead ? 'Mark as unread' : 'Mark as read'}
                        >
                          <Ionicons
                            name={item.isRead ? 'mail-unread-outline' : 'mail-open-outline'}
                            size={21}
                            color={notificationColors.actionRead}
                          />
                          <Text style={styles.swipeReadText}>
                            {item.isRead ? 'Mark unread' : 'Mark read'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.swipeAction}
                          onPress={() => {
                            swipeableMethods.close();
                            confirmDelete(item);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Delete notification"
                        >
                          <Ionicons
                            name="trash-outline"
                            size={21}
                            color={notificationColors.actionDelete}
                          />
                          <Text style={styles.swipeDeleteText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  >
                    <TouchableOpacity
                      style={[
                        styles.row,
                        !item.isRead && styles.rowUnread,
                        item.id === highlightedNotificationId && styles.rowHighlighted,
                      ]}
                      onPress={() => openNotification(item)}
                      activeOpacity={0.72}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.actorName ? `${item.actorName}. ` : ''}${item.title}. ${item.body}`}
                    >
                      <NotificationMailContent
                        item={item}
                        trailing={item.isRead ? 'none' : 'unread-dot'}
                      />
                    </TouchableOpacity>
                  </Swipeable>
                ))}
              </View>
            ))}

          </ScrollView>
        )}

          </SafeAreaView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
