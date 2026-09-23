import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Image,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRegistrationFlow } from '../../hooks/useRegistrationFlow';
import { getRegistrationPreview, type RegistrationPreviewName } from '../../lib/authPreview';
import { useRegistrationBackHandler } from '../../hooks/useRegistrationBackHandler';
import { registerColors, registerStyles as styles } from '../../styles/screens/register.styles';
import { colors, fonts, spacing } from '../../styles/theme';
import Stepper from '../../components/register/Stepper';
import PhoneStep from '../../components/register/PhoneStep';
import OTPStep from '../../components/register/OTPStep';
import DetailsStep from '../../components/register/DetailsStep';
import PINStep from '../../components/register/PINStep';

const REGISTRATION_LOGO_SOURCE = require('../../assets/images/splash_iconDL-transparent.png');

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ preview?: RegistrationPreviewName }>();
  const preview = typeof params.preview === 'string' ? params.preview as RegistrationPreviewName : undefined;

  return <RegisterFlowScreen key={preview ?? 'live'} preview={preview} />;
}

function RegisterFlowScreen({ preview }: { preview?: RegistrationPreviewName }) {
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [timelineDirection, setTimelineDirection] = useState<'forward' | 'backward'>('forward');

  const flow = useRegistrationFlow(getRegistrationPreview(preview));
  const {
    step,
    isComplete,
    phoneDigits,
    phoneError,
    phoneValidation,
    displayNumber,
    otp,
    otpError,
    details,
    pin,
    confirmPin,
    resendCooldown,
    otpSendCount,
    otpLimitReached,
    hasPendingOtp,
    canRequestOtp,
    sendingOTP,
    verifyingOTP,
    submittingRegistration,
    setOtp,
    setPin,
    setConfirmPin,
    updateDetails,
    handlePhoneInput,
    handleGetOTP,
    continueToOtpVerification,
    verifyOTP,
    handleResend,
    goToDetailsNext,
    goBack,
    completeRegistration,
  } = flow;

  const handleStepBack = useCallback(() => {
    setTimelineDirection('backward');
    return goBack();
  }, [goBack]);

  function runForwardStep(action: () => void | Promise<void>) {
    setTimelineDirection('forward');
    return action();
  }

  // Android hardware back uses the same logic as the on-screen back button.
  useRegistrationBackHandler(handleStepBack, !isComplete);

  const isDetailsStep = step === 2;
  const isPinStep = step === 3;
  const header = (
    <>
      <View style={localStyles.brandHeader}>
        <Image source={REGISTRATION_LOGO_SOURCE} style={localStyles.brandLogo} resizeMode="contain" />
        <View style={localStyles.wordmark}>
          <Text style={localStyles.disasterText}>DISASTER</Text>
          <Text style={localStyles.linkText}>
            L<Text style={localStyles.linkI}>i</Text>NK
          </Text>
        </View>
      </View>
      <Stepper
        current={step}
        direction={timelineDirection}
        hasPhoneInput={phoneDigits.length > 0}
      />
    </>
  );

  const stepContent = (
    <View style={styles.card}>
      {step === 0 && (
        <PhoneStep
          phoneDigits={phoneDigits}
          onChangePhone={handlePhoneInput}
          phoneFocused={phoneFocused}
          onFocus={() => setPhoneFocused(true)}
          onBlur={() => setPhoneFocused(false)}
          onSubmit={() => runForwardStep(handleGetOTP)}
          onContinueVerification={() => runForwardStep(continueToOtpVerification)}
          isValid={phoneValidation.valid}
          sendingOTP={sendingOTP}
          resendCooldown={resendCooldown}
          canRequestOtp={canRequestOtp}
          hasPendingOtp={hasPendingOtp}
          otpLimitReached={otpLimitReached}
          otpSendCount={otpSendCount}
          phoneError={phoneError}
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
          onVerify={() => runForwardStep(verifyOTP)}
        />
      )}
      {step === 2 && (
        <DetailsStep
          details={details}
          onUpdateDetails={updateDetails}
          onSubmit={() => runForwardStep(goToDetailsNext)}
        />
      )}
      {step === 3 && (
        <PINStep
          phoneNumber={displayNumber}
          pin={pin}
          confirmPin={confirmPin}
          onChangePin={setPin}
          onChangeConfirmPin={setConfirmPin}
          onSubmit={completeRegistration}
          submitting={submittingRegistration}
        />
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <TouchableOpacity
          style={localStyles.backButton}
          onPress={handleStepBack}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={registerColors.text} />
        </TouchableOpacity>

        {isDetailsStep ? (
          <>
            <View style={localStyles.registrationHeader}>{header}</View>
            <ScrollView
              style={localStyles.stepScrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="always"
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
            >
              {stepContent}
            </ScrollView>
          </>
        ) : isPinStep ? (
          <ScrollView
            style={localStyles.stepScrollView}
            contentContainerStyle={localStyles.centeredStepContent}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
          >
            <View style={localStyles.centeredRegistrationFlow}>
              <View style={localStyles.registrationHeader}>{header}</View>
              {stepContent}
            </View>
          </ScrollView>
        ) : (
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              style={localStyles.stepScrollView}
              contentContainerStyle={localStyles.centeredStepContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
              scrollEnabled={false}
            >
              <View style={localStyles.centeredRegistrationFlow}>
                <View style={localStyles.registrationHeader}>{header}</View>
                {stepContent}
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  // Mirrors the official-login back control for consistent entry-screen navigation.
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
  registrationHeader: {
    flexShrink: 0,
    // Reserve the top row for the back button before the brand and timeline begin.
    paddingTop: 48,
  },
  stepScrollView: {
    flex: 1,
  },
  centeredStepContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: spacing.md,
  },
  centeredRegistrationFlow: {
    width: '100%',
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  brandLogo: {
    width: 42,
    height: 42,
    marginRight: 8,
  },
  wordmark: {
    flexDirection: 'row',
  },
  disasterText: {
    color: colors.navigationActive,
    fontFamily: fonts.extrabold,
    fontSize: 22,
    letterSpacing: -0.8,
  },
  linkText: {
    color: '#009EF9',
    fontFamily: fonts.extrabold,
    fontSize: 22,
    letterSpacing: -0.8,
  },
  linkI: {
    color: '#D71945',
    fontFamily: fonts.extrabold,
  },
});
