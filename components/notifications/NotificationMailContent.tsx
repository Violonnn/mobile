import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatPublishedAt } from '../../lib/formatTime';
import type { InAppNotification } from '../../lib/notifications';
import {
  notificationColors,
  notificationStyles as styles,
} from '../../styles/components/notifications.styles';
import { colors } from '../../styles/theme';
import ProfileAvatar from '../profile/ProfileAvatar';

export type NotificationDisplayItem = {
  id: string;
  remoteId: string | null;
  type: string;
  title: string;
  body: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  isRead: boolean;
  createdAt: string;
  actorInitials: string | null;
  actorName: string | null;
  actorAvatarPath: string | null;
};

type IconPresentation = {
  name: React.ComponentProps<typeof Ionicons>['name'];
  foreground: string;
  background: string;
};

type NotificationMailContentProps = {
  item: NotificationDisplayItem;
  trailing: 'unread-dot' | 'chevron' | 'none';
};

function actorInitials(notification: InAppNotification): string | null {
  if (!notification.actor) return null;

  const firstInitial = notification.actor.firstName.trim().charAt(0);
  const lastInitial = notification.actor.lastName.trim().charAt(0);
  return `${firstInitial}${lastInitial}`.toLocaleUpperCase() || null;
}

function actorName(notification: InAppNotification): string | null {
  if (!notification.actor) return null;

  const name = [notification.actor.firstName, notification.actor.lastName]
    .map((namePart) => namePart.trim())
    .filter(Boolean)
    .join(' ');

  return name || null;
}

function actionText(item: NotificationDisplayItem): string {
  if (!item.actorName) return item.body;

  // Trigger copy uses generic subjects, which are redundant once an actor is shown.
  return item.body
    .replace(/^Someone\s+/i, '')
    .replace(/^An official\s+/i, '')
    .replace(/^Responders\s+/i, '');
}

function iconForType(type: string): IconPresentation {
  if (type === 'report_verified') {
    return {
      name: 'eye',
      foreground: notificationColors.verified,
      background: notificationColors.verifiedSoft,
    };
  }

  if (type === 'report_resolved') {
    return {
      name: 'flag',
      foreground: notificationColors.verified,
      background: notificationColors.verifiedSoft,
    };
  }

  if (type === 'report_commented') {
    return {
      name: 'chatbubble',
      foreground: notificationColors.comment,
      background: notificationColors.commentSoft,
    };
  }

  if (type === 'report_upvoted') {
    return {
      name: 'arrow-up',
      foreground: notificationColors.upvote,
      background: notificationColors.upvoteSoft,
    };
  }

  if (type === 'report_escalated') {
    return {
      name: 'arrow-up-circle',
      foreground: notificationColors.warning,
      background: notificationColors.warningSoft,
    };
  }

  return {
    name: 'create',
    foreground: colors.primary,
    background: colors.primaryLight,
  };
}

export function toRemoteNotificationItem(
  notification: InAppNotification,
): NotificationDisplayItem {
  return {
    id: `remote-${notification.id}`,
    remoteId: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    relatedEntityType: notification.relatedEntityType,
    relatedEntityId: notification.relatedEntityId,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
    actorInitials: actorInitials(notification),
    actorName: actorName(notification),
    actorAvatarPath: notification.actor?.avatarPath ?? null,
  };
}

function NotificationAvatar({ item }: { item: NotificationDisplayItem }) {
  const icon = iconForType(item.type);
  const systemIcon = 'notifications-outline';

  return (
    <View style={styles.avatarWrap}>
      {item.actorInitials ? (
        <ProfileAvatar
          avatarPath={item.actorAvatarPath}
          fallback={item.actorInitials}
          size={44}
          style={styles.avatar}
          textStyle={styles.avatarText}
          accessibilityLabel={`${item.actorName || 'User'} profile picture`}
        />
      ) : (
        <View style={styles.avatar}>
          <Ionicons name={systemIcon} size={22} color={colors.navigationActive} />
        </View>
      )}
      <View style={[styles.typeBadge, { backgroundColor: icon.background }]}>
        <Ionicons name={icon.name} size={12} color={icon.foreground} />
      </View>
    </View>
  );
}

export default function NotificationMailContent({
  item,
  trailing,
}: NotificationMailContentProps) {
  return (
    <>
      <NotificationAvatar item={item} />
      <View style={styles.copy}>
        <Text style={styles.messageLine}>
          <Text style={styles.messageTitle}>
            {item.actorName ?? item.title}
          </Text>{' '}
          {actionText(item)}{' '}
          <Text style={styles.time}>{formatPublishedAt(item.createdAt)}</Text>
        </Text>
      </View>
      {trailing === 'unread-dot' ? <View style={styles.unreadDot} /> : null}
      {trailing === 'chevron' ? (
        <Ionicons
          name="chevron-forward"
          size={22}
          color={colors.navigationActive}
          style={styles.popupChevron}
        />
      ) : null}
    </>
  );
}
