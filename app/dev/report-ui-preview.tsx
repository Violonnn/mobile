import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import IncidentTypeBadge from '../../components/report/IncidentTypeBadge';
import OfficialReportQueueRow from '../../components/official/OfficialReportQueueRow';
import ReportStatusSummary from '../../components/official/ReportStatusSummary';
import ReviewDecisionPanel from '../../components/official/ReviewDecisionPanel';
import IncidentCasePanel from '../../components/official/IncidentCasePanel';
import MdrrmoSettingsWorkspace from '../../components/official/MdrrmoSettingsWorkspace';
import OfficialAnnouncementPostCard from '../../components/official/OfficialAnnouncementPostCard';
import OfficialReportPostCard from '../../components/official/OfficialReportPostCard';
import InteractiveMap from '../../components/map/InteractiveMap';
import { officialReportMapMarker } from '../../components/map/officialMapReports';
import ReportOutcomeNotice from '../../components/report/ReportOutcomeNotice';
import ReportStatusTimeline from '../../components/report/ReportStatusTimeline';
import ResidentReportTimeline from '../../components/report/ResidentReportTimeline';
import { isDemoAuthEnabled } from '../../lib/demoAuth';
import { reportUiPreviewAnnouncements, reportUiPreviewDetail, reportUiPreviewIncident, reportUiPreviewReports, reportUiPreviewScope } from '../../lib/fixtures/reportUiPreview';
import { formatAnnouncementOfficeLabel } from '../../lib/announcements';
import { allowedIncidentActions } from '../../lib/incidentCases';
import { scopedLifecyclePresentation } from '../../lib/reportPresentation';
import type { MapReportMarker } from '../../lib/reports';
import { residentStageTone, type LifecycleSummary, type PrimaryStage } from '../../lib/reportLifecycle';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';

const reviewStages: PrimaryStage[] = ['under_review', 'being_assessed', 'confirmed', 'response_ongoing', 'resolved', 'withdrawn'];

/** Development-only rendering of real report components; no workflow writes or private data. */
export default function ReportUiPreviewScreen() {
  const { stage: requestedStage, role, surface, phase } = useLocalSearchParams<{ stage?: string; role?: string; surface?: string; phase?: string }>();
  if (!isDemoAuthEnabled()) return null;

  const stage = reviewStages.find((candidate) => candidate === requestedStage) ?? 'response_ongoing';
  const lifecycle: LifecycleSummary = {
    primaryStage: stage,
    coordinationBadge: 'support_requested',
    summaryMissing: stage === 'resolved',
  };
  const audience = role === 'bdrrmo' ? 'bdrrmo' : role === 'mitcom' ? 'mitcom' : 'resident';
  if (surface === 'community') {
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.meta}>LOCAL PRESENTATION PREVIEW</Text>
          {reportUiPreviewReports.slice(0, 2).map((report) => (
            <OfficialReportPostCard key={report.id} report={report} variant="residentFeed"
              audience={role === 'bdrrmo' ? 'bdrrmo' : role === 'mitcom' ? 'mitcom' : undefined}
              onPress={() => {}} onCommentPress={() => {}} />
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }
  if (surface === 'announcements') {
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.meta}>LOCAL PRESENTATION PREVIEW</Text>
          {reportUiPreviewAnnouncements.map((announcement) => (
            <OfficialAnnouncementPostCard key={announcement.id} announcement={announcement}
              officeLabel={formatAnnouncementOfficeLabel(announcement, undefined, role === 'mayor' ? 'MDRRMO' : 'MITCOM')}
              useScopedOfficeLabels={role !== 'mayor'} />
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }
  if (surface === 'settings') {
    return <MdrrmoSettingsWorkspace profile={null} profileError={null} profileLoading={false} onRetryProfile={() => {}} onAvatarChanged={() => {}} roleVariant={role === 'mayor' ? 'mayor' : 'mitcom'} />;
  }
  if (surface === 'map' && audience !== 'resident') {
    const markers = reportUiPreviewReports.map(officialReportMapMarker).filter((marker): marker is MapReportMarker => marker !== null);
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.title}>Roadside flooding</Text>
        <View style={styles.screen}>
          <InteractiveMap markers={markers} reportLegendAudience={audience} showReportStatusFilters reportPresentation={(marker) => {
            if (!marker.lifecycle) return null;
            const presentation = scopedLifecyclePresentation(marker.lifecycle, { audience });
            return { label: presentation.stageLabel, color: presentation.tone.color };
          }} />
        </View>
      </SafeAreaView>
    );
  }
  if (surface === 'actions' && audience !== 'resident') {
    const municipal = audience === 'mitcom';
    const detail = reportUiPreviewDetail(municipal, phase === 'claimed');
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.meta}>LOCAL PRESENTATION PREVIEW · {audience.toUpperCase()}</Text>
          <Text style={styles.title}>Roadside flooding</Text>
          <Text style={styles.heading}>Report review</Text>
          <ReportStatusSummary summary={detail.lifecycle} context={{ audience, barangayName: detail.barangayName, leadOffice: detail.lifecycleFacts.leadOffice }} />
          <ReviewDecisionPanel detail={detail} currentUserId={detail.currentUserId} onChanged={() => {}} onOpenLinkSheet={() => {}} />
          <Text style={styles.heading}>Incident with a pending transfer</Text>
          <IncidentCasePanel incident={reportUiPreviewIncident} viewerKind={municipal ? 'MDRRMO' : 'BDRRMO'} allowedActions={allowedIncidentActions(reportUiPreviewScope(municipal), reportUiPreviewIncident)} onChanged={() => {}} onLogActivity={() => {}} useScopedOfficeLabels />
        </ScrollView>
      </SafeAreaView>
    );
  }
  if (surface === 'queue' && audience !== 'resident') {
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.meta}>LOCAL PRESENTATION PREVIEW · {audience.toUpperCase()}</Text>
          <Text style={styles.title}>Roadside flooding</Text>
          {reportUiPreviewReports.map((report, index) => (
            <OfficialReportQueueRow key={report.id} report={report} audience={audience} actionLabel={audience === 'bdrrmo' ? 'Review' : 'View'} onPress={() => {}} first={index === 0} />
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.meta}>LOCAL PRESENTATION PREVIEW</Text>
        <Text style={styles.title}>Roadside flooding</Text>
        <Text style={styles.body}>Water is rising beside the road. The nearby footpath is affected.</Text>
        <View style={styles.types}>
          <IncidentTypeBadge incidentType="fire" />
          <IncidentTypeBadge incidentType="flood" />
          <IncidentTypeBadge incidentType="road_crash" />
          <IncidentTypeBadge incidentType="medical" />
          <IncidentTypeBadge incidentType="other" incidentTypeOther="Fallen tree" />
        </View>
        <View style={styles.section}>
          <Text style={styles.heading}>Report progress</Text>
          {audience !== 'resident' && <ReportStatusSummary summary={lifecycle} context={{ audience, barangayName: 'Calajo-an' }} />}
          <ReportStatusTimeline lifecycle={lifecycle} useStatusProgressColors showScopedCoordinationDetails />
        </View>
        <ReportOutcomeNotice summary={lifecycle} reasonCode={null} publicSummary={null} publicCorrection={null} useScopedPresentation />
        <ResidentReportTimeline currentStatusTone={residentStageTone(lifecycle)} entries={[
          { occurredAt: '2026-11-18T01:00:00Z', entryType: 'received', publicText: 'Received by DisasterLink.', responsibleOfficeLabel: 'Barangay response office' },
          { occurredAt: '2026-11-18T01:10:00Z', entryType: 'review_claimed', publicText: 'The responsible office started reviewing your report.', responsibleOfficeLabel: 'Barangay response office' },
          { occurredAt: '2026-11-18T02:00:00Z', entryType: 'support_requested', publicText: 'Municipal support requested. The barangay remains responsible.', responsibleOfficeLabel: 'Barangay response office' },
        ]} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, maxWidth: 760, width: '100%', alignSelf: 'center' },
  title: { fontFamily: fonts.bold, fontSize: fontSizes.xl, color: colors.navigationActive },
  heading: { fontFamily: fonts.semibold, fontSize: fontSizes.lg, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: fontSizes.md, lineHeight: 22, color: colors.text },
  meta: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.textMuted },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  section: { gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.offWhite },
});
