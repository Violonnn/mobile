import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { responsiveImageHeight } from '../../lib/layout';
import { useForgotPasswordFlow, ForgotStep } from '../../hooks/useForgotPasswordFlow';
import { useRegistrationBackHandler } from '../../hooks/useRegistrationBackHandler';
import { registerStyles as styles } from '../../styles/screens/register.styles';
import PhoneStep from '../../components/register/PhoneStep';
import OTPStep from '../../components/register/OTPStep';
import PINStep from '../../components/register/PINStep';

const STEP_IMAGES: Record<ForgotStep, number> = {
  0: require('../../assets/images/inputPhone.png'),
  1: require('../../assets/images/inputVerify.png'),
  2: require('../../assets/images/inputPIN.png'),
};

export default function ForgotPasswordScreen() {
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
    initialPhone: typeof params.phone === 'string' ? params.phone : undefined,
  });

  useRegistrationBackHandler(goBack, true);

  const isPinStep = step === 2;
  const imageHeight = responsiveImageHeight(0.22);

  const header = (
    <>
      <Text style={styles.screenTitle}>{openedFromSettings ? 'Change PIN' : 'Forgot PIN'}</Text>
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        <Image
          source={STEP_IMAGES[step]}
          style={styles.imagePlaceholder}
          resizeMode="contain"
        />
      </View>
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
      {header}
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
        <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.8}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>

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
              contentContainerStyle={styles.fixedScrollContent}
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
