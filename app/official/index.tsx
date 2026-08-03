// app/official/index.tsx
// Command (BDRRMO/MDRRMO) / Brief (Mayor): counts, priority cards, quick actions.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { colors, spacing } from '../../styles/theme';
import { logout } from '../../lib/auth';
import { scopeLabelFromAccess } from '../../lib/officialRegistration';
import { useOfficialPortal } from '../../context/OfficialPortalContext';
import { useOfficialReportQueue } from '../../hooks/useOfficialReports';
import { useEvacuationCenters } from '../../hooks/useEvacuationCenters';
import { NotificationsPlaceholder } from '../../components/navigation/AppHeader';
import MdrrmoHeader from '../../components/official/MdrrmoHeader';
import EvacuationSummarySection from '../../components/official/EvacuationSummarySection';
import MayorDashboard from '../../components/official/MayorDashboard';
import {
  fetchMyOfficialPublicProfile,
  type OfficialPublicProfile,
} from '../../lib/profile';
import { formatPublishedAt } from '../../lib/formatTime';
import type { OfficialReportQueueItem, ReportStatus } from '../../lib/officialReports';

function officialDisplayName(profile: OfficialPublicProfile | null): string | null {
  if (!profile) return null;
  return [profile.first_name, profile.middle_name, profile.last_name]
    .filter((part) => part?.trim())
    .join(' ')
    .trim() || null;
}

function escalationOverlayLabel(report: OfficialReportQueueItem): string {
  const barangay = report.barangayName?.trim() || 'unknown barangay';
  const when = formatPublishedAt(report.escalatedAt || report.createdAt);
  return `Escalated from ${barangay} Â· ${when}`;
}

function unverifiedOverlayLabel(report: OfficialReportQueueItem): string {
  return `New resident report - ${formatPublishedAt(report.createdAt)}`;
}

function statusOverviewTextStyle(status: ReportStatus) {
  if (status === 'verified') return styles.statusTextVerified;
  if (status === 'escalated') return styles.statusTextEscalated;
  if (status === 'resolved') return styles.statusTextResolved;
  return styles.statusTextUnverified;
}

function StatusReporterAvatars({
  reports,
  status,
}: {
  reports: OfficialReportQueueItem[];
  status: ReportStatus;
}) {
  const reporters = useMemo(() => {
    const names = new Set<string>();
    return reports.filter((report) => {
      if (report.status !== status || names.has(report.reporterName)) return false;
      names.add(report.reporterName);
      return true;
    }).slice(0, 3);
  }, [reports, status]);

  return (
    <View style={styles.statusAvatarGroup} accessibilityLabel={`${reporters.length} recent reporters`}>
      {reporters.map((report, index) => (
        <View key={`${report.id}-${index}`} style={[styles.statusAvatar, { marginLeft: index === 0 ? 0 : -10 }]}>
          <Text style={styles.statusAvatarText}>{report.reporterInitial}</Text>
        </View>
      ))}
    </View>
  );
}

export default function OfficialCommandScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { scope, officialKind, loading: scopeLoading, error: scopeError } =
    useOfficialPortal();
  const [loggingOut, setLoggingOut] = useState(false);
  const [profile, setProfile] = useState<OfficialPublicProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Mayor totals come from the compact all-time analytics view. Do not load
  // the 100-report operational queue or its media work for the Mayor Brief.
  const { reports, counts, error, loading, refreshing, refresh, reload } =
    useOfficialReportQueue(officialKind === 'Mayor' ? null : scope);

  const centersBarangayId =
    officialKind === 'BDRRMO' ? scope?.barangay_id ?? null : null;
  const {
    centers,
    error: centersError,
    refresh: refreshCenters,
  } = useEvacuationCenters({ barangayId: centersBarangayId });

  const priorityReports = useMemo(() => {
    if (!officialKind) return [];
    if (officialKind === 'BDRRMO') {
      return reports.filter((r) => r.status === 'unverified').slice(0, 3);
    }
    if (officialKind === 'MDRRMO') {
      return reports.filter((r) => r.status === 'escalated').slice(0, 3);
    }
    // Mayor: show escalated + unverified as situational indicators.
    return reports
      .filter((r) => r.status === 'escalated' || r.status === 'unverified')
      .slice(0, 3);
  }, [reports, officialKind]);

  const canLogIncident = officialKind === 'BDRRMO' || officialKind === 'MDRRMO';
  const screenTitle = officialKind === 'Mayor' ? 'Brief' : 'Command';
  const isOperationalCommand =
    officialKind === 'BDRRMO' || officialKind === 'MDRRMO';

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    const result = await fetchMyOfficialPublicProfile();
    setProfile(result.profile);
    setProfileError(result.error);
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    if (isOperationalCommand) void loadProfile();
  }, [isOperationalCommand, loadProfile]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const { error: logoutError } = await logout();
      if (logoutError) throw new Error(logoutError);
      router.replace('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not log out.';
      Alert.alert('Logout failed', message);
    } finally {
      setLoggingOut(false);
    }
  }

  async function handleRefresh() {
    await Promise.all([refresh(), refreshCenters()]);
    if (isOperationalCommand) await loadProfile();
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
            <Text style={styles.stateBody}>
              {scopeError || 'Could not load your official workspace.'}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleLogout}
              activeOpacity={0.85}
            >
              <Text style={styles.retryButtonText}>Log out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (isOperationalCommand) {
    const isBdrrmo = officialKind === 'BDRRMO';
    const profileName = officialDisplayName(profile);
    const statusCards: { status: ReportStatus; label: string; count: number }[] = [
      { status: 'unverified', label: 'Unverified', count: counts.unverified },
      { status: 'verified', label: 'Verified', count: counts.verified },
      { status: 'escalated', label: 'Escalated', count: counts.escalated },
      { status: 'resolved', label: 'Resolved', count: counts.resolved },
    ];
    // Card width tracks the device: leave side padding, and leave a peek of the
    // next card when more than one escalation is in the carousel.
    const escalationSidePad = spacing.lg * 2;
    const escalationCardWidth =
      priorityReports.length === 1
        ? Math.min(320, Math.max(260, windowWidth - escalationSidePad))
        : Math.min(300, Math.max(240, windowWidth - escalationSidePad - 36));
    // Slightly smaller display title on narrow phones so 2 lines fit cleanly.
    const escalationTitleSize = windowWidth < 360 ? 22 : windowWidth < 400 ? 24 : 28;
    // Shared min height (media + max copy + CTA) so every card matches and the
    // button always sits on the bottom edge, even when the description is short.
    const escalationMediaHeight = escalationCardWidth * (10 / 16);
    const escalationDetailsMinHeight =
      spacing.md * 2 +
      escalationTitleSize * 2.2 +
      spacing.sm +
      20 * 3 +
      spacing.md +
      48;
    const escalationCardMinHeight = Math.ceil(
      escalationMediaHeight + escalationDetailsMinHeight,
    );

    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          <MdrrmoHeader
            title="Command"
            right={
              <>
                <TouchableOpacity
                  style={styles.headerNotificationButton}
                  onPress={() => setNotificationsOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Notifications"
                >
                  <Ionicons name="notifications-outline" size={21} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={profileName ? styles.commandAvatar : styles.commandRoleBadge}
                  onPress={() => router.push('/official/settings' as Href)}
                  accessibilityRole="button"
                  accessibilityLabel="Open settings"
                >
                  {profileLoading ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Text style={profileName ? styles.commandAvatarText : styles.commandRoleBadgeText}>
                      {profileName?.charAt(0).toUpperCase() || 'MDRRMO'}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            }
          />

          {profileError ? (
            <View style={styles.inlineErrorRow}>
              <Text style={styles.stateBody}>Profile unavailable.</Text>
              <TouchableOpacity onPress={() => void loadProfile()} accessibilityRole="button">
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.section}>
            {loading ? (
              <View style={styles.stateBox}><ActivityIndicator color={colors.themeSoft} /></View>
            ) : null}
            {!loading && error ? (
              <View style={styles.stateBox}>
                <Text style={styles.stateTitle}>Could not load reports</Text>
                <Text style={styles.stateBody}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => void reload()}>
                  <Text style={styles.retryButtonText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {!loading && !error && priorityReports.length === 0 ? (
              <View style={styles.stateBoxBorderless}>
                <Text style={styles.stateTitle}>
                  {isBdrrmo ? 'No unverified reports right now' : 'No escalations right now'}
                </Text>
                <Text style={styles.stateBody}>
                  {isBdrrmo
                    ? 'New resident reports from your assigned barangay will appear here.'
                    : 'Escalated municipal reports will appear here.'}
                </Text>
              </View>
            ) : null}
            {!loading && !error && priorityReports.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[
                  styles.escalationList,
                  priorityReports.length === 1
                    ? { flexGrow: 1, justifyContent: 'center', paddingRight: 0 }
                    : null,
                ]}
              >
                {priorityReports.map((report) => (
                  <View
                    key={report.id}
                    style={[
                      styles.escalationCardShadow,
                      {
                        width: escalationCardWidth,
                        minHeight: escalationCardMinHeight,
                      },
                    ]}
                  >
                    <View style={styles.escalationCard}>
                      <View style={styles.escalationMedia}>
                        {report.firstPhotoUrl ? (
                          <Image source={{ uri: report.firstPhotoUrl }} style={styles.escalationImage} />
                        ) : (
                          <View style={styles.incidentImagePlaceholder}>
                            <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                          </View>
                        )}
                        <LinearGradient
                          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.82)', colors.white]}
                          locations={[0, 0.4, 1]}
                          style={styles.escalationMediaFade}
                          pointerEvents="none"
                        />
                        <View style={styles.escalationOverlay}>
                          <Ionicons
                            name="alert-circle"
                            size={14}
                            color={
                              report.status === 'unverified'
                                ? colors.unverified
                                : colors.danger
                            }
                          />
                          <Text
                            style={[
                              styles.escalationOverlayText,
                              statusOverviewTextStyle(report.status),
                            ]}
                            numberOfLines={1}
                          >
                            {isBdrrmo
                              ? unverifiedOverlayLabel(report)
                              : escalationOverlayLabel(report)}
                          </Text>
                        </View>
                        {report.mediaCount > 1 ? (
                          <View style={styles.escalationAttachmentBadge}>
                            <Text style={styles.escalationAttachmentBadgeText}>
                              +{report.mediaCount - 1}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.escalationDetails}>
                        <View style={styles.escalationDetailsCopy}>
                          <Text
                            style={[
                              styles.escalationCardTitle,
                              statusOverviewTextStyle(report.status),
                              { fontSize: escalationTitleSize },
                            ]}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                          >
                            {report.title.trim() || 'Untitled report'}
                          </Text>
                          <Text
                            style={styles.escalationDescription}
                            numberOfLines={3}
                            ellipsizeMode="tail"
                          >
                            {report.description.trim() || 'No description provided.'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.escalationDetailsButton}
                          onPress={() => router.push(`/official/${report.id}` as Href)}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel={`${
                            isBdrrmo ? 'Review report' : 'Show full report'
                          } for ${report.title || 'incident'}`}
                        >
                          <Text
                            style={styles.escalationDetailsButtonText}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {isBdrrmo ? 'Review report' : 'Show full report'}
                          </Text>
                          <Ionicons name="arrow-forward" size={18} color={colors.white} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>

          <View style={styles.section}>
            {statusCards.map((item) => (
              <TouchableOpacity
                key={item.status}
                style={styles.statusOverviewCard}
                onPress={() => router.push(`/official/incidents?status=${item.status}` as Href)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Show ${item.label.toLowerCase()} incidents`}
              >
                <View>
                  <Text style={[styles.countLabel, statusOverviewTextStyle(item.status)]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.countValue, statusOverviewTextStyle(item.status)]}>
                    {item.count}
                  </Text>
                </View>
                <StatusReporterAvatars reports={reports} status={item.status} />
              </TouchableOpacity>
            ))}
          </View>

          <EvacuationSummarySection
            centers={centers}
            error={centersError}
            officialKind={officialKind}
          />
        </ScrollView>
        <NotificationsPlaceholder visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      </SafeAreaView>
    );
  }

  if (officialKind === 'Mayor') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <MayorDashboard
          centers={centers}
          centersError={centersError}
          onRefreshCenters={refreshCenters}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerTextGroup}>
            <Text style={styles.brandLabel}>DisasterLink</Text>
            <Text style={styles.screenTitle}>{screenTitle}</Text>
            <Text style={styles.screenSubtitle}>
              {scopeLabelFromAccess(scope)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerLogoutButton}
            onPress={handleLogout}
            disabled={loggingOut}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            {loggingOut ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.headerLogoutText}>Log out</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status overview</Text>
          <View style={styles.countsRow}>
            <View style={styles.countChip}>
              <Text style={styles.countValue}>{counts.unverified}</Text>
              <Text style={styles.countLabel}>Unverified</Text>
            </View>
            <View style={styles.countChip}>
              <Text style={styles.countValue}>{counts.verified}</Text>
              <Text style={styles.countLabel}>Verified</Text>
            </View>
            <View style={styles.countChip}>
              <Text style={styles.countValue}>{counts.escalated}</Text>
              <Text style={styles.countLabel}>Escalated</Text>
            </View>
            <View style={styles.countChip}>
              <Text style={styles.countValue}>{counts.resolved}</Text>
              <Text style={styles.countLabel}>Resolved</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Situation indicators</Text>

          {loading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color={colors.themeSoft} />
            </View>
          ) : null}

          {!loading && error ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateTitle}>Could not load reports</Text>
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

          {!loading && !error && priorityReports.length === 0 ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateTitle}>Nothing urgent in queue</Text>
              <Text style={styles.stateBody}>
                Priority work for your role will appear here.
              </Text>
            </View>
          ) : null}

          {!loading &&
            !error &&
            priorityReports.map((report) => (
              <TouchableOpacity
                key={report.id}
                style={styles.priorityCard}
                activeOpacity={0.85}
                onPress={() => router.push(`/official/${report.id}` as Href)}
              >
                <Text style={styles.priorityCardTitle} numberOfLines={2}>
                  {report.title.trim() || 'Untitled report'}
                </Text>
                <Text style={styles.priorityCardBody} numberOfLines={2}>
                  {report.description.trim() || 'No description provided.'}
                </Text>
              </TouchableOpacity>
            ))}
        </View>

        <EvacuationSummarySection
          centers={centers}
          error={centersError}
          officialKind={officialKind}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={styles.quickAction}
              activeOpacity={0.85}
              onPress={() => router.push('/official/incidents' as Href)}
            >
              <Ionicons name="alert-circle-outline" size={18} color={colors.white} />
              <Text style={styles.quickActionText}>
                {officialKind === 'Mayor' ? 'Situations' : 'Incidents'}
              </Text>
            </TouchableOpacity>

            {canLogIncident ? (
              <TouchableOpacity
                style={styles.quickAction}
                activeOpacity={0.85}
                onPress={() => router.push('/official/log-incident' as Href)}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.white} />
                <Text style={styles.quickActionText}>Log incident</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.quickAction, styles.quickActionSecondary]}
              activeOpacity={0.85}
              onPress={() => router.push('/official/community' as Href)}
            >
              <Ionicons name="megaphone-outline" size={18} color={colors.text} />
              <Text
                style={[styles.quickActionText, styles.quickActionTextSecondary]}
              >
                Community
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickAction, styles.quickActionSecondary]}
              activeOpacity={0.85}
              onPress={() => router.push('/official/resources' as Href)}
            >
              <Ionicons
                name={officialKind === 'Mayor' ? 'star-outline' : 'business-outline'}
                size={18}
                color={colors.text}
              />
              <Text
                style={[styles.quickActionText, styles.quickActionTextSecondary]}
              >
                {officialKind === 'Mayor' ? 'Priority' : 'Resources'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
