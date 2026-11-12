import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useShareSheetGuard } from '../../hooks/useShareSheetGuard';
import {
  publicIncidentLocationLabel,
  publicIncidentStatusLabel,
  type PublicIncident,
} from '../../lib/publicIncidents';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';
import {
  PublicIncidentCopy,
  PublicIncidentHeader,
  PublicIncidentHero,
  PublicIncidentLatestUpdate,
  PublicIncidentTags,
  publicIncidentCaption,
  publicIncidentHasMapLocation,
  publicIncidentTitle,
} from './PublicIncidentPost';
import { reportDetailStyles, residentFeedStyles } from './ReportDetailCard';

type Props = {
  incident: PublicIncident;
  onPress: () => void;
  onRequestComments?: () => void;
  onToggleSupport?: () => void;
  supportBusy?: boolean;
  onViewOnMap?: () => void;
  showMapAction?: boolean;
  isLast?: boolean;
};

/** Community report post: same social layout as resident reports and official updates. */
export default function PublicIncidentCard({
  incident,
  onPress,
  onRequestComments,
  onToggleSupport,
  supportBusy = false,
  onViewOnMap,
  showMapAction = true,
  isLast = false,
}: Props): React.JSX.Element {
  const { shareSafely, canOpenCard } = useShareSheetGuard();
  const { upvoteCount, commentCount, hasUpvoted } = incident.engagement;
  const isWithdrawn = incident.publicStatus === 'withdrawn';
  const canShowOnMap = showMapAction && Boolean(onViewOnMap) && publicIncidentHasMapLocation(incident);

  const shareIncident = () => {
    const title = publicIncidentTitle(incident);
    void shareSafely({
      title,
      message: `${title}\n${publicIncidentCaption(incident)}\n${publicIncidentLocationLabel(incident)}`,
    });
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${publicIncidentTitle(incident)}, ${publicIncidentStatusLabel(incident.publicStatus)}, Brgy. ${incident.barangayName}`}
      accessibilityHint="Opens the report details and discussion"
      onPress={() => {
        if (!canOpenCard()) return;
        onPress();
      }}
      style={[reportDetailStyles.feedCard, isLast && reportDetailStyles.feedCardLast]}
    >
      <View style={residentFeedStyles.reportContent}>
        <PublicIncidentHeader
          incident={incident}
          trailing={
            <TouchableOpacity
              style={residentFeedStyles.moreButton}
              onPress={(event) => {
                event.stopPropagation?.();
                onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel="Open report details"
            >
              <Ionicons name="ellipsis-horizontal" size={21} color={colors.textMuted} />
            </TouchableOpacity>
          }
        />

        <PublicIncidentCopy incident={incident} captionLines={3} />
        <PublicIncidentHero incident={incident} />
        <PublicIncidentTags incident={incident} />
        <PublicIncidentLatestUpdate incident={incident} numberOfLines={2} />

        <View style={residentFeedStyles.actionRow}>
          <View style={residentFeedStyles.engagementActions}>
            <TouchableOpacity
              style={residentFeedStyles.iconAction}
              onPress={(event) => {
                event.stopPropagation?.();
                onToggleSupport?.();
              }}
              disabled={isWithdrawn || supportBusy || !onToggleSupport}
              accessibilityRole="button"
              accessibilityLabel={hasUpvoted ? 'Remove your support' : 'Support this report'}
              accessibilityState={{ selected: hasUpvoted, disabled: isWithdrawn || supportBusy }}
            >
              <Ionicons
                name={hasUpvoted ? 'arrow-up-circle' : 'arrow-up-outline'}
                size={21}
                color={isWithdrawn ? colors.border : hasUpvoted ? colors.primary : colors.text}
              />
              {upvoteCount > 0 ? (
                <Text style={[residentFeedStyles.actionText, hasUpvoted && residentFeedStyles.actionTextActive]}>
                  {upvoteCount}
                </Text>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={residentFeedStyles.iconAction}
              onPress={(event) => {
                event.stopPropagation?.();
                (onRequestComments ?? onPress)();
              }}
              accessibilityRole="button"
              accessibilityLabel={`View discussion, ${commentCount} comments`}
            >
              <Ionicons name="chatbubble-outline" size={21} color={colors.text} />
              {commentCount > 0 ? <Text style={residentFeedStyles.actionText}>{commentCount}</Text> : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={residentFeedStyles.iconAction}
              onPress={(event) => {
                event.stopPropagation?.();
                shareIncident();
              }}
              accessibilityRole="button"
              accessibilityLabel="Share report"
            >
              <Ionicons name="arrow-redo-outline" size={23} color={colors.text} />
            </TouchableOpacity>
          </View>

          {canShowOnMap ? (
            <TouchableOpacity
              style={styles.mapChip}
              onPress={(event) => {
                event.stopPropagation?.();
                onViewOnMap?.();
              }}
              accessibilityRole="button"
              accessibilityLabel="Show this report on the map"
            >
              <Ionicons name="map-outline" size={15} color={colors.navigationActive} />
              <Text style={styles.mapChipText}>View on map</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mapChip: {
    marginLeft: 'auto',
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
  },
  mapChipText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.navigationActive,
  },
});
