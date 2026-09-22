import React, { useCallback } from 'react';
import {
  Alert,
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeOutLeft,
  SlideInRight,
} from 'react-native-reanimated';
import {
  reportStyles as styles,
  reportColors,
} from '../../styles/screens/report.styles';
import { useReportFlow, type ReportStep } from '../../hooks/useReportFlow';
import ReportProgress from '../report/ReportProgress';
import LocationStep from '../report/LocationStep';
import DetailsStep from '../report/DetailsStep';
import AttachmentsStep from '../report/AttachmentsStep';
import SuccessStep from '../report/SuccessStep';
import ReviewStep from '../report/ReviewStep';
import ReportBarangayPicker from '../report/ReportBarangayPicker';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmitted?: (reportId: string) => void;
};

const PROGRESS_LABELS: Record<Exclude<ReportStep, 'success'>, string> = {
  location: 'Location',
  attachments: 'Evidence',
  details: 'Details',
  review: 'Review',
};

const STEP_NUMBERS: Record<Exclude<ReportStep, 'success'>, number> = {
  location: 1,
  attachments: 2,
  details: 3,
  review: 4,
};

export default function ReportModal({ visible, onClose, onSubmitted }: Props) {
  const flow = useReportFlow(visible);
  const { height, fontScale } = useWindowDimensions();

  // Keep the larger, readable text usable on shorter screens and when the
  // resident has selected a larger system text size.
  const useCompactSpacing = height < 720 || fontScale > 1.15;
  const [barangayPickerVisible, setBarangayPickerVisible] = React.useState(false);

  const submittedIdRef = React.useRef<string | null>(null);

  const requestClose = useCallback(() => {
    if (flow.submitting) return;

    Alert.alert(
      'Discard this report?',
      'Your report details will be lost if you close this form.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard report',
          style: 'destructive',
          onPress: () => {
            setBarangayPickerVisible(false);
            flow.discardDraftMedia();
            onClose();
          },
        },
      ],
    );
  }, [flow, onClose]);

  const handleDone = useCallback(() => {
    setBarangayPickerVisible(false);
    onClose();
    if (submittedIdRef.current) {
      const submittedReportId = submittedIdRef.current;
      submittedIdRef.current = null;
      onSubmitted?.(submittedReportId);
    }
  }, [onClose, onSubmitted]);

  const handleSubmit = useCallback(async () => {
    await flow.submit();
  }, [flow]);

  const canDismissDeliveredReport =
    flow.step === 'success' && flow.syncStatus === 'synced';

  // Capture the queued id so "Done" can navigate to the map afterwards.
  React.useEffect(() => {
    if (flow.step === 'success' && flow.queuedReportId) {
      submittedIdRef.current = flow.queuedReportId;
    }
  }, [flow.step, flow.queuedReportId]);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      presentationStyle="overFullScreen"
      animationType="fade"
      onRequestClose={canDismissDeliveredReport ? handleDone : () => {}}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {canDismissDeliveredReport ? (
          <Pressable
            style={styles.overlayDismissArea}
            onPress={handleDone}
            accessibilityRole="button"
            accessibilityLabel="Close sent report"
          />
        ) : null}
        <KeyboardAvoidingView
          style={styles.keyboardHost}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.card, useCompactSpacing && styles.cardCompact]}>
            <View
              style={[
                styles.headerContainer,
                useCompactSpacing && styles.headerContainerCompact,
              ]}
            >
              <View
                style={[
                  styles.headerRow,
                  useCompactSpacing && styles.headerRowCompact,
                ]}
              >
                <Text style={styles.headerTitle}>Report incident</Text>
                {canDismissDeliveredReport ? (
                  <TouchableOpacity
                    style={styles.deliveredCloseButton}
                    onPress={handleDone}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Close sent report"
                  >
                    <Ionicons name="close" size={25} color={reportColors.white} />
                  </TouchableOpacity>
                ) : flow.step !== 'success' ? (
                  <TouchableOpacity
                    onPress={requestClose}
                    hitSlop={8}
                    disabled={flow.submitting}
                    accessibilityRole="button"
                    accessibilityLabel="Close report"
                  >
                    <Ionicons name="close" size={25} color={reportColors.white} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {flow.step !== 'success' ? (
                <ReportProgress
                  stepNumber={STEP_NUMBERS[flow.step]}
                  label={PROGRESS_LABELS[flow.step]}
                />
              ) : null}

              {flow.step !== 'success' ? (
                <View style={styles.emergencyBanner}>
                  <Text style={styles.emergencyBannerText}>
                    Immediate danger? Move to safety and call the hotlines
                  </Text>
                </View>
              ) : null}
            </View>

            <View
              style={[
                styles.contentPanel,
                useCompactSpacing && styles.contentPanelCompact,
              ]}
            >
              <ScrollView
                style={styles.stepHost}
                contentContainerStyle={styles.stepHostContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Animated.View
                  key={flow.step}
                  entering={SlideInRight.duration(330)}
                  exiting={FadeOutLeft.duration(160)}
                >
                  {flow.step === 'location' && (
                    <LocationStep
                      loading={flow.locationLoading}
                      error={flow.locationError}
                      position={flow.position}
                      devicePosition={flow.devicePosition}
                      address={flow.address}
                      needsConfirmation={flow.locationNeedsConfirmation}
                      accuracyMeters={flow.position?.accuracyMeters}
                      movedDistanceMeters={flow.movedDistanceMeters}
                      maximumDistanceMeters={flow.maximumAdjustmentMeters}
                      adjustingPin={flow.locationPickerVisible}
                      onRetry={flow.retryLocation}
                      onConfirmOnMap={flow.openLocationPicker}
                      onCancelPinAdjustment={flow.closeLocationPicker}
                      onConfirmPinAdjustment={flow.confirmManualPosition}
                      onOpenBarangayPicker={() => setBarangayPickerVisible(true)}
                      onContinue={flow.confirmLocation}
                      residentLayout
                    />
                  )}

                  {flow.step === 'attachments' && (
                    <AttachmentsStep
                      media={flow.media}
                      usedPhotoSlots={flow.usedPhotoSlots}
                      usedVideoSeconds={flow.usedVideoSeconds}
                      maxPhotos={flow.maxPhotos}
                      maxVideoSeconds={flow.maxVideoSeconds}
                      canProceed={flow.canProceedAttachments}
                      error={flow.error}
                      onAddPhoto={flow.addPhoto}
                      onAddVideo={flow.addVideo}
                      onRemove={flow.removeMedia}
                      onBack={flow.goBack}
                      onNext={flow.goToDetails}
                      residentLayout
                    />
                  )}

                  {flow.step === 'details' && (
                    <DetailsStep
                      title={flow.title}
                      onChangeTitle={flow.setTitle}
                      description={flow.description}
                      onChangeDescription={flow.setDescription}
                      locationNote={flow.locationNote}
                      onChangeLocationNote={flow.setLocationNote}
                      incidentType={flow.incidentType}
                      onChangeIncidentType={flow.setIncidentType}
                      incidentTypeOther={flow.incidentTypeOther}
                      onChangeIncidentTypeOther={flow.setIncidentTypeOther}
                      address={flow.address}
                      barangays={flow.barangays}
                      barangaysLoading={flow.barangaysLoading}
                      barangaysError={flow.barangaysError}
                      selectedBarangayId={flow.selectedBarangayId}
                      onSelectBarangay={flow.setSelectedBarangayId}
                      onRetryBarangays={flow.retryBarangays}
                      locationConfirmed={flow.locationConfirmed}
                      error={flow.error}
                      submitting={flow.submitting}
                      onBack={flow.goBack}
                      onSubmit={flow.goToReview}
                      residentLayout
                    />
                  )}

                  {flow.step === 'review' && (
                    <ReviewStep
                      address={flow.address}
                      position={flow.position}
                      movedDistanceMeters={flow.movedDistanceMeters}
                      media={flow.media}
                      incidentType={flow.incidentType}
                      incidentTypeOther={flow.incidentTypeOther}
                      title={flow.title}
                      description={flow.description}
                      locationNote={flow.locationNote}
                      error={flow.error}
                      submitting={flow.submitting}
                      onEditLocation={flow.editLocation}
                      onEditEvidence={flow.editEvidence}
                      onEditDetails={flow.editDetails}
                      onSubmit={handleSubmit}
                    />
                  )}

                  {flow.step === 'success' && (
                    <SuccessStep
                      address={flow.address}
                      position={flow.position}
                      syncStatus={flow.syncStatus}
                      syncError={flow.syncError}
                      canRetry={flow.syncCanRetry}
                      onRetry={flow.retrySync}
                      onDone={handleDone}
                    />
                  )}
                </Animated.View>
              </ScrollView>
            </View>

            <ReportBarangayPicker
              visible={barangayPickerVisible}
              barangays={flow.barangays}
              selectedBarangayId={flow.selectedBarangayId}
              loading={flow.barangaysLoading}
              error={flow.barangaysError}
              onSelect={flow.setSelectedBarangayId}
              onRetry={flow.retryBarangays}
              onClose={() => setBarangayPickerVisible(false)}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
