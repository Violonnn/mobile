import React, { useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { registerStyles as styles, registerColors } from '../../styles/screens/register.styles';

const TERMS_CONTENT = `Terms and Conditions

Last updated: January 1, 2025

1. Acceptance of Terms
By registering and using DisasterLink, you agree to be bound by these Terms and Conditions. If you do not agree, do not use this application.

2. Purpose of the Application
DisasterLink is a disaster response and coordination platform intended for use by residents and local government units (LGUs) of Minglanilla, Cebu. It is designed to facilitate communication and assistance during emergencies and disaster situations.

3. User Responsibilities
You agree to provide accurate and truthful information during registration. You are responsible for maintaining the confidentiality of your account credentials. You agree not to misuse the platform, including submitting false emergency reports or requests.

4. Data Collection and Use
We collect personal information including your name, phone number, barangay, and date of birth for the purpose of identity verification and disaster response coordination. Your data will not be sold to third parties.

5. Account Termination
Accounts found to be in violation of these terms may be suspended or permanently terminated without prior notice.

6. Limitation of Liability
DisasterLink and its developers shall not be held liable for any damages arising from the use or inability to use the application, including during active disaster events where connectivity may be limited.

7. Changes to Terms
We reserve the right to modify these Terms and Conditions at any time. Continued use of the application after changes constitutes acceptance of the new terms.

8. Governing Law
These Terms shall be governed by the laws of the Republic of the Philippines.

Privacy Policy

Last updated: January 1, 2025

1. Information We Collect
We collect the following personal data upon registration: full name, mobile phone number, barangay of residence, birth month and year, and a security PIN.

2. Legal Basis
The collection and processing of your personal data is governed by Republic Act No. 10173, also known as the Data Privacy Act of 2012. By registering, you give your informed consent to the collection and use of your data as described in this policy.

3. How We Use Your Information
Your information is used to verify your identity, link you to your barangay's disaster response network, facilitate communication between residents and LGU officials during emergencies, and generate anonymized data for disaster preparedness planning.

4. Data Sharing
Your personal information may be shared with authorized LGU officials of Minglanilla, Cebu solely for disaster response purposes. We do not share your data with commercial third parties.

5. Data Retention
Your data will be retained for as long as your account is active. You may request deletion of your account and associated data by contacting your barangay administrator.

6. Your Rights
Under RA 10173, you have the right to be informed, to access your data, to correct inaccurate data, to object to processing, and to erasure of your data.

7. Security
We implement reasonable technical and organizational measures to protect your personal data from unauthorized access, disclosure, or destruction.

8. Contact
For privacy-related concerns, contact your barangay administrator or the DisasterLink system administrator.`;

type LegalModalProps = {
  visible: boolean;
  onAccept: () => void;
};

export default function LegalModal({ visible, onAccept }: LegalModalProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 32;
    if (isAtBottom) setHasScrolledToBottom(true);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.legalModalSheet}>
          <View style={styles.legalModalHeader}>
            <Text style={styles.legalModalTitle}>Terms & Conditions and Privacy Policy</Text>
          </View>

          <ScrollView
            style={styles.legalModalScroll}
            contentContainerStyle={styles.legalModalScrollContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator
          >
            <Text style={styles.legalModalBody}>{TERMS_CONTENT}</Text>
            <View style={styles.legalModalScrollAnchor} />
          </ScrollView>

          {!hasScrolledToBottom && (
            <View style={styles.legalScrollHint}>
              <Text style={styles.legalScrollHintText}>Scroll to the bottom to continue</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.legalAcceptButton,
              !hasScrolledToBottom && styles.legalAcceptButtonDisabled,
            ]}
            onPress={onAccept}
            disabled={!hasScrolledToBottom}
          >
            <Text
              style={[
                styles.legalAcceptButtonText,
                !hasScrolledToBottom && styles.legalAcceptButtonTextDisabled,
              ]}
            >
              I have read and agree
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}