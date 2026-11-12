import { useState, type ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '../../styles/theme';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { reportOperationsStyles as operationStyles } from '../../styles/components/reportOperations.styles';
import { WorkflowNote } from './WorkflowForm';
import ScreenablePhotoPreview from './ScreenablePhotoPreview';

export type PublicationPhotoChoice = {
  mediaId: string;
  previewUrl: string | null;
  fullSizeUrl: string | null;
  verified: boolean;
  publicApproved: boolean;
};

export type PublicationDisclosureChoice = {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  allowed: boolean;
  selected: boolean;
  onChange: (value: boolean) => void;
};

export function PublicSourceText({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={fieldStyles.sourceCard}>
      <View style={fieldStyles.sourceHeading}>
        <Ionicons name="document-text-outline" size={18} color={colors.primary} />
        <Text style={fieldStyles.sourceHeadingText}>Original report</Text>
      </View>
      <Text numberOfLines={expanded ? undefined : 2} style={fieldStyles.sourceTitle}>
        {title || 'Untitled report'}
      </Text>
      {expanded ? (
        <Text style={fieldStyles.sourceDescription}>{description || 'No description provided.'}</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Hide full resident text' : 'Show full resident text'}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={fieldStyles.sourceExpand}
      >
        <Text style={fieldStyles.sourceExpandText}>{expanded ? 'Hide source' : 'View source'}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={colors.primary} />
      </Pressable>
    </View>
  );
}

export function PublicationDisclosureTiles({
  choices,
  disabled = false,
}: {
  choices: PublicationDisclosureChoice[];
  disabled?: boolean;
}) {
  return (
    <View style={fieldStyles.disclosureSection}>
      <Text style={styles.subtitle}>Public details</Text>
      <View style={fieldStyles.disclosureTiles}>
        {choices.map((choice) => {
          const checked = choice.allowed && choice.selected;
          const unavailable = !choice.allowed;
          const status = unavailable ? 'Locked' : checked ? 'Visible' : 'Hidden';
          const tileDisabled = disabled || unavailable;
          return (
            <Pressable
              key={choice.label}
              accessibilityRole="checkbox"
              accessibilityLabel={`${choice.label}, ${status.toLowerCase()}`}
              accessibilityHint={unavailable
                ? 'The resident did not allow this detail to be public.'
                : 'Select to include this detail in the public report.'}
              accessibilityState={{ checked, disabled: tileDisabled }}
              disabled={tileDisabled}
              onPress={() => choice.onChange(!checked)}
              style={[
                fieldStyles.disclosureTile,
                checked && fieldStyles.disclosureTileSelected,
                unavailable && fieldStyles.disclosureTileLocked,
              ]}
            >
              <Ionicons
                name={unavailable ? 'lock-closed-outline' : choice.icon}
                size={20}
                color={checked ? colors.primary : colors.textMuted}
              />
              <Text style={fieldStyles.disclosureLabel}>
                {choice.label}
              </Text>
              <Text style={fieldStyles.disclosureStatus}>
                {status}
              </Text>
              <Ionicons
                name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                size={17}
                color={checked ? colors.primary : colors.textMuted}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function ReportPublicationFields({
  sourceTitle,
  sourceDescription,
  acknowledged,
  onAcknowledgedChange,
  photos,
  photoError = null,
  selectedPhotoMediaIds,
  onPhotoSelectionChange,
  reporterNameAllowed,
  approveReporterName,
  onApproveReporterNameChange,
  reporterAvatarAllowed,
  approveReporterAvatar,
  onApproveReporterAvatarChange,
  exactLocationAllowed,
  approveExactLocation,
  onApproveExactLocationChange,
  sensitive,
  onSensitiveChange,
  sensitivityReason,
  onSensitivityReasonChange,
  showSensitiveChoice = true,
  showSensitiveReason = true,
  disabled = false,
}: {
  sourceTitle: string;
  sourceDescription: string;
  acknowledged: boolean;
  onAcknowledgedChange: (value: boolean) => void;
  photos: PublicationPhotoChoice[];
  photoError?: string | null;
  selectedPhotoMediaIds: string[];
  onPhotoSelectionChange: (mediaIds: string[]) => void;
  reporterNameAllowed: boolean;
  approveReporterName: boolean;
  onApproveReporterNameChange: (value: boolean) => void;
  reporterAvatarAllowed: boolean;
  approveReporterAvatar: boolean;
  onApproveReporterAvatarChange: (value: boolean) => void;
  exactLocationAllowed: boolean;
  approveExactLocation: boolean;
  onApproveExactLocationChange: (value: boolean) => void;
  sensitive: boolean;
  onSensitiveChange: (value: boolean) => void;
  sensitivityReason: string;
  onSensitivityReasonChange: (value: string) => void;
  showSensitiveChoice?: boolean;
  showSensitiveReason?: boolean;
  disabled?: boolean;
}) {
  const [unavailablePhotoIds, setUnavailablePhotoIds] = useState<string[]>([]);

  const togglePhoto = (mediaId: string, selected: boolean) => {
    onPhotoSelectionChange(selected
      ? [...new Set([...selectedPhotoMediaIds, mediaId])]
      : selectedPhotoMediaIds.filter((id) => id !== mediaId));
  };

  const disclosureChoices: PublicationDisclosureChoice[] = [
    {
      label: 'Name',
      icon: 'person-outline',
      allowed: reporterNameAllowed,
      selected: approveReporterName,
      onChange: onApproveReporterNameChange,
    },
    {
      label: 'Profile',
      icon: 'person-circle-outline',
      allowed: reporterAvatarAllowed,
      selected: approveReporterAvatar,
      onChange: onApproveReporterAvatarChange,
    },
    {
      label: 'Exact pin',
      icon: 'location-outline',
      allowed: exactLocationAllowed,
      selected: approveExactLocation,
      onChange: onApproveExactLocationChange,
    },
  ];

  return (
    <View style={fieldStyles.container}>
      {showSensitiveChoice ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel="Mark this incident sensitive"
          accessibilityHint="Hides the public report text, precise location, and photos. A safety reason is required."
          accessibilityState={{ checked: sensitive, disabled }}
          disabled={disabled}
          onPress={() => {
            onSensitiveChange(!sensitive);
            if (!sensitive) onPhotoSelectionChange([]);
          }}
          style={[
            fieldStyles.sensitiveChoice,
            sensitive && fieldStyles.sensitiveChoiceSelected,
          ]}
        >
          <Ionicons
            name={sensitive ? 'shield-checkmark-outline' : 'shield-outline'}
            size={20}
            color={sensitive ? colors.danger : colors.textMuted}
          />
          <View style={fieldStyles.sensitiveCopy}>
            <Text style={fieldStyles.choiceTitle}>Mark sensitive</Text>
            <Text style={fieldStyles.choiceStatus}>
              {sensitive ? 'Public details hidden' : 'Optional safety hold'}
            </Text>
          </View>
          <Ionicons
            name={sensitive ? 'checkmark-circle' : 'ellipse-outline'}
            size={19}
            color={sensitive ? colors.danger : colors.textMuted}
          />
        </Pressable>
      ) : null}

      {sensitive ? (showSensitiveReason ? (
        <WorkflowNote
          label="Safety reason (internal)"
          value={sensitivityReason}
          onChange={onSensitivityReasonChange}
          maxLength={280}
          disabled={disabled}
          scrollEnabled={false}
        />
      ) : null) : (
        <>
          <PublicSourceText title={sourceTitle} description={sourceDescription} />
          <PublicationDisclosureTiles choices={disclosureChoices} disabled={disabled} />
          {photos.length > 0 ? (
            <View style={fieldStyles.photoSection}>
              <View style={fieldStyles.photoHeading}>
                <Text style={styles.subtitle}>Photos</Text>
                <Text style={fieldStyles.photoHint}>
                  Tap a photo to inspect it full-size.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Photo safety checklist"
                accessibilityHint="Shows what must be excluded from public photos."
                onPress={() => Alert.alert(
                  'Photo safety checklist',
                  'Exclude injured faces, children, house numbers, vehicle plates, contact details, and private notes. Tap each photo to inspect it full-size.',
                  [{ text: 'Got it' }],
                )}
                style={fieldStyles.safetyHint}
              >
                <Ionicons name="information-circle-outline" size={17} color={colors.textMuted} />
                <Text style={fieldStyles.safetyHintText}>Safety checklist</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </Pressable>
              {photos.some((photo) => photo.publicApproved) ? (
                <Text style={fieldStyles.photoHint}>
                  Public photos stay selected here. Revoke them in Photo publication.
                </Text>
              ) : null}
              {photoError ? (
                <Text accessibilityRole="alert" style={operationStyles.caption}>{photoError}</Text>
              ) : null}
              {photos.map((photo, photoIndex) => {
                const selected = photo.publicApproved || selectedPhotoMediaIds.includes(photo.mediaId);
                const previewUnavailable = !photo.fullSizeUrl || unavailablePhotoIds.includes(photo.mediaId);
                const status = photo.publicApproved ? 'Public now' : selected ? 'Will be public' : 'Hidden';
                return (
                  <View
                    key={photo.mediaId}
                    style={[
                      fieldStyles.photoCard,
                      selected && fieldStyles.photoCardSelected,
                      photo.publicApproved && fieldStyles.photoCardPublic,
                    ]}
                  >
                    {photo.previewUrl ? (
                      <ScreenablePhotoPreview
                        uri={photo.previewUrl}
                        fullSizeUri={photo.fullSizeUrl}
                        accessibilityLabel={`Photo ${photoIndex + 1}. ${status}. Open full-size safety review.`}
                        thumbnailStyle={fieldStyles.photo}
                        disabled={disabled}
                        onFullSizeError={() => {
                          setUnavailablePhotoIds((current) => current.includes(photo.mediaId)
                            ? current
                            : [...current, photo.mediaId]);
                          if (selectedPhotoMediaIds.includes(photo.mediaId) && !photo.publicApproved) {
                            onPhotoSelectionChange(selectedPhotoMediaIds.filter((id) => id !== photo.mediaId));
                          }
                        }}
                        onFullSizeLoad={() => {
                          setUnavailablePhotoIds((current) => current.filter((id) => id !== photo.mediaId));
                        }}
                      />
                    ) : (
                      <View style={[fieldStyles.photo, fieldStyles.photoPlaceholder]}>
                        <Ionicons name="image-outline" size={22} color={colors.textMuted} />
                      </View>
                    )}
                    <View style={fieldStyles.photoCopy}>
                      <View style={fieldStyles.photoState}>
                        <Ionicons
                          name={photo.publicApproved || selected ? 'eye-outline' : 'eye-off-outline'}
                          size={15}
                          color={photo.publicApproved ? colors.success : selected ? colors.primary : colors.textMuted}
                        />
                        <Text style={[
                          fieldStyles.photoStatus,
                          photo.publicApproved && fieldStyles.photoStatusPublic,
                          selected && !photo.publicApproved && fieldStyles.photoStatusSelected,
                        ]}>
                          {status}
                        </Text>
                      </View>
                      <Text style={fieldStyles.photoHint}>
                        {previewUnavailable
                          ? 'Preview unavailable'
                          : photo.verified ? 'Safe copy ready' : 'Safe copy prepared on approval'}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={`Public photo ${photoIndex + 1}`}
                      accessibilityHint={photo.publicApproved
                        ? 'Already public. Use Photo publication controls to revoke it.'
                        : previewUnavailable
                        ? 'Unavailable until the full-size photo preview loads.'
                        : 'Select to include this photo in the public report.'}
                      accessibilityState={{ checked: selected, disabled: disabled || photo.publicApproved || previewUnavailable }}
                      disabled={disabled || photo.publicApproved || previewUnavailable}
                      onPress={() => togglePhoto(photo.mediaId, !selected)}
                      style={fieldStyles.photoToggle}
                    >
                      <Ionicons
                        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={23}
                        color={photo.publicApproved ? colors.success : selected ? colors.primary : colors.textMuted}
                      />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : null}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="I reviewed the public text and selected photos"
            accessibilityHint="Confirm that selected photos exclude injuries, children, addresses, plates, contacts, and private notes."
            accessibilityState={{ checked: acknowledged, disabled }}
            disabled={disabled}
            onPress={() => onAcknowledgedChange(!acknowledged)}
            style={[
              fieldStyles.acknowledgment,
              acknowledged && fieldStyles.acknowledgmentChecked,
            ]}
          >
            <Ionicons
              name={acknowledged ? 'checkbox' : 'square-outline'}
              size={20}
              color={acknowledged ? colors.primary : colors.textMuted}
            />
            <Text style={fieldStyles.acknowledgmentText}>
              Reviewed the public text and selected photos
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const fieldStyles = {
  container: { gap: spacing.sm } as const,
  sourceCard: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.offWhite,
  } as const,
  sourceHeading: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs } as const,
  sourceHeadingText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12 } as const,
  sourceTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 } as const,
  sourceDescription: { color: colors.text, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 } as const,
  sourceExpand: { minHeight: 44, flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs, alignSelf: 'flex-start' as const, paddingHorizontal: spacing.xs } as const,
  sourceExpandText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 12 } as const,
  disclosureSection: { gap: spacing.xs } as const,
  disclosureTiles: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.xs },
  disclosureTile: {
    flexGrow: 1,
    flexBasis: 78,
    minWidth: 74,
    minHeight: 80,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 2,
    padding: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  } as const,
  disclosureTileSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight } as const,
  disclosureTileLocked: { backgroundColor: colors.offWhite } as const,
  disclosureLabel: { color: colors.text, fontFamily: fonts.semibold, fontSize: 12, textAlign: 'center' as const, flexShrink: 1 } as const,
  disclosureStatus: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10, textAlign: 'center' as const, flexShrink: 1 } as const,
  sensitiveChoice: {
    minHeight: 50,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  } as const,
  sensitiveChoiceSelected: { borderColor: colors.danger, backgroundColor: colors.offWhite } as const,
  sensitiveCopy: { flex: 1, minWidth: 0, gap: 2 } as const,
  choiceTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 13 } as const,
  choiceStatus: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11 } as const,
  photoSection: { gap: spacing.xs, marginTop: spacing.xs } as const,
  photoHeading: { gap: 2 } as const,
  safetyHint: { minHeight: 44, flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs, alignSelf: 'flex-start' as const, paddingHorizontal: spacing.xs } as const,
  safetyHintText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12 } as const,
  photoCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    minHeight: 74,
    padding: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  } as const,
  photoCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight } as const,
  photoCardPublic: { borderColor: colors.success, backgroundColor: colors.primaryLight } as const,
  photo: { width: 58, height: 58, borderRadius: radius.sm } as const,
  photoPlaceholder: { alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.offWhite } as const,
  photoCopy: { flex: 1, minWidth: 0, gap: 2 } as const,
  photoState: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3 } as const,
  photoStatus: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 12 },
  photoStatusPublic: { color: colors.success },
  photoStatusSelected: { color: colors.primary },
  photoHint: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11, lineHeight: 15 } as const,
  photoToggle: { minWidth: 44, minHeight: 44, alignItems: 'center' as const, justifyContent: 'center' as const } as const,
  acknowledgment: {
    minHeight: 44,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    padding: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.offWhite,
  } as const,
  acknowledgmentChecked: { backgroundColor: colors.primaryLight } as const,
  acknowledgmentText: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 } as const,
};
