// app/official/[id].tsx
// Official report detail: content, attribution, timeline, status actions,
// and protected "Call reporter" (masked until confirmed).

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { colors } from '../../styles/theme';
import { fetchBarangays, type BarangayOption } from '../../lib/barangays';
import { getReportLocationAdjustmentLimit, type GpsPosition } from '../../lib/location';
import { mayorReportStatusLabel } from '../../lib/mayorStatusLabels';
import { goBackOrReplace } from '../../lib/navigation';
import { OfficialShellSkeleton } from '../../components/ui/OfficialScreenSkeletons';
import { useOfficialPortal } from '../../context/OfficialPortalContext';
import { useOfficialReportDetail } from '../../hooks/useOfficialReports';
import {
  CommunityReportTags,
  MediaCollage,
  ReportMediaPreviewModal,
  statusLabel,
} from '../../components/report/ReportDetailCard';
import { formatPublishedAt } from '../../lib/formatTime';
import {
  openReporterDialer,
  requestReporterContact,
  transitionActionLabel,
  transitionConfirmMessage,
  transitionOfficialReportStatus,
  type ReportStatus,
} from '../../lib/officialReports';
import type { ReportMediaAttachment } from '../../lib/reports';
import {
  correctOfficialReportLocation,
  updateOfficialReport,
} from '../../lib/officialReportSubmit';
import IncidentTypeBadge from '../../components/report/IncidentTypeBadge';
import { ReporterAvatar } from '../../components/report/ReporterAvatar';
import ReportBarangayPicker from '../../components/report/ReportBarangayPicker';
import ReportLocationPicker from '../../components/report/ReportLocationPicker';

function statusPillStyle(status: ReportStatus) {
  if (status === 'verified') return styles.statusVerified;
  if (status === 'escalated') return styles.statusEscalated;
  if (status === 'resolved') return styles.statusResolved;
  return styles.statusUnverified;
}

function formatAttribution(
  name: string | null,
  at: string | null,
): string {
  if (!name && !at) return 'Not set';
  if (name && at) return `${name} · ${formatPublishedAt(at)}`;
  if (name) return name;
  return at ? formatPublishedAt(at) : 'Not set';
}

function timelineLabel(event: {
  eventType: string;
  fromStatus: ReportStatus | null;
  toStatus: ReportStatus | null;
}): string {
  if (event.eventType === 'barangay_change') {
    return 'Barangay updated';
  }
  if (event.eventType === 'location_change') {
    return 'Incident location corrected';
  }
  if (event.eventType === 'incident_type_change') {
    return 'Incident type updated';
  }
  if (event.toStatus && event.fromStatus) {
    return `${statusLabel(event.fromStatus)} → ${statusLabel(event.toStatus)}`;
  }
  if (event.toStatus) {
    return `Reported as ${statusLabel(event.toStatus)}`;
  }
  return 'Status update';
}

function transitionConfirmationLabel(target: ReportStatus): string {
  if (target === 'verified') return 'Yes, verify';
  if (target === 'escalated') return 'Yes, escalate';
  if (target === 'resolved') return 'Yes, resolve';
  return 'Yes, update';
}

export default function OfficialReportDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const reportId = typeof params.id === 'string' ? params.id : undefined;

  const {
    scope,
    officialKind: kind,
    loading: scopeLoading,
    error: scopeError,
  } = useOfficialPortal();
  const isResponseOfficial = kind === 'MDRRMO' || kind === 'BDRRMO';
  const [note, setNote] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLatitude, setEditLatitude] = useState('');
  const [editLongitude, setEditLongitude] = useState('');
  const [editCorrectionNote, setEditCorrectionNote] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  // Verification / Timeline start collapsed; tap a header to reveal its content.
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<ReportMediaAttachment | null>(null);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [barangayPickerVisible, setBarangayPickerVisible] = useState(false);
  const [correctedPosition, setCorrectedPosition] = useState<GpsPosition | null>(null);
  const [correctionBarangays, setCorrectionBarangays] = useState<BarangayOption[]>([]);
  const [correctionBarangaysLoading, setCorrectionBarangaysLoading] = useState(false);
  const [correctionBarangaysError, setCorrectionBarangaysError] = useState<string | null>(null);
  const [selectedCorrectionBarangayId, setSelectedCorrectionBarangayId] = useState<string | null>(null);
  const [locationCorrectionBusy, setLocationCorrectionBusy] = useState(false);

  const { detail, error, loading, refreshing, refresh, reload } =
    useOfficialReportDetail(reportId, scope);
  // Verification begins the response timeline, which remains visible after resolution.
  const hasResponseStarted = detail?.status !== 'unverified';
  const isResolved = detail?.status === 'resolved';
  const isEscalated = detail?.status === 'escalated';
  const currentTimelineStep = isResolved
    ? 'resolved'
    : isEscalated
      ? 'escalated'
      : hasResponseStarted
        ? 'status'
        : 'review';
  // Match the verification event first so a later re-verification note is not shown here.
  const verificationEvent = detail?.timeline.find(
    (event) => event.toStatus === 'verified' && event.createdAt === detail.verified.at,
  );
  const verificationNote =
    verificationEvent?.note?.trim() ||
    detail?.timeline.find((event) => event.toStatus === 'verified')?.note?.trim() ||
    null;
  const resolutionEvent = detail?.timeline.find(
    (event) => event.toStatus === 'resolved' && event.createdAt === detail.resolved.at,
  );
  const resolutionNote =
    resolutionEvent?.note?.trim() ||
    detail?.timeline.find((event) => event.toStatus === 'resolved')?.note?.trim() ||
    null;
  const escalationEvent = detail?.timeline.find(
    (event) => event.toStatus === 'escalated' && event.createdAt === detail.escalated.at,
  );
  const escalationNote =
    escalationEvent?.note?.trim() ||
    detail?.timeline.find((event) => event.toStatus === 'escalated')?.note?.trim() ||
    null;
  const correctionDevicePosition =
    detail && detail.deviceLatitude != null && detail.deviceLongitude != null
      ? {
          latitude: detail.deviceLatitude,
          longitude: detail.deviceLongitude,
          accuracyMeters: detail.gpsAccuracyMeters,
        }
      : undefined;
  const canCorrectTimelineLocation =
    isResponseOfficial &&
    detail?.canCorrectLocation === true &&
    detail.status === 'unverified';
  const correctionBarangayOptions =
    kind === 'BDRRMO' && scope?.barangay_id
      ? correctionBarangays.filter((barangay) => barangay.id === scope.barangay_id)
      : correctionBarangays;
  const locationWasUpdated = detail?.timeline.some(
    (event) => event.eventType === 'location_change' || event.eventType === 'barangay_change',
  );
  const currentLocation = detail
    ? detail.addressText?.trim() ||
      `${detail.latitude.toFixed(5)}, ${detail.longitude.toFixed(5)}`
    : 'Unknown location';
  const currentLocationWithPin = detail?.addressText?.trim()
    ? `${currentLocation} (${detail.latitude.toFixed(5)}, ${detail.longitude.toFixed(5)})`
    : currentLocation;

  function confirmTransition(target: ReportStatus) {
    if (!detail || !kind || actionBusy) return;

    Alert.alert(
      transitionActionLabel(target),
      transitionConfirmMessage(target, kind),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: transitionConfirmationLabel(target),
          style: target === 'escalated' ? 'destructive' : 'default',
          onPress: () => {
            void runTransition(target);
          },
        },
      ],
    );
  }

  function openReportOperationsHelp() {
    Alert.alert(
      'Report operations help',
      'Review the report, contact the reporter if needed, then select the appropriate next status.',
    );
  }

  async function runTransition(target: ReportStatus) {
    if (!detail) return;
    setActionBusy(true);
    try {
      const result = await transitionOfficialReportStatus({
        reportId: detail.id,
        targetStatus: target,
        note,
      });
      if (result.error) {
        Alert.alert('Status update failed', result.error);
        return;
      }
      setNote('');
      if (target === 'escalated' && kind === 'BDRRMO') {
        // A successful handoff ends BDRRMO access immediately.
        router.replace('/official/incidents?status=unverified' as never);
        return;
      }
      await reload();
    } finally {
      setActionBusy(false);
    }
  }

  function confirmCallReporter() {
    if (!detail || contactBusy) return;

    if (!detail.maskedPhone) {
      Alert.alert(
        'Contact unavailable',
        'No usable reporter contact number is available for this incident.',
      );
      return;
    }

    Alert.alert(
      'Call reporter?',
      'Use this call only to confirm or coordinate this incident.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, call',
          onPress: () => {
            void runCallReporter();
          },
        },
      ],
    );
  }

  async function runCallReporter() {
    if (!detail) return;
    setContactBusy(true);
    try {
      const contact = await requestReporterContact(detail.id);
      if (contact.error || !contact.phone) {
        Alert.alert(
          'Contact unavailable',
          contact.error || 'Reporter contact is unavailable.',
        );
        return;
      }

      const dialer = await openReporterDialer(contact.phone);
      if (dialer.error) {
        Alert.alert('Could not open dialer', dialer.error);
      }
    } finally {
      setContactBusy(false);
    }
  }

  async function loadCorrectionBarangays() {
    setCorrectionBarangaysLoading(true);
    setCorrectionBarangaysError(null);
    const result = await fetchBarangays();
    setCorrectionBarangays(result.barangays);
    setCorrectionBarangaysError(result.error);
    setCorrectionBarangaysLoading(false);
  }

  function openTimelineLocationCorrection() {
    if (!detail || !canCorrectTimelineLocation || locationCorrectionBusy) return;

    setCorrectedPosition({
      latitude: detail.latitude,
      longitude: detail.longitude,
      accuracyMeters: detail.gpsAccuracyMeters,
    });
    setSelectedCorrectionBarangayId(detail.barangayId);
    setLocationPickerVisible(true);
    void loadCorrectionBarangays();
  }

  function confirmCorrectedPin(position: GpsPosition) {
    setCorrectedPosition(position);
    setLocationPickerVisible(false);
    setBarangayPickerVisible(true);
  }

  async function saveTimelineLocationCorrection(barangayId: string) {
    if (!detail || !correctedPosition || locationCorrectionBusy) return;

    const selectedBarangay = correctionBarangays.find(
      (barangay) => barangay.id === barangayId,
    );
    setLocationCorrectionBusy(true);
    const result = await correctOfficialReportLocation({
      reportId: detail.id,
      position: correctedPosition,
      addressText: selectedBarangay
        ? `${selectedBarangay.name}, Minglanilla, Cebu`
        : detail.addressText ?? undefined,
      barangayId,
    });
    setLocationCorrectionBusy(false);

    if (result.error) {
      Alert.alert('Could not update location', result.error);
      return;
    }

    setCorrectedPosition(null);
    await reload();
  }

  function beginEdit() {
    if (!detail) return;
    setEditTitle(detail.title);
    setEditDescription(detail.description);
    setEditAddress(detail.addressText ?? '');
    setEditLatitude(String(detail.latitude));
    setEditLongitude(String(detail.longitude));
    setEditCorrectionNote('');
    setEditing(true);
  }

  async function saveEdit() {
    if (!detail || editBusy) return;
    setEditBusy(true);
    const correctedPosition = {
      latitude: Number(editLatitude),
      longitude: Number(editLongitude),
      accuracyMeters: null,
    };
    const result = detail.canEditContent
      ? await updateOfficialReport({
          reportId: detail.id,
          title: editTitle,
          description: editDescription,
          position: correctedPosition,
          addressText: editAddress,
          barangayId: detail.barangayId,
        })
      : await correctOfficialReportLocation({
          reportId: detail.id,
          position: correctedPosition,
          addressText: editAddress,
          barangayId: detail.barangayId,
          note: editCorrectionNote,
        });
    setEditBusy(false);
    if (result.error) {
      Alert.alert('Could not update incident', result.error);
      return;
    }
    setEditing(false);
    await reload();
  }

  if (scopeLoading || (!scope && !scopeError)) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <OfficialShellSkeleton />
      </SafeAreaView>
    );
  }

  if (scopeError || !scope) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={[styles.scrollContent, { flex: 1, justifyContent: 'center' }]}>
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>Official access unavailable</Text>
            <Text style={styles.stateBody}>{scopeError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => router.replace('/official')}
              activeOpacity={0.85}
            >
              <Text style={styles.retryButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (
    !loading &&
    kind === 'BDRRMO' &&
    !detail &&
    error === 'Report not found in your scope.'
  ) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={[styles.scrollContent, { flex: 1, justifyContent: 'center' }]}>
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>Report unavailable</Text>
            <Text style={styles.stateBody}>
              This report is no longer available in your BDRRMO workspace.
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => router.replace('/official/incidents?status=unverified' as never)}
              accessibilityRole="button"
            >
              <Text style={styles.retryButtonText}>Back to reports</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={[styles.backButton, styles.reportOperationsHeaderButton]}
              onPress={() => goBackOrReplace(router, '/official/incidents')}
              accessibilityRole="button"
              accessibilityLabel="Back to queue"
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.headerTextGroup}>
              <Text style={styles.incidentDetailLabel}>Incident detail</Text>
              <Text style={styles.screenTitle} numberOfLines={1}>
                Report operations
              </Text>
              {isResponseOfficial ? (
                <Text style={styles.reportOperationsInstruction}>
                  Review. Verify. Respond.
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={[styles.backButton, styles.reportOperationsHeaderButton]}
              onPress={openReportOperationsHelp}
              accessibilityRole="button"
              accessibilityLabel="Report operations help"
            >
              <Ionicons name="help-circle-outline" size={23} color={colors.navigationActive} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color={colors.themeSoft} />
              <Text style={styles.stateBody}>Loading report…</Text>
            </View>
          ) : null}

          {!loading && error ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateTitle}>Could not load report</Text>
              <Text style={styles.stateBody}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => void reload()}
                activeOpacity={0.85}
              >
                <Text style={styles.retryButtonText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!loading && !error && detail ? (
            <>
              {isResponseOfficial ? (
                <View style={styles.reporterIdentity}>
                  <ReporterAvatar reporter={detail.reporter} size={48} />
                  <View style={styles.reporterIdentityCopy}>
                    <Text style={styles.reporterIdentityName} numberOfLines={1}>
                      {detail.reporterName}
                    </Text>
                    <Text style={styles.reporterIdentityRole}>Reporter</Text>
                  </View>
                </View>
              ) : null}

              {isResponseOfficial ? (
                <View style={styles.reportSummary}>
                  <Text style={styles.detailBody}>
                    {detail.description.trim() || 'No description provided.'}
                  </Text>
                  {detail.media.length > 0 ? (
                    <MediaCollage
                      media={detail.media}
                      onOpenPreview={setMediaPreview}
                      onOpenGallery={() => setMediaPreview(detail.media[0])}
                    />
                  ) : null}
                  <CommunityReportTags report={detail} />
                  <View style={styles.reportMetaTimeline}>
                    <View
                      style={[
                        styles.reportMetaTimelineItem,
                        currentTimelineStep === 'review'
                          ? styles.reportMetaTimelineItemCurrent
                          : styles.reportMetaTimelineItemMuted,
                      ]}
                    >
                      <View style={styles.reportMetaTimelineMarker}>
                        {canCorrectTimelineLocation ? (
                          <TouchableOpacity
                            style={[
                              styles.reportMetaTimelineIcon,
                              currentTimelineStep === 'review' &&
                                styles.reportMetaTimelineIconCurrent,
                            ]}
                            onPress={openTimelineLocationCorrection}
                            disabled={locationCorrectionBusy}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Correct incident location"
                          >
                            <Ionicons
                              name="location"
                              size={currentTimelineStep === 'review' ? 24 : 18}
                              color={colors.navigationActive}
                            />
                          </TouchableOpacity>
                        ) : (
                          <View
                            style={[
                              styles.reportMetaTimelineIcon,
                              currentTimelineStep === 'review' &&
                                styles.reportMetaTimelineIconCurrent,
                            ]}
                          >
                            <Ionicons
                              name="location"
                              size={currentTimelineStep === 'review' ? 24 : 18}
                              color={colors.navigationActive}
                            />
                          </View>
                        )}
                        <View
                          style={[
                            styles.reportMetaTimelineLine,
                            currentTimelineStep === 'review' &&
                              styles.reportMetaTimelineLineToCurrent,
                          ]}
                        />
                      </View>
                      <View
                        style={[
                          styles.reportMetaTimelineCopy,
                          currentTimelineStep === 'review' && styles.reportMetaTimelineCopyCurrent,
                        ]}
                      >
                        <Text
                          style={[
                            styles.reportMetaTimelineLabel,
                            currentTimelineStep === 'review' && styles.reportMetaTimelineLabelCurrent,
                          ]}
                        >
                          Located and reported at
                        </Text>
                        <Text
                          style={[
                            styles.reportMetaTimelineValue,
                            currentTimelineStep === 'review' && styles.reportMetaTimelineValueCurrent,
                          ]}
                        >
                          {currentLocation}{' '}
                          at {detail.createdAt ? formatPublishedAt(detail.createdAt) : 'Unknown'}
                        </Text>
                        {locationWasUpdated ? (
                          <Text
                            style={[
                              styles.reportMetaTimelineValue,
                              currentTimelineStep === 'review' &&
                                styles.reportMetaTimelineValueCurrent,
                            ]}
                          >
                            Updated location to {currentLocationWithPin}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View
                      style={[
                        styles.reportMetaTimelineItem,
                        currentTimelineStep === 'review'
                          ? styles.reportMetaTimelineItemCurrent
                          : styles.reportMetaTimelineItemMuted,
                        currentTimelineStep === 'review' &&
                          styles.reportMetaTimelineItemFollowsExtendedLine,
                      ]}
                    >
                      <View style={styles.reportMetaTimelineMarker}>
                        {detail.canContactReporter ? (
                          <TouchableOpacity
                            style={[
                              styles.reportMetaTimelineIcon,
                              currentTimelineStep === 'review' &&
                                styles.reportMetaTimelineIconCurrent,
                            ]}
                            onPress={confirmCallReporter}
                            disabled={contactBusy}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Call reporter to confirm this incident"
                          >
                            <Ionicons
                              name="call"
                              size={currentTimelineStep === 'review' ? 24 : 18}
                              color={colors.navigationActive}
                            />
                          </TouchableOpacity>
                        ) : (
                          <View
                            style={[
                              styles.reportMetaTimelineIcon,
                              currentTimelineStep === 'review' &&
                                styles.reportMetaTimelineIconCurrent,
                            ]}
                          >
                            <Ionicons
                              name="call"
                              size={currentTimelineStep === 'review' ? 24 : 18}
                              color={colors.navigationActive}
                            />
                          </View>
                        )}
                        {hasResponseStarted ? (
                          <View
                            style={[
                              styles.reportMetaTimelineLine,
                              currentTimelineStep === 'status' &&
                                styles.reportMetaTimelineLineToCurrent,
                            ]}
                          />
                        ) : null}
                      </View>
                      <View
                        style={[
                          styles.reportMetaTimelineCopy,
                          currentTimelineStep === 'review' && styles.reportMetaTimelineCopyCurrent,
                        ]}
                      >
                        <Text
                          style={[
                            styles.reportMetaTimelineLabel,
                            currentTimelineStep === 'review' && styles.reportMetaTimelineLabelCurrent,
                          ]}
                        >
                          Under review
                        </Text>
                        {/* Escalated and resolved reports have already completed verification. */}
                        <Text
                          style={[
                            styles.reportMetaTimelineValue,
                            currentTimelineStep === 'review' && styles.reportMetaTimelineValueCurrent,
                          ]}
                        >
                          {detail.status !== 'unverified'
                            ? `Confirmed by ${detail.verified.name ?? 'an official'} at ${
                                detail.verified.at
                                  ? formatPublishedAt(detail.verified.at)
                                  : 'Unknown time'
                              }`
                            : 'Awaiting confirmation'}
                        </Text>
                        {detail.status !== 'unverified' && verificationNote ? (
                          <Text
                            style={[
                              styles.reportMetaTimelineValue,
                              currentTimelineStep === 'review' &&
                                styles.reportMetaTimelineValueCurrent,
                            ]}
                          >
                            {verificationNote}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {hasResponseStarted ? (
                      <View
                        style={[
                          styles.reportMetaTimelineItem,
                          currentTimelineStep === 'status'
                            ? styles.reportMetaTimelineItemCurrent
                            : styles.reportMetaTimelineItemMuted,
                          currentTimelineStep === 'status' &&
                            styles.reportMetaTimelineItemFollowsExtendedLine,
                        ]}
                      >
                        <View style={styles.reportMetaTimelineMarker}>
                          <View
                            style={[
                              styles.reportMetaTimelineIcon,
                              currentTimelineStep === 'status' &&
                                styles.reportMetaTimelineIconCurrent,
                            ]}
                          >
                            <Ionicons
                              name="chatbubbles"
                              size={currentTimelineStep === 'status' ? 24 : 18}
                              color={colors.navigationActive}
                            />
                          </View>
                          {isResolved || isEscalated ? (
                            <View style={[
                              styles.reportMetaTimelineLine,
                              styles.reportMetaTimelineLineToCurrent,
                            ]} />
                          ) : null}
                        </View>
                        <View
                          style={[
                            styles.reportMetaTimelineCopy,
                            currentTimelineStep === 'status' && styles.reportMetaTimelineCopyCurrent,
                          ]}
                        >
                          <Text
                            style={[
                              styles.reportMetaTimelineLabel,
                              currentTimelineStep === 'status' && styles.reportMetaTimelineLabelCurrent,
                            ]}
                          >
                            Status
                          </Text>
                          <Text
                            style={[
                              styles.reportMetaTimelineValue,
                              currentTimelineStep === 'status' &&
                                styles.reportMetaTimelineValueCurrent,
                            ]}
                          >
                            Response ongoing
                          </Text>
                        </View>
                      </View>
                    ) : null}
                    {isEscalated ? (
                      <View
                        style={[
                          styles.reportMetaTimelineItem,
                          styles.reportMetaTimelineItemCurrent,
                          styles.reportMetaTimelineItemFollowsExtendedLine,
                        ]}
                      >
                        <View style={styles.reportMetaTimelineMarker}>
                          <View style={[styles.reportMetaTimelineIcon, styles.reportMetaTimelineIconCurrent]}>
                            <Ionicons name="megaphone" size={24} color={colors.navigationActive} />
                          </View>
                        </View>
                        <View style={[styles.reportMetaTimelineCopy, styles.reportMetaTimelineCopyCurrent]}>
                          <Text style={[styles.reportMetaTimelineLabel, styles.reportMetaTimelineLabelCurrent]}>
                            Requesting assistance
                          </Text>
                          <Text
                            style={[styles.reportMetaTimelineValue, styles.reportMetaTimelineValueCurrent]}
                          >
                            {`Escalated by ${detail.escalated.name ?? 'an official'} at ${
                              detail.escalated.at
                                ? formatPublishedAt(detail.escalated.at)
                                : 'Unknown time'
                            }`}
                          </Text>
                          {escalationNote ? (
                            <Text
                              style={[
                                styles.reportMetaTimelineValue,
                                styles.reportMetaTimelineValueCurrent,
                              ]}
                            >
                              {escalationNote}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ) : null}
                    {isResolved ? (
                      <View
                        style={[
                          styles.reportMetaTimelineItem,
                          styles.reportMetaTimelineItemCurrent,
                          styles.reportMetaTimelineItemFollowsExtendedLine,
                        ]}
                      >
                        <View style={styles.reportMetaTimelineMarker}>
                          <View style={[styles.reportMetaTimelineIcon, styles.reportMetaTimelineIconCurrent]}>
                            <Ionicons name="checkmark-circle" size={24} color={colors.navigationActive} />
                          </View>
                        </View>
                        <View style={[styles.reportMetaTimelineCopy, styles.reportMetaTimelineCopyCurrent]}>
                          <Text style={[styles.reportMetaTimelineLabel, styles.reportMetaTimelineLabelCurrent]}>
                            Resolved
                          </Text>
                          <Text
                            style={[styles.reportMetaTimelineValue, styles.reportMetaTimelineValueCurrent]}
                          >
                            {`Resolved by ${detail.resolved.name ?? 'an official'} at ${
                              detail.resolved.at
                                ? formatPublishedAt(detail.resolved.at)
                                : 'Unknown time'
                            }`}
                          </Text>
                          {resolutionNote ? (
                            <Text
                              style={[
                                styles.reportMetaTimelineValue,
                                styles.reportMetaTimelineValueCurrent,
                              ]}
                            >
                              {resolutionNote}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ) : null}
                  </View>
                  {detail.allowedTransitions.length > 0 ? (
                    <View style={styles.timelineStatusAction}>
                      <View style={styles.timelineStatusActionConnector}>
                        <Ionicons
                          name="return-down-forward-outline"
                          size={24}
                          color={colors.textMuted}
                        />
                      </View>
                      <View style={styles.statusActionsCard}>
                        <TextInput
                          style={styles.noteInput}
                          value={note}
                          onChangeText={setNote}
                          placeholder="Add a short note for the timeline (500 characters)"
                          placeholderTextColor={colors.textMuted}
                          multiline
                          maxLength={500}
                          editable={!actionBusy}
                        />
                        <View style={styles.actionColumn}>
                          {detail.allowedTransitions.map((target) => {
                            const isEscalate = target === 'escalated';
                            return (
                              <TouchableOpacity
                                key={target}
                                style={[
                                  isEscalate
                                    ? styles.dangerAction
                                    : styles.primaryAction,
                                  actionBusy && styles.actionDisabled,
                                ]}
                                onPress={() => confirmTransition(target)}
                                disabled={actionBusy || contactBusy}
                                activeOpacity={0.85}
                              >
                                {actionBusy ? (
                                  <ActivityIndicator
                                    color={isEscalate ? colors.escalated : colors.white}
                                  />
                                ) : (
                                  <Text
                                    style={
                                      isEscalate
                                        ? styles.dangerActionText
                                        : styles.primaryActionText
                                    }
                                  >
                                    {transitionActionLabel(target)}
                                  </Text>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                  ) : null}
                  {detail.mediaError ? (
                    <Text style={[styles.detailBody, { color: colors.danger }]}>
                      {detail.mediaError}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {!isResponseOfficial ? (
                <View style={styles.detailCard}>
                {!isResponseOfficial ? (
                  <>
                    <View style={styles.queueCardHeader}>
                      <Text style={styles.detailTitle}>
                        {detail.title.trim() || 'Untitled report'}
                      </Text>
                      <View
                        style={[styles.statusPill, statusPillStyle(detail.status)]}
                      >
                        <Text style={styles.statusPillText}>
                          {kind === 'Mayor'
                            ? mayorReportStatusLabel({
                                status: detail.status,
                                barangayName: detail.barangayName,
                                reverifiedAt: detail.reverified.at,
                              })
                            : statusLabel(detail.status)}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.detailBody}>
                      {detail.description.trim() || 'No description provided.'}
                    </Text>
                  </>
                ) : null}

                {!isResponseOfficial ? (
                  <IncidentTypeBadge
                    incidentType={detail.incidentType}
                    incidentTypeOther={detail.incidentTypeOther}
                  />
                ) : null}

                {!isResponseOfficial ? (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Reporter</Text>
                    <Text style={styles.metaValue}>{detail.reporterName}</Text>
                  </View>
                ) : null}

                {!isResponseOfficial ? (
                  <>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Location</Text>
                      <Text style={styles.metaValue}>
                        {detail.addressText?.trim() ||
                          `${detail.latitude.toFixed(5)}, ${detail.longitude.toFixed(5)}`}
                      </Text>
                    </View>

                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Reported</Text>
                      <Text style={styles.metaValue}>
                        {detail.createdAt
                          ? formatPublishedAt(detail.createdAt)
                          : 'Unknown'}
                      </Text>
                    </View>
                  </>
                ) : null}

                {!isResponseOfficial && detail.media.length > 0 ? (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Media</Text>
                    <View style={styles.mediaRow}>
                      {detail.media.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.mediaThumb}
                          onPress={() => setMediaPreview(item)}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel={
                            item.type === 'video' ? 'View video' : 'View photo'
                          }
                        >
                          {item.type === 'photo' ? (
                            <Image
                              source={{ uri: item.url }}
                              style={styles.mediaThumbImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.mediaVideoThumb}>
                              <Ionicons
                                name="play-circle"
                                size={36}
                                color={colors.themeSoft}
                              />
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}

                {!isResponseOfficial && detail.mediaError ? (
                  <Text style={[styles.detailBody, { color: colors.danger }]}>
                    {detail.mediaError}
                  </Text>
                ) : null}

                {detail.canContactReporter ? (
                  <TouchableOpacity
                    style={[
                      styles.primaryAction,
                      styles.callReporterAction,
                      contactBusy && styles.actionDisabled,
                    ]}
                    onPress={confirmCallReporter}
                    disabled={contactBusy || actionBusy}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`Call reporter ${detail.maskedPhone ?? ''}`}
                  >
                    {contactBusy ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <>
                        <Ionicons name="call" size={18} color={colors.white} />
                        <Text style={styles.primaryActionText}>
                          {detail.maskedPhone ?? 'Number unavailable'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
                </View>
              ) : null}

              {!isResponseOfficial && (detail.canEditContent || detail.canCorrectLocation) ? (
                <View style={styles.detailCard}>
                  <View style={styles.queueCardHeader}>
                    <Text style={styles.sectionTitle}>
                      {detail.canEditContent
                        ? 'Correct incident details'
                        : 'Correct incident location'}
                    </Text>
                    {!editing ? (
                      <TouchableOpacity
                        style={styles.retryButton}
                        onPress={beginEdit}
                        accessibilityRole="button"
                        accessibilityLabel="Edit incident details"
                      >
                        <Text style={styles.retryButtonText}>Edit</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {editing ? (
                    <>
                      {detail.canEditContent ? (
                        <>
                          <Text style={styles.formLabel}>Title (optional)</Text>
                          <TextInput
                            style={styles.formInput}
                            value={editTitle}
                            onChangeText={setEditTitle}
                            maxLength={120}
                            editable={!editBusy}
                          />
                          <Text style={styles.formLabel}>Description</Text>
                          <TextInput
                            style={[styles.formInput, styles.formTextArea]}
                            value={editDescription}
                            onChangeText={setEditDescription}
                            multiline
                            maxLength={2000}
                            editable={!editBusy}
                          />
                        </>
                      ) : null}
                      <Text style={styles.formLabel}>Address</Text>
                      <TextInput
                        style={styles.formInput}
                        value={editAddress}
                        onChangeText={setEditAddress}
                        maxLength={300}
                        editable={!editBusy}
                      />
                      {!detail.canEditContent ? (
                        <>
                          <Text style={styles.formLabel}>Correction note (optional)</Text>
                          <TextInput
                            style={[styles.formInput, styles.formTextArea]}
                            value={editCorrectionNote}
                            onChangeText={setEditCorrectionNote}
                            placeholder="Why is the response location being corrected?"
                            placeholderTextColor={colors.textMuted}
                            multiline
                            maxLength={500}
                            editable={!editBusy}
                          />
                        </>
                      ) : null}
                      <Text style={styles.formLabel}>Coordinates</Text>
                      <TextInput
                        style={styles.formInput}
                        value={editLatitude}
                        onChangeText={setEditLatitude}
                        placeholder="Latitude"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="decimal-pad"
                        editable={!editBusy}
                      />
                      <TextInput
                        style={styles.formInput}
                        value={editLongitude}
                        onChangeText={setEditLongitude}
                        placeholder="Longitude"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="decimal-pad"
                        editable={!editBusy}
                      />
                      <TouchableOpacity
                        style={[styles.primaryAction, editBusy && styles.actionDisabled]}
                        onPress={() => void saveEdit()}
                        disabled={editBusy}
                        activeOpacity={0.85}
                      >
                        {editBusy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryActionText}>Save corrections</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.secondaryAction}
                        onPress={() => setEditing(false)}
                        disabled={editBusy}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.secondaryActionText}>Cancel</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={styles.queueMeta}>
                      {detail.canEditContent
                        ? 'The submitting officer may correct content and location. Every location change is audited.'
                        : 'Authorized responders may correct the response point. The original device location remains unchanged.'}
                    </Text>
                  )}
                </View>
              ) : null}

              {!isResponseOfficial ? (
                <View style={styles.collapsibleRow}>
                <View style={styles.collapsiblePanel}>
                  <TouchableOpacity
                    style={styles.collapsibleHeader}
                    onPress={() => setVerificationOpen((open) => !open)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: verificationOpen }}
                    accessibilityLabel="Verification"
                  >
                    <Text style={styles.collapsibleHeaderText} numberOfLines={1}>
                      Verification
                    </Text>
                    <Ionicons
                      name={verificationOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>
                  {verificationOpen ? (
                    <View style={styles.collapsibleBody}>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Device GPS</Text>
                        <Text style={styles.metaValue}>
                          {detail.deviceLatitude == null || detail.deviceLongitude == null
                            ? 'Not available for this legacy report'
                            : `${detail.deviceLatitude.toFixed(5)}, ${detail.deviceLongitude.toFixed(5)}`}
                        </Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>GPS accuracy</Text>
                        <Text style={styles.metaValue}>
                          {detail.gpsAccuracyMeters == null
                            ? 'Not recorded'
                            : `±${Math.round(detail.gpsAccuracyMeters)} m`}
                        </Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Pin adjustment</Text>
                        <Text style={styles.metaValue}>
                          {detail.locationAdjustmentMeters == null
                            ? 'Not recorded'
                            : `${Math.round(detail.locationAdjustmentMeters)} m`}
                        </Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Verified by</Text>
                        <Text style={styles.metaValue}>
                          {formatAttribution(detail.verified.name, detail.verified.at)}
                        </Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Re-verified by</Text>
                        <Text style={styles.metaValue}>
                          {formatAttribution(
                            detail.reverified.name,
                            detail.reverified.at,
                          )}
                        </Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Escalated by</Text>
                        <Text style={styles.metaValue}>
                          {formatAttribution(
                            detail.escalated.name,
                            detail.escalated.at,
                          )}
                        </Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Resolved by</Text>
                        <Text style={styles.metaValue}>
                          {formatAttribution(detail.resolved.name, detail.resolved.at)}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>

                <View style={styles.collapsiblePanel}>
                  <TouchableOpacity
                    style={styles.collapsibleHeader}
                    onPress={() => setTimelineOpen((open) => !open)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: timelineOpen }}
                    accessibilityLabel="Timeline"
                  >
                    <Text style={styles.collapsibleHeaderText} numberOfLines={1}>
                      Timeline
                    </Text>
                    <Ionicons
                      name={timelineOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>
                  {timelineOpen ? (
                    <View style={styles.collapsibleBody}>
                      {detail.timeline.length === 0 ? (
                        <Text style={styles.queueMeta}>No timeline events yet.</Text>
                      ) : (
                        detail.timeline.map((event) => (
                          <View key={event.id} style={styles.timelineItem}>
                            <Text style={styles.timelineTitle}>
                              {timelineLabel(event)}
                            </Text>
                            <Text style={styles.timelineMeta}>
                              {[
                                event.changedByName,
                                event.createdAt
                                  ? formatPublishedAt(event.createdAt)
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </Text>
                            {event.note ? (
                              <Text style={styles.timelineNote}>{event.note}</Text>
                            ) : null}
                          </View>
                        ))
                      )}
                    </View>
                  ) : null}
                </View>
                </View>
              ) : null}

              {kind === 'Mayor' ? (
                <View style={styles.readOnlyBanner}>
                  <Text style={styles.readOnlyText}>
                    Mayor view is read-only. Status changes and reporter contact
                    are not available.
                  </Text>
                </View>
              ) : null}

            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <ReportMediaPreviewModal
        preview={mediaPreview}
        onClose={() => setMediaPreview(null)}
      />
      {detail && correctedPosition ? (
        <ReportLocationPicker
          visible={locationPickerVisible}
          incidentPosition={correctedPosition}
          devicePosition={correctionDevicePosition}
          adjustmentBoundaryPosition={{
            latitude: detail.latitude,
            longitude: detail.longitude,
            accuracyMeters: detail.gpsAccuracyMeters,
          }}
          maximumDistanceMeters={getReportLocationAdjustmentLimit(
            detail.gpsAccuracyMeters,
          )}
          onConfirm={confirmCorrectedPin}
          onClose={() => setLocationPickerVisible(false)}
        />
      ) : null}
      <ReportBarangayPicker
        visible={barangayPickerVisible}
        barangays={correctionBarangayOptions}
        selectedBarangayId={selectedCorrectionBarangayId}
        loading={correctionBarangaysLoading || locationCorrectionBusy}
        error={correctionBarangaysError}
        onSelect={(barangayId) => {
          setSelectedCorrectionBarangayId(barangayId);
          setBarangayPickerVisible(false);
          void saveTimelineLocationCorrection(barangayId);
        }}
        onRetry={() => void loadCorrectionBarangays()}
        onClose={() => setBarangayPickerVisible(false)}
      />
    </SafeAreaView>
  );
}
