import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ProfileAvatar from '../profile/ProfileAvatar';
import { formatInviteScopeLabel, type InviteListItem } from '../../lib/invites';
import { maskInvitePhone } from '../../lib/officialRegistration';
import { adminStyles as styles } from '../../styles/screens/admin.styles';
import { colors } from '../../styles/theme';

type AdminInviteRowProps = {
  invite: InviteListItem;
  expiringSoon: boolean;
  onRevoke?: () => void;
  revokePending?: boolean;
  revokeError?: string | null;
};

function formatDate(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Date unavailable';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function inviteInitials(email: string): string {
  // Use only the displayed email's local part; the avatar makes no profile lookup.
  const localPart = email.split('@')[0] ?? '';
  // Separator-based initials stay readable while avoiding remote identity data.
  const nameParts = localPart.split(/[._+-]+/).filter(Boolean);
  if (nameParts.length > 1) {
    return nameParts.slice(0, 2).map((part) => part.charAt(0)).join('').toLocaleUpperCase();
  }

  return (nameParts[0]?.slice(0, 2) || 'U').toLocaleUpperCase();
}

function StatusIndicator({
  registered,
  expiringSoon,
}: {
  registered: boolean;
  expiringSoon: boolean;
}) {
  const label = registered ? 'Registered' : expiringSoon ? 'Expiring soon' : 'Pending';
  const dotStyle = registered
    ? styles.inviteStatusDotRegistered
    : expiringSoon
      ? styles.inviteStatusDotExpiring
      : styles.inviteStatusDotPending;
  const textStyle = registered
    ? styles.inviteStatusRegisteredText
    : expiringSoon
      ? styles.inviteStatusExpiringText
      : styles.inviteStatusPendingText;

  return (
    <View style={styles.inviteStatusLine}>
      <View style={[styles.inviteStatusDot, dotStyle]} />
      <Text style={[styles.inviteStatusText, textStyle]}>{label}</Text>
    </View>
  );
}

export default function AdminInviteRow({
  invite,
  expiringSoon,
  onRevoke,
  revokePending = false,
  revokeError,
}: AdminInviteRowProps) {
  const [expanded, setExpanded] = useState(false);
  const isRegistered = invite.list_group === 'used';
  const scopeLabel = formatInviteScopeLabel(invite);
  const relevantDate = isRegistered
    ? 'Registered ' + formatDate(invite.used_at)
    : 'Expires ' + formatDate(invite.expires_at);
  const statusLabel = isRegistered ? 'registered' : expiringSoon ? 'expiring soon' : 'pending';

  return (
    <View style={styles.inviteCard}>
      <Pressable
        style={styles.inviteHeader}
        onPress={() => setExpanded((currentValue) => !currentValue)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={
          (expanded ? 'Hide' : 'Show') +
          ' details for ' +
          invite.invited_email +
          ', ' +
          statusLabel
        }
      >
        <ProfileAvatar
          fallback={inviteInitials(invite.invited_email)}
          size={40}
          style={styles.inviteAvatar}
          textStyle={styles.inviteAvatarText}
          accessibilityLabel="Invite recipient initials"
        />
        <View style={styles.inviteMainCopy}>
          <View style={styles.inviteHeaderTop}>
            <Text style={styles.inviteEmail}>{invite.invited_email}</Text>
            <Ionicons
              name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
              size={18}
              color={colors.textMuted}
            />
          </View>
          <StatusIndicator registered={isRegistered} expiringSoon={expiringSoon} />
          <Text style={styles.inviteScope}>{scopeLabel}</Text>
          <View style={styles.inviteMetaRow}>
            <Text style={styles.inviteMeta}>{relevantDate}</Text>
            <Text style={styles.inviteMeta}>Mobile · {maskInvitePhone(invite.invited_phone)}</Text>
          </View>
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.inviteDetails}>
          <Text style={styles.inviteMeta}>Created · {formatDate(invite.created_at)}</Text>
          {!isRegistered && onRevoke ? (
            <>
              {!!revokeError && <Text style={styles.inviteError}>{revokeError}</Text>}
              <TouchableOpacity
                style={styles.revokeButton}
                onPress={onRevoke}
                disabled={revokePending}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Revoke invite"
                accessibilityState={{ disabled: revokePending, busy: revokePending }}
              >
                {revokePending ? (
                  <ActivityIndicator size="small" color={colors.unverified} />
                ) : (
                  <Text style={styles.revokeButtonText}>Revoke invite</Text>
                )}
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
