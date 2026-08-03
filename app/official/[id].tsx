// app/official/[id].tsx
// Official report detail: content, attribution, timeline, status actions,
// and protected "Call reporter" (masked until confirmed).

import React, { useEffect, useRef, useState } from 'react';
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
import { useOfficialPortal } from '../../context/OfficialPortalContext';
import { useOfficialReportDetail } from '../../hooks/useOfficialReports';
import {
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
import { updateOfficialReport } from '../../lib/officialReportSubmit';
import CommentsSection from '../../components/report/CommentsSection';

function routeFocus(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return null;
}

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
  if (event.toStatus && event.fromStatus) {
    return `${statusLabel(event.fromStatus)} → ${statusLabel(event.toStatus)}`;
  }
  if (event.toStatus) {
    return `Reported as ${statusLabel(event.toStatus)}`;
  }
  return 'Status update';
}

export default function OfficialReportDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; focus?: string | string[] }>();
  const reportId = typeof params.id === 'string' ? params.id : undefined;
  // Community chat icon opens Report operations focused on the comments block.
  const focusComments = routeFocus(params.focus) === 'comments';

  const {
    scope,
    officialKind: kind,
    loading: scopeLoading,
    error: scopeError,
  } = useOfficialPortal();
  const [note, setNote] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLatitude, setEditLatitude] = useState('');
  const [editLongitude, setEditLongitude] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  // Verification / Timeline start collapsed; tap a header to reveal its content.
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<ReportMediaAttachment | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  // Keep auto-scroll armed until the user drags, so late-loading comments still land in view.
  const pendingScrollToComments = useRef(focusComments);

  const { detail, error, loading, refreshing, refresh, reload } =
    useOfficialReportDetail(reportId, scope);

  useEffect(() => {
    pendingScrollToComments.current = focusComments;
  }, [focusComments, reportId]);

  useEffect(() => {
    if (!focusComments || loading || !detail) return;
    const timer = setTimeout(() => {
      if (pendingScrollToComments.current) {
        scrollRef.current?.scrollToEnd({ animated: true });
      }
    }, Platform.OS === 'ios' ? 250 : 80);
    return () => clearTimeout(timer);
  }, [focusComments, loading, detail?.id]);

  function confirmTransition(target: ReportStatus) {
    if (!detail || !kind || actionBusy) return;

    Alert.alert(
      transitionActionLabel(target),
      transitionConfirmMessage(target, kind),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: target === 'escalated' ? 'destructive' : 'default',
          onPress: () => {
            void runTransition(target);
          },
        },
      ],
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
      'Call reporter',
      'Use this number only to verify or coordinate this incident.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
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

  function beginEdit() {
    if (!detail) return;
    setEditTitle(detail.title);
    setEditDescription(detail.description);
    setEditAddress(detail.addressText ?? '');
    setEditLatitude(String(detail.latitude));
    setEditLongitude(String(detail.longitude));
    setEditing(true);
  }

  async function saveEdit() {
    if (!detail || editBusy) return;
    setEditBusy(true);
    const result = await updateOfficialReport({
      reportId: detail.id,
      title: editTitle,
      description: editDescription,
      position: {
        latitude: Number(editLatitude),
        longitude: Number(editLongitude),
        accuracyMeters: null,
      },
      addressText: editAddress,
      barangayId: detail.barangayId,
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.themeSoft} />
        </View>
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (pendingScrollToComments.current) {
              scrollRef.current?.scrollToEnd({ animated: true });
            }
          }}
          onScrollBeginDrag={() => {
            pendingScrollToComments.current = false;
          }}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back to queue"
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.headerTextGroup}>
              <Text style={styles.brandLabel}>Incident detail</Text>
              <Text style={styles.screenTitle} numberOfLines={1}>
                Report operations
              </Text>
            </View>
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
              <View style={styles.detailCard}>
                <View style={styles.queueCardHeader}>
                  <Text style={styles.detailTitle}>
                    {detail.title.trim() || 'Untitled report'}
                  </Text>
                  <View
                    style={[styles.statusPill, statusPillStyle(detail.status)]}
                  >
                    <Text style={styles.statusPillText}>
                      {statusLabel(detail.status)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.detailBody}>
                  {detail.description.trim() || 'No description provided.'}
                </Text>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Reporter</Text>
                  <Text style={styles.metaValue}>{detail.reporterName}</Text>
                </View>

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

                {detail.media.length > 0 ? (
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

                {detail.mediaError ? (
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

              {detail.canEditContent ? (
                <View style={styles.detailCard}>
                  <View style={styles.queueCardHeader}>
                    <Text style={styles.sectionTitle}>Correct incident details</Text>
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
                      <Text style={styles.formLabel}>Address</Text>
                      <TextInput
                        style={styles.formInput}
                        value={editAddress}
                        onChangeText={setEditAddress}
                        maxLength={300}
                        editable={!editBusy}
                      />
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
                      Only the submitting officer can correct content and location.
                    </Text>
                  )}
                </View>
              ) : null}

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

              {kind === 'Mayor' ? (
                <View style={styles.readOnlyBanner}>
                  <Text style={styles.readOnlyText}>
                    Mayor view is read-only. Status changes and reporter contact
                    are not available.
                  </Text>
                </View>
              ) : null}

              {kind !== 'Mayor' && detail.allowedTransitions.length > 0 ? (
                <View style={styles.statusActionsCard}>
                  <Text style={styles.sectionTitle}>Status actions</Text>
                  <Text style={styles.noteHint}>
                    Optional note (max 500 characters) is saved with the status
                    change.
                  </Text>
                  <TextInput
                    style={styles.noteInput}
                    value={note}
                    onChangeText={setNote}
                    placeholder="Add a short note for the timeline"
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
                              color={isEscalate ? colors.danger : colors.white}
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
              ) : null}

              <View style={styles.detailCard}>
                <CommentsSection
                  reportId={detail.id}
                  refreshSignal={refreshing ? 1 : 0}
                  moderationMode={kind === 'MDRRMO' || kind === 'BDRRMO' ? 'scoped' : 'none'}
                  autoFocus={focusComments}
                  highlighted={focusComments}
                  onComposerFocus={() =>
                    scrollRef.current?.scrollToEnd({ animated: true })
                  }
                />
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <ReportMediaPreviewModal
        preview={mediaPreview}
        onClose={() => setMediaPreview(null)}
      />
    </SafeAreaView>
  );
}
