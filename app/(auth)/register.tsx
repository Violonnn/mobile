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
import { responsiveImageHeight } from '../../lib/layout';
import { useRegistrationFlow } from '../../hooks/useRegistrationFlow';
import { useRegistrationBackHandler } from '../../hooks/useRegistrationBackHandler';
import { RegistrationStep } from '../../types/registration';
import { registerStyles as styles } from '../../styles/screens/register.styles';
import Stepper from '../../components/register/Stepper';
import PhoneStep from '../../components/register/PhoneStep';
import OTPStep from '../../components/register/OTPStep';
import DetailsStep from '../../components/register/DetailsStep';
import PINStep from '../../components/register/PINStep';

const STEP_IMAGES: Record<RegistrationStep, number> = {
  0: require('../../assets/images/inputPhone.png'),
  1: require('../../assets/images/inputVerify.png'),
  2: require('../../assets/images/inputDetails.png'),
  3: require('../../assets/images/inputPIN.png'),
};

export default function RegisterScreen() {
  const [phoneFocused, setPhoneFocused] = useState(false);

  const flow = useRegistrationFlow();
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

  // Android hardware back uses the same logic as the on-screen back button.
  useRegistrationBackHandler(goBack, !isComplete);

  const isDetailsStep = step === 2;
  const isPinStep = step === 3;
  const imageHeight = responsiveImageHeight(isDetailsStep ? 0.2 : 0.22);

  const header = (
    <>
      <Text style={styles.screenTitle}>Registration</Text>
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        <Image
          source={STEP_IMAGES[step]}
          style={styles.imagePlaceholder}
          resizeMode="contain"
        />
      </View>
      <Stepper current={step} />
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
        <DetailsStep
          details={details}
          onUpdateDetails={updateDetails}
          onSubmit={goToDetailsNext}
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

        {isDetailsStep || isPinStep ? (
          <ScrollView
            contentContainerStyle={isDetailsStep ? styles.scrollContent : styles.fixedScrollContent}
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
