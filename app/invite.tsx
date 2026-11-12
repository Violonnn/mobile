import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  type TextInputInstance,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { usePreventRemove, useRouter, type Href } from 'expo-router';
import { OFFICIAL_REGISTER_STEP_LABELS, useOfficialRegistrationFlow } from '../hooks/useOfficialRegistrationFlow';
import { useRegistrationBackHandler } from '../hooks/useRegistrationBackHandler';
import Stepper from '../components/register/Stepper';
import LabeledInput from '../components/register/LabeledInput';
import FieldError from '../components/register/FieldError';
import OTPInput from '../components/register/OTPInput';
import { SkeletonBlock, SkeletonGroup } from '../components/ui/Skeleton';
import { hideNativeSplashOnce } from '../lib/nativeSplash';
import { colors } from '../styles/theme';
import { inviteStyles as styles } from '../styles/screens/invite.styles';

export default function InviteScreen() {
  const router = useRouter();
  const flow = useOfficialRegistrationFlow();
  const { flowVersion, submitPassword } = flow;
  const { width: windowWidth } = useWindowDimensions();
  const firstNameRef = useRef<TextInputInstance>(null);
  const middleNameRef = useRef<TextInputInstance>(null);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const [exitDestination, setExitDestination] = useState<Href | null>(null);
  const [completedFlowVersion, setCompletedFlowVersion] = useState<number | null>(null);
  const accountCreated = completedFlowVersion === flowVersion;
  const [otpContentWidth, setOtpContentWidth] = useState(
    Math.max(0, Math.min(windowWidth, 640) - 80),
  );

  const confirmLeaveRegistration = useCallback(() => {
    Keyboard.dismiss();
    Alert.alert(
      'Leave registration?',
      'Your progress will be cleared. You can return with the invite link.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => setExitDestination('/(auth)/official-login' as Href),
        },
      ],
    );
  }, []);

  const handleBack = useCallback(() => {
    if (flow.submitting || flow.verifyingOtp || flow.sendingOtp) return true;
    if (accountCreated) {
      setExitDestination('/(auth)/official-login' as Href);
      return true;
    }
    if (flow.goBack()) return true;
    confirmLeaveRegistration();
    return true;
  }, [accountCreated, confirmLeaveRegistration, flow]);

  const handleCreateAccount = useCallback(async () => {
    const created = await submitPassword();
    if (created) setCompletedFlowVersion(flowVersion);
  }, [flowVersion, submitPassword]);

  useEffect(() => {
    void hideNativeSplashOnce();
  }, []);

  useRegistrationBackHandler(handleBack, true);

  usePreventRemove(exitDestination === null, handleBack);

  useEffect(() => {
    if (exitDestination) router.replace(exitDestination);
  }, [exitDestination, router]);

  const keyboardBehavior = Platform.OS === 'ios' ? 'padding' : 'height';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={keyboardBehavior}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            disabled={flow.submitting || flow.verifyingOtp || flow.sendingOtp}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={accountCreated ? 'Sign in' : 'Go back'}
            accessibilityState={{
              disabled: flow.submitting || flow.verifyingOtp || flow.sendingOtp,
            }}
            hitSlop={4}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Official registration</Text>
          <View style={styles.headerSpacer} />
        </View>

        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          >
            {accountCreated ? (
              <View style={styles.card}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-outline" size={26} color={colors.success} />
                </View>
                <Text style={styles.title}>Account created</Text>
                <Text style={styles.body}>
                  Sign in with your invited email and the password you created.
                </Text>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => setExitDestination('/(auth)/official-login' as Href)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryButtonText}>Sign in</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.white} />
                </TouchableOpacity>
              </View>
            ) : flow.entryVisible ? (
              <View style={styles.card}>
                <View style={styles.iconBadge}>
                  <Ionicons name="mail-outline" size={24} color={colors.navigationActive} />
                </View>
                <Text style={styles.title}>Use invitation</Text>
                <Text style={styles.body}>An admin must invite you before you can register.</Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Invite link or token</Text>
                  <TextInput
                    value={flow.entryValue}
                    onChangeText={flow.handleEntryValueChange}
                    placeholder="Paste your invite link or token"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.textInput, flow.entryError ? styles.textInputError : null]}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    returnKeyType="go"
                    onSubmitEditing={flow.acceptInviteInput}
                    accessibilityLabel="Invite link or token"
                    accessibilityHint="Paste the invitation an administrator sent you."
                    testID="official-invite-entry"
                  />
                  {!!flow.entryError && <FieldError message={flow.entryError} />}
                </View>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    !flow.entryValue.trim() && styles.primaryButtonDisabled,
                  ]}
                  onPress={flow.acceptInviteInput}
                  disabled={!flow.entryValue.trim()}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryButtonText}>Continue</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.white} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.registrationContent}>
                <Text style={styles.title}>Complete your invite</Text>
                <Stepper current={flow.step} labels={OFFICIAL_REGISTER_STEP_LABELS} />

                {flow.validatingToken ? (
                  <View style={styles.card} accessibilityLabel="Validating invitation">
                    <SkeletonGroup style={styles.validationSkeleton}>
                      <SkeletonBlock style={styles.skeletonTitle} />
                      <SkeletonBlock style={styles.skeletonLine} />
                      <SkeletonBlock style={styles.skeletonLineShort} />
                      <SkeletonBlock style={styles.skeletonButton} />
                    </SkeletonGroup>
                  </View>
                ) : flow.step === 0 ? (
                  <View style={styles.card}>
                    <Text style={styles.stepTitle}>Invite</Text>
                    {flow.inviteUnavailable || flow.tokenError || flow.tokenErrorKind ? (
                      <>
                        <View style={styles.errorNotice}>
                          <Ionicons
                            name="alert-circle-outline"
                            size={20}
                            color={colors.unverified}
                          />
                          <Text style={styles.errorNoticeText}>{flow.tokenError}</Text>
                        </View>
                        {flow.tokenErrorKind === 'retry' && (
                          <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={flow.retryValidation}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                          >
                            <Text style={styles.secondaryButtonText}>Retry</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.secondaryButton}
                          onPress={() => flow.resetToEntry()}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                        >
                          <Text style={styles.secondaryButtonText}>Use another invite</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <View style={styles.scopeCard}>
                          <Text style={styles.scopeLabel}>Invited role and scope</Text>
                          <Text style={styles.scopeValue}>{flow.scopeLabel}</Text>
                          <View style={styles.identityLine}>
                            <Ionicons name="mail-outline" size={17} color={colors.textMuted} />
                            <Text style={styles.identityValue}>{flow.maskedEmail}</Text>
                          </View>
                          <View style={styles.identityLine}>
                            <Ionicons name="call-outline" size={17} color={colors.textMuted} />
                            <Text style={styles.identityValue}>{flow.maskedPhone}</Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.primaryButton}
                          onPress={() => void flow.goToVerifyStep()}
                          disabled={!flow.canProceedFromInvite || flow.sendingOtp}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                        >
                          {flow.sendingOtp ? (
                            <ActivityIndicator color={colors.white} />
                          ) : (
                            <>
                              <Text style={styles.primaryButtonText}>
                                {flow.phoneVerified ? 'Continue' : 'Send code'}
                              </Text>
                              <Ionicons name="chevron-forward" size={20} color={colors.white} />
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.textButton}
                          onPress={() => flow.resetToEntry()}
                          activeOpacity={0.75}
                          accessibilityRole="button"
                        >
                          <Text style={styles.textButtonLabel}>Change invite</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                ) : flow.step === 1 ? (
                  <View style={styles.card}>
                    <Text style={styles.stepTitle}>Verify mobile</Text>
                    <Text style={styles.body}>
                      Enter the six-digit code sent to {flow.maskedPhone}.
                    </Text>
                    <View
                      style={styles.fieldGroup}
                      onLayout={(event) => {
                        const measuredWidth = event.nativeEvent.layout.width;
                        setOtpContentWidth((currentWidth) =>
                          currentWidth === measuredWidth ? currentWidth : measuredWidth,
                        );
                      }}
                    >
                      <Text style={styles.fieldLabel}>Verification code</Text>
                      <OTPInput
                        value={flow.otp}
                        onChange={flow.handleOtpChange}
                        hasError={!!flow.otpError}
                        availableWidth={otpContentWidth || undefined}
                      />
                      {!!flow.otpError && <FieldError message={flow.otpError} />}
                    </View>

                    {flow.phoneVerified ? (
                      <Text style={styles.successMessage}>Mobile number verified.</Text>
                    ) : flow.otpLimitReached ? (
                      <Text style={styles.helperText}>
                        The send limit has been reached. Try again after the limit resets.
                      </Text>
                    ) : flow.resendCooldown > 0 ? (
                      <Text style={styles.helperText}>
                        You can request another code in {flow.resendCooldown}s.
                      </Text>
                    ) : (
                      <TouchableOpacity
                        style={styles.textButton}
                        onPress={() => void flow.resendOtp()}
                        disabled={flow.sendingOtp}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                      >
                        <Text style={styles.textButtonLabel}>
                          {flow.sendingOtp ? 'Sending code…' : 'Resend code'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        (flow.verifyingOtp || flow.sendingOtp) && styles.primaryButtonDisabled,
                      ]}
                      onPress={() => void flow.submitOtp()}
                      disabled={flow.verifyingOtp || flow.sendingOtp}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                    >
                      {flow.verifyingOtp ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <>
                          <Text style={styles.primaryButtonText}>
                            {flow.phoneVerified ? 'Continue to details' : 'Verify code'}
                          </Text>
                          <Ionicons name="chevron-forward" size={20} color={colors.white} />
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : flow.step === 2 ? (
                  <View style={styles.card}>
                    <Text style={styles.stepTitle}>Account details</Text>
                    <View style={styles.identitySummary}>
                      <Text style={styles.identityValue}>{flow.maskedEmail}</Text>
                      <Text style={styles.identityValue}>{flow.maskedPhone}</Text>
                      <Text style={styles.scopeValue}>{flow.scopeLabel}</Text>
                    </View>
                    <LabeledInput
                      label="Last name"
                      required
                      leadingIcon="person-outline"
                      value={flow.lastName}
                      onChangeText={flow.handleLastNameChange}
                      placeholder="Dela Cruz"
                      autoCapitalize="words"
                      editable={!flow.submitting}
                      error={flow.lastNameError}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => firstNameRef.current?.focus()}
                      style={styles.sharedInputText}
                    />
                    <LabeledInput
                      ref={firstNameRef}
                      label="First name"
                      required
                      leadingIcon="person-outline"
                      value={flow.firstName}
                      onChangeText={flow.handleFirstNameChange}
                      placeholder="Juan"
                      autoCapitalize="words"
                      editable={!flow.submitting}
                      error={flow.firstNameError}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => middleNameRef.current?.focus()}
                      style={styles.sharedInputText}
                    />
                    <LabeledInput
                      ref={middleNameRef}
                      label="Middle name"
                      leadingIcon="person-outline"
                      value={flow.middleName}
                      onChangeText={flow.handleMiddleNameChange}
                      placeholder="Optional"
                      autoCapitalize="words"
                      editable={!flow.submitting}
                      error={flow.middleNameError}
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                      style={styles.sharedInputText}
                    />
                    {!!flow.formError && <FieldError message={flow.formError} />}
                    <TouchableOpacity
                      style={styles.primaryButton}
                      onPress={flow.submitDetails}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                    >
                      <Text style={styles.primaryButtonText}>Continue</Text>
                      <Ionicons name="chevron-forward" size={20} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.card}>
                    <Text style={styles.stepTitle}>Create password</Text>
                    <Text style={styles.body}>
                      Use at least {flow.passwordMinLength} characters.
                    </Text>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Password</Text>
                      <View
                        style={[
                          styles.passwordRow,
                          passwordFocused && styles.passwordRowFocused,
                          flow.passwordError && styles.textInputError,
                        ]}
                      >
                        <TextInput
                          style={styles.passwordInput}
                          value={flow.password}
                          onChangeText={flow.handlePasswordChange}
                          placeholder="At least 12 characters"
                          placeholderTextColor={colors.textMuted}
                          secureTextEntry={!flow.showPassword}
                          textContentType="newPassword"
                          autoComplete="new-password"
                          editable={!flow.submitting}
                          onFocus={() => setPasswordFocused(true)}
                          onBlur={() => setPasswordFocused(false)}
                          accessibilityLabel="Password"
                        />
                        <TouchableOpacity
                          style={styles.visibilityButton}
                          onPress={flow.toggleShowPassword}
                          activeOpacity={0.75}
                          accessibilityRole="button"
                          accessibilityLabel={flow.showPassword ? 'Hide password' : 'Show password'}
                        >
                          <Ionicons
                            name={flow.showPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={20}
                            color={colors.textMuted}
                          />
                        </TouchableOpacity>
                      </View>
                      {!!flow.passwordError && <FieldError message={flow.passwordError} />}
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Confirm password</Text>
                      <View
                        style={[
                          styles.passwordRow,
                          confirmFocused && styles.passwordRowFocused,
                          flow.confirmPasswordError && styles.textInputError,
                        ]}
                      >
                        <TextInput
                          style={styles.passwordInput}
                          value={flow.confirmPassword}
                          onChangeText={flow.handleConfirmPasswordChange}
                          placeholder="Re-enter password"
                          placeholderTextColor={colors.textMuted}
                          secureTextEntry={!flow.showConfirmPassword}
                          textContentType="newPassword"
                          autoComplete="new-password"
                          editable={!flow.submitting}
                          onFocus={() => setConfirmFocused(true)}
                          onBlur={() => setConfirmFocused(false)}
                          accessibilityLabel="Confirm password"
                        />
                        <TouchableOpacity
                          style={styles.visibilityButton}
                          onPress={flow.toggleShowConfirmPassword}
                          activeOpacity={0.75}
                          accessibilityRole="button"
                          accessibilityLabel={
                            flow.showConfirmPassword ? 'Hide password' : 'Show password'
                          }
                        >
                          <Ionicons
                            name={flow.showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={20}
                            color={colors.textMuted}
                          />
                        </TouchableOpacity>
                      </View>
                      {!!flow.confirmPasswordError && (
                        <FieldError message={flow.confirmPasswordError} />
                      )}
                    </View>

                    {!!flow.formError && <FieldError message={flow.formError} />}
                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        flow.submitting && styles.primaryButtonDisabled,
                      ]}
                      onPress={() => void handleCreateAccount()}
                      disabled={flow.submitting}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                    >
                      {flow.submitting ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <>
                          <Text style={styles.primaryButtonText}>Create account</Text>
                          <Ionicons name="chevron-forward" size={20} color={colors.white} />
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
