import React, { useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { colors } from '../../styles/theme';
import { reportStyles as styles, reportColors } from '../../styles/screens/report.styles';
import { useReportFlow, type ReportStep } from '../../hooks/useReportFlow';
import ReportProgress from '../report/ReportProgress';
import LocationStep from '../report/LocationStep';
import DetailsStep from '../report/DetailsStep';
import AttachmentsStep from '../report/AttachmentsStep';
import SuccessStep from '../report/SuccessStep';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmitted?: (reportId: string) => void;
};

const PROGRESS_LABELS: Record<ReportStep, string> = {
  location: 'Getting location',
  attachments: 'What are you seeing?',
  details: 'Report details',
  success: 'Report submitted',
};

export default function ReportModal({ visible, onClose, onSubmitted }: Props) {
  const flow = useReportFlow(visible);

  const submittedIdRef = React.useRef<string | null>(null);

  const handleClose = useCallback(() => {
    if (flow.submitting) return;
    onClose();
  }, [flow.submitting, onClose]);

  const handleDone = useCallback(() => {
    onClose();
    if (submittedIdRef.current) {
      onSubmitted?.(submittedIdRef.current);
      submittedIdRef.current = null;
    }
  }, [onClose, onSubmitted]);

  const handleSubmit = useCallback(async () => {
    await flow.submit();
  }, [flow]);

  // Capture the queued id so "Done" can navigate to the map afterwards.
  React.useEffect(() => {
    if (flow.step === 'success' && flow.queuedReportId) {
      submittedIdRef.current = flow.queuedReportId;
    }
  }, [flow.step, flow.queuedReportId]);

  if (!visible) {
    return <Modal visible={false} transparent onRequestClose={handleClose} />;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="megaphone" size={20} color={reportColors.text} />
              <Text style={styles.headerTitle}>Report an emergency</Text>
            </View>
            {flow.step !== 'success' ? (
              <TouchableOpacity
                onPress={handleClose}
                hitSlop={8}
                disabled={flow.submitting}
                accessibilityRole="button"
                accessibilityLabel="Close report"
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <ReportProgress
            progress={flow.progress}
            label={PROGRESS_LABELS[flow.step]}
          />

          <ScrollView
            style={styles.stepHost}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View key={flow.step} entering={FadeInRight.duration(280)}>
              {flow.step === 'location' && (
                <LocationStep
                  loading={flow.locationLoading}
                  error={flow.locationError}
                  onRetry={flow.retryLocation}
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
                  onNext={flow.goToDetails}
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
                  address={flow.address}
                  error={flow.error}
                  submitting={flow.submitting}
                  onBack={flow.goBack}
                  onSubmit={handleSubmit}
                />
              )}

              {flow.step === 'success' && (
                <SuccessStep
                  address={flow.address}
                  position={flow.position}
                  syncStatus={flow.syncStatus}
                  onDone={handleDone}
                />
              )}
            </Animated.View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
