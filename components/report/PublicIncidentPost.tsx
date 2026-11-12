// Shared building blocks for a public incident shown as a resident report post.
// Home, Community, Map callouts and the detail sheet compose these so every
// surface uses the same screened title, caption, colors and tags.
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { formatPublishedAt } from '../../lib/formatTime';
import { incidentTypeTone } from '../../lib/incidentTypes';
import {
  publicIncidentStatusLabel,
  publicIncidentTone,
  type PublicIncident,
} from '../../lib/publicIncidents';
import type { ReportMediaAttachment } from '../../lib/reports';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';
import {
  CollageCellContent,
  IncidentTagRow,
  residentFeedStyles,
} from './ReportDetailCard';

/** Screened title, or the category when officials have not published a post yet. */
export function publicIncidentTitle(incident: PublicIncident): string {
  return incident.publicTitle ?? incident.publicTypeLabel;
}

/** Screened caption, or a neutral line that never exposes the raw report text. */
export function publicIncidentCaption(incident: PublicIncident): string {
  if (incident.publicCaption) return incident.publicCaption;
  if (incident.publicStatus === 'withdrawn') return 'The response office withdrew this confirmation.';
  return 'No public description has been posted.';
}

/** The most important official text: corrections first, then outcome, then progress. */
export function publicIncidentLatestUpdate(incident: PublicIncident): { label: string; text: string } | null {
  if (incident.publicCorrection) return { label: 'Correction', text: incident.publicCorrection };
  if (incident.publicSummary) return { label: 'Outcome', text: incident.publicSummary };
  if (incident.latestPublicUpdate) return { label: 'Official update', text: incident.latestPublicUpdate };
  return null;
}

export function publicIncidentHasMapLocation(incident: PublicIncident): boolean {
  return Boolean(incident.approximateArea || incident.exactLocation);
}

/** Approved public photos only. Original evidence is never substituted here. */
export function publicIncidentMedia(incident: PublicIncident): ReportMediaAttachment[] {
  const count = Math.max(incident.publicPhotoDisplays.length, incident.publicPhotoThumbnails.length);
  const photos: ReportMediaAttachment[] = [];
  for (let index = 0; index < count; index += 1) {
    const url = incident.publicPhotoDisplays[index] ?? incident.publicPhotoThumbnails[index];
    if (!url) continue;
    photos.push({
      id: incident.publicPhotoIdentities[index] ?? `${incident.incidentCaseId}-photo-${index}`,
      type: 'photo',
      url,
      thumbnailUrl: incident.publicPhotoThumbnails[index] ?? url,
      durationSeconds: null,
    });
  }
  return photos;
}

export function PublicIncidentHeader({
  incident,
  trailing,
}: {
  incident: PublicIncident;
  trailing?: React.ReactNode;
}) {
  const typeTone = incidentTypeTone(incident.incidentType);
  const postedAt = incident.confirmedAt ?? incident.lastPublicUpdateAt;
  const isResidentReport = Boolean(incident.reportId);
  const reporterLabel = isResidentReport
    ? incident.reporterName ?? 'Anonymous resident'
    : 'Official incident summary';

  return (
    <View style={residentFeedStyles.reporterRow}>
      {isResidentReport && incident.reporterAvatarUrl ? (
        <Image source={{ uri: incident.reporterAvatarUrl }} style={styles.avatarImage} contentFit="cover" accessibilityLabel="Reporter profile picture shared with permission" />
      ) : (
        <View style={[styles.avatar, { backgroundColor: typeTone.softColor }]}>
          <Ionicons name={isResidentReport ? 'person-outline' : 'business-outline'} size={20} color={typeTone.color} />
        </View>
      )}
      <View style={residentFeedStyles.reporterDetails}>
        <View style={residentFeedStyles.reporterNameRow}>
          <Text style={residentFeedStyles.reporterName} numberOfLines={1}>
            {reporterLabel}
          </Text>
        </View>
        <Text style={residentFeedStyles.createdAtText} numberOfLines={1}>
          Brgy. {incident.barangayName}
          {postedAt ? ` · ${formatPublishedAt(postedAt)}` : ''}
        </Text>
      </View>
      {trailing}
    </View>
  );
}

export function PublicIncidentCopy({
  incident,
  captionLines,
}: {
  incident: PublicIncident;
  /** Limits the caption on cards; the detail sheet shows it in full. */
  captionLines?: number;
}) {
  return (
    <View style={residentFeedStyles.copyBlock}>
      <Text style={residentFeedStyles.reportTitle}>{publicIncidentTitle(incident)}</Text>
      <Text style={residentFeedStyles.reportDescription} numberOfLines={captionLines}>
        {publicIncidentCaption(incident)}
      </Text>
      {incident.publicLandmark ? (
        <View style={styles.landmarkRow}>
          <Ionicons name="flag-outline" size={14} color={colors.textMuted} />
          <Text style={styles.landmarkText} numberOfLines={2}>
            Near {incident.publicLandmark}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** First approved photo. Returns null when the office has not published media. */
export function PublicIncidentHero({ incident }: { incident: PublicIncident }) {
  const photos = publicIncidentMedia(incident);
  const firstPhoto = photos[0];
  if (!firstPhoto) return null;

  return (
    <View style={residentFeedStyles.heroMedia}>
      <CollageCellContent item={firstPhoto} />
      {photos.length > 1 ? (
        <View style={residentFeedStyles.mediaCountBadge}>
          <Text style={residentFeedStyles.mediaCountText}>1 / {photos.length}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function PublicIncidentTags({ incident }: { incident: PublicIncident }) {
  const tone = publicIncidentTone(incident.publicStatus);
  return (
    <IncidentTagRow
      statusLabel={publicIncidentStatusLabel(incident.publicStatus)}
      statusColor={tone.color}
      statusBackgroundColor={tone.softColor}
      incidentType={incident.incidentType}
      incidentTypeLabel={incident.publicTypeLabel}
    />
  );
}

/** Soft, status-colored strip with the latest official text for the post. */
export function PublicIncidentLatestUpdate({
  incident,
  numberOfLines,
}: {
  incident: PublicIncident;
  numberOfLines?: number;
}) {
  const update = publicIncidentLatestUpdate(incident);
  if (!update) return null;
  const tone = publicIncidentTone(incident.publicStatus);

  return (
    <View style={[styles.updateStrip, { backgroundColor: tone.softColor }]}>
      <View style={[styles.updateIcon, { backgroundColor: colors.white }]}>
        <Ionicons
          name={update.label === 'Correction' ? 'alert-circle-outline' : 'megaphone-outline'}
          size={15}
          color={tone.color}
        />
      </View>
      <View style={styles.updateCopy}>
        <Text style={[styles.updateLabel, { color: tone.color }]}>
          {update.label}
          {incident.lastPublicUpdateAt ? ` · ${formatPublishedAt(incident.lastPublicUpdateAt)}` : ''}
        </Text>
        <Text style={styles.updateText} numberOfLines={numberOfLines}>
          {update.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
  },
  landmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  landmarkText: {
    flexShrink: 1,
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  updateStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
  },
  updateIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  updateCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  updateLabel: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
  },
  updateText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    lineHeight: 19,
    color: colors.text,
  },
});
