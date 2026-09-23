import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useForgotPasswordFlow } from '../../hooks/useForgotPasswordFlow';
import { getForgotPasswordPreview, type ForgotPasswordPreviewName } from '../../lib/authPreview';
import { useRegistrationBackHandler } from '../../hooks/useRegistrationBackHandler';
import { registerStyles as styles } from '../../styles/screens/register.styles';
import PhoneStep from '../../components/register/PhoneStep';
import OTPStep from '../../components/register/OTPStep';
import PINStep from '../../components/register/PINStep';
import { colors } from '../../styles/theme';

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{
    phone?: string;
    source?: string;
    preview?: ForgotPasswordPreviewName;
  }>();
  const preview =
    typeof params.preview === 'string' ? params.preview as ForgotPasswordPreviewName : undefined;

  return <ForgotPasswordFlowScreen key={preview ?? 'live'} preview={preview} />;
}

function ForgotPasswordFlowScreen({ preview }: { preview?: ForgotPasswordPreviewName }) {
  const params = useLocalSearchParams<{ phone?: string; source?: string }>();
  const [phoneFocused, setPhoneFocused] = useState(false);
  const openedFromSettings = params.source === 'settings';

  const {
    step,
    phoneDigits,
    phoneError,
    phoneValidation,
    displayNumber,
    otp,
    otpError,
    pin,
    confirmPin,
    resendCooldown,
    otpSendCount,
    otpLimitReached,
    hasPendingOtp,
    canRequestOtp,
    sendingOTP,
    verifyingOTP,
    submitting,
    setOtp,
    setPin,
    setConfirmPin,
    handlePhoneInput,
    handleGetOTP,
    continueToOtpVerification,
    verifyOTP,
    handleResend,
    submitReset,
    goBack,
  } = useForgotPasswordFlow({
    ...getForgotPasswordPreview(preview),
    fallbackRoute: openedFromSettings ? '/(main)/profile' : '/(auth)/login',
    initialPhone:
      getForgotPasswordPreview(preview).initialPhone ??
      (typeof params.phone === 'string' ? params.phone : undefined),
  });

  useRegistrationBackHandler(goBack, true);

  const isPinStep = step === 2;
  const showSettingsResetDesign = openedFromSettings && step === 0;
  const stepContent = (
    <View style={styles.card}>
      {step === 0 && (
        <PhoneStep
          phoneDigits={phoneDigits}
          onChangePhone={handlePhoneInput}
          phoneFocused={phoneFocused}
          onFocus={() => setPhoneFocused(true)}
          onBlur={() => setPhoneFocused(false)}
          onSubmit={handleGetOTP}
          onContinueVerification={continueToOtpVerification}
          isValid={phoneValidation.valid}
          sendingOTP={sendingOTP}
          resendCooldown={resendCooldown}
          canRequestOtp={canRequestOtp}
          hasPendingOtp={hasPendingOtp}
          otpLimitReached={otpLimitReached}
          otpSendCount={otpSendCount}
          phoneError={phoneError}
          phoneLocked={openedFromSettings}
          settingsReset={showSettingsResetDesign}
          sectionLabel="Forgot pin"
        />
      )}
      {step === 1 && (
        <OTPStep
          displayNumber={displayNumber}
          otp={otp}
          otpError={otpError}
          onChangeOtp={setOtp}
          resendCooldown={resendCooldown}
          sendingOTP={sendingOTP}
          verifyingOTP={verifyingOTP}
          onResend={handleResend}
          onVerify={verifyOTP}
        />
      )}
      {step === 2 && (
        <PINStep
          phoneNumber={displayNumber}
          pin={pin}
          confirmPin={confirmPin}
          onChangePin={setPin}
          onChangeConfirmPin={setConfirmPin}
          onSubmit={submitReset}
          submitting={submitting}
          title="Set a new PIN"
          submitLabel="RESET PIN"
        />
      )}
    </View>
  );

  const centeredBody = (
    <View style={styles.centeredBlock}>
      {stepContent}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {showSettingsResetDesign ? (
          <View style={styles.settingsHeader}>
            <TouchableOpacity
              style={styles.settingsHeaderButton}
              onPress={goBack}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Back to settings"
            >
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </TouchableOpacity>
            <View
              style={styles.settingsHeaderButton}
              pointerEvents="none"
              accessible={false}
            >
              <Ionicons name="help-circle-outline" size={27} color={colors.text} />
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={localStyles.backButton}
            onPress={goBack}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
            <Text style={styles.backButtonText}>‹</Text>
          </TouchableOpacity>
        )}

        {isPinStep ? (
          <ScrollView
            contentContainerStyle={styles.fixedScrollContent}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
          >
            {centeredBody}
          </ScrollView>
        ) : (
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              contentContainerStyle={
                showSettingsResetDesign
                  ? styles.settingsResetScrollContent
                  : styles.fixedScrollContent
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
              scrollEnabled={false}
            >
              {centeredBody}
            </ScrollView>
          </TouchableWithoutFeedback>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  backButton: {
    position: 'absolute',
    top: 8,
    left: 16,
    zIndex: 10,
    width: 40,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
});
