// MDRRMO's in-place verified-report workflow. The form is shared with the
// existing BDRRMO route so validation, GPS, media, and Edge Function handling
// remain identical.
import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfficialReportForm } from '../../app/official/log-incident';
import { spacing } from '../../styles/theme';

export default function OfficialReportModal({ visible, onClose, onSubmitted }: {
  visible: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, paddingTop: insets.top + spacing.xs }}>
        <Pressable style={{ flex: 1 }}>
          <OfficialReportForm onClose={onClose} onSubmitted={onSubmitted} />
        </Pressable>
      </View>
    </Modal>
  );
}
