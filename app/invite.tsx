import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  StyleSheet,
  Image,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useNavigation, useRouter, type Href } from 'expo-router';
import {
  OFFICIAL_REGISTER_STEP_LABELS,
  useOfficialRegistrationFlow,
} from '../hooks/useOfficialRegistrationFlow';
import { useRegistrationBackHandler } from '../hooks/useRegistrationBackHandler';
import { registerStyles as styles, registerColors } from '../styles/screens/register.styles';
import { inviteStyles } from '../styles/screens/invite.styles';
import Stepper from '../components/register/Stepper';
import LabeledInput from '../components/register/LabeledInput';
import FieldError from '../components/register/FieldError';
import OTPInput from '../components/register/OTPInput';
import { colors } from '../styles/theme';

/**
 * Seal must be large enough to read ring text, but never taller than ~30%
 * of the screen so the form below stays usable.
 */
function responsiveSealSize(screenWidth: number, screenHeight: number): number {
  const shortPhone = screenHeight < 700;
  const byWidth = Math.round(screenWidth * (shortPhone ? 0.36 : 0.42));
  const byHeight = Math.round(screenHeight * (shortPhone ? 0.12 : 0.15));
  const min = shortPhone ? 96 : 112;
  const max = shortPhone ? 132 : 148;
  return Math.max(min, Math.min(max, byWidth, byHeight));
}

/**
 * Invite-only official registration (SMS-verified).
 * Entered only from an invite URL — never from official sign-in.
 */
export default function InviteScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const sealSize = responsiveSealSize(screenWidth, screenHeight);

  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  const firstNameRef = useRef<TextInput>(null);
  const middleNameRef = useRef<TextInput>(null);
  const allowLeaveRef = useRef(false);

  const flow = useOfficialRegistrationFlow();

  const confirmLeaveRegistration = useCallback(() => {
    Alert.alert(
      'Leave registration?',
      'Are you sure you want to exit official registration?',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            allowLeaveRef.current = true;
            router.replace('/(auth)/login' as Href);
          },
        },
      ],
    );
  }, [router]);

  const handleCreateAccount = useCallback(async () => {
    const created = await flow.submitPassword();
    if (!created) return;

    // beforeRemove otherwise intercepts replace and steps back to Details.
    allowLeaveRef.current = true;
    Alert.alert(
      'Account created',
      'Sign in with your government email and password to continue.',
      [
        {
          text: 'Sign in',
          onPress: () => {
            router.replace('/(auth)/official-login' as Href);
          },
        },
      ],
      { cancelable: false },
    );
  }, [flow, router]);

  const handleBack = useCallback(() => {
    if (flow.goBack()) return true;
    confirmLeaveRegistration();
    return true;
  }, [confirmLeaveRegistration, flow]);

  // Deep-link entry never mounts welcome/index — dismiss splash here too.
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  // Android hardware back → previous step / leave confirm.
  useRegistrationBackHandler(handleBack, true);

  // iOS swipe / stack pop → same wizard back behavior (don't exit mid-flow).
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveRef.current) return;

      event.preventDefault();

      if (flow.goBack()) return;
      confirmLeaveRegistration();
    });

    return unsubscribe;
  }, [confirmLeaveRegistration, flow.goBack, navigation]);

  if (flow.validatingToken && flow.step === 0) {
    return (
      <SafeAreaView style={inviteStyles.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={inviteStyles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={inviteStyles.subtitle}>Validating invite…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const continueLabel =
    flow.autoContinueSeconds != null && flow.autoContinueSeconds > 0
      ? `Continue (${flow.autoContinueSeconds}s)`
      : 'Continue';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'android' ? 'height' : undefined}
        enabled={Platform.OS === 'android'}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.8}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>

        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={localStyles.scrollContent}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            bounces={false}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          >
            <View style={styles.centeredBlock}>
              <View style={[localStyles.sealWrap, { height: sealSize }]}>
                <Image
                  source={require('../assets/images/mingla.png')}
                  style={{ width: sealSize, height: sealSize }}
                  resizeMode="contain"
                  accessibilityLabel="Municipality of Minglanilla official seal"
                />
              </View>

              <Text style={[styles.screenTitle, localStyles.titleAfterSeal]}>
                Official Registration
              </Text>
              <Text style={localStyles.subtitle}>
                Complete your invite to create an official account
              </Text>

              <Stepper current={flow.step} labels={OFFICIAL_REGISTER_STEP_LABELS} />

              <View style={styles.card}>
                {flow.step === 0 && (
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Invite</Text>
                    <Text style={styles.otpTargetText}>
                      Welcome to DisasterLink!
                    </Text>

                    {flow.inviteUnavailable ? (
                      <View style={localStyles.unavailableBox}>
                        <Ionicons
                          name="alert-circle-outline"
                          size={28}
                          color={registerColors.error}
                        />
                        <FieldError message={flow.tokenError} centered />
                      </View>
                    ) : (
                      <View style={localStyles.infoStack}>
                        <View style={localStyles.infoCard}>
                          <Text style={localStyles.infoLabel}>Invite ID</Text>
                          <Text style={localStyles.infoValue} selectable={false}>
                            {flow.maskedToken || '—'}
                          </Text>
                        </View>

                        {!!flow.validatedInvite && (
                          <>
                            <View style={localStyles.infoCard}>
                              <Text style={localStyles.infoLabel}>Locked scope</Text>
                              <Text style={localStyles.infoValue}>{flow.scopeLabel}</Text>
                            </View>
                            <View style={localStyles.infoCard}>
                              <Text style={localStyles.infoLabel}>Mobile number</Text>
                              <Text style={localStyles.infoValue}>{flow.maskedPhone}</Text>
                            </View>
                          </>
                        )}
                      </View>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        !flow.canProceedFromInvite && styles.primaryButtonDisabled,
                      ]}
                      onPress={() => {
                        void flow.goToVerifyStep();
                      }}
                      disabled={!flow.canProceedFromInvite}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.primaryButtonText}>{continueLabel}</Text>
                      <Ionicons name="arrow-forward" size={18} color={registerColors.white} />
                    </TouchableOpacity>
                  </View>
                )}

                {flow.step === 1 && (
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Verify mobile</Text>
                    <Text style={styles.otpTargetText}>
                      Enter the 6-digit code sent to{' '}
                      <Text style={styles.otpTargetNumber}>{flow.maskedPhone}</Text>
                    </Text>

                    <View style={styles.loginFieldWrap}>
                      <Text style={styles.loginFieldLabel}>6-digit code</Text>
                      <OTPInput
                        value={flow.otp}
                        onChange={flow.handleOtpChange}
                        hasError={!!flow.otpError}
                      />
                      <FieldError message={flow.otpError} centered />
                    </View>

                    <View style={styles.resendRow}>
                      <Text style={styles.resendLabel}>Didn&apos;t receive the code? </Text>
                      {flow.resendCooldown > 0 ? (
                        <Text style={styles.resendTimer}>
                          Resend in {flow.resendCooldown}s
                        </Text>
                      ) : flow.otpLimitReached ? (
                        <Text style={styles.resendTimer}>Try again in an hour</Text>
                      ) : (
                        <TouchableOpacity
                          onPress={flow.resendOtp}
                          disabled={flow.sendingOtp}
                        >
                          <Text
                            style={[
                              styles.resendButton,
                              flow.sendingOtp && styles.resendButtonDisabled,
                            ]}
                          >
                            {flow.sendingOtp ? 'SENDING…' : 'RESEND CODE'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        (flow.verifyingOtp || flow.sendingOtp) &&
                          styles.primaryButtonDisabled,
                      ]}
                      onPress={flow.submitOtp}
                      disabled={flow.verifyingOtp || flow.sendingOtp}
                      activeOpacity={0.85}
                    >
                      {flow.verifyingOtp ? (
                        <ActivityIndicator color={registerColors.white} />
                      ) : (
                        <Text style={styles.primaryButtonText}>Verify code</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {flow.step === 2 && (
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Account details</Text>
                    <Text style={styles.otpTargetText}>
                      Email and phone are locked to this invite.
                    </Text>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.label}>Email</Text>
                      <View
                        style={styles.inputWithIconRow}
                        pointerEvents="none"
                        accessibilityRole="text"
                        accessibilityState={{ disabled: true }}
                      >
                        <View style={styles.fieldLeadingIconBox}>
                          <Ionicons
                            name="mail-outline"
                            size={18}
                            color={registerColors.textLight}
                          />
                        </View>
                        <Text
                          style={[styles.inputWithIconField, localStyles.readOnlyValue]}
                          selectable={false}
                        >
                          {flow.maskedEmail}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.label}>Verified mobile</Text>
                      <View
                        style={styles.inputWithIconRow}
                        pointerEvents="none"
                        accessibilityRole="text"
                        accessibilityState={{ disabled: true }}
                      >
                        <View style={styles.fieldLeadingIconBox}>
                          <Ionicons
                            name="call-outline"
                            size={18}
                            color={registerColors.textLight}
                          />
                        </View>
                        <Text
                          style={[styles.inputWithIconField, localStyles.readOnlyValue]}
                          selectable={false}
                        >
                          {flow.maskedPhone}
                        </Text>
                      </View>
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
                      onSubmitEditing={() => Keyboard.dismiss()}
                    />

                    {!!flow.formError && <FieldError message={flow.formError} />}

                    <TouchableOpacity
                      style={styles.primaryButton}
                      onPress={flow.submitDetails}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.primaryButtonText}>Continue</Text>
                      <Ionicons name="arrow-forward" size={18} color={registerColors.white} />
                    </TouchableOpacity>
                  </View>
                )}

                {flow.step === 3 && (
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Create password</Text>
                    <Text style={styles.otpTargetText}>
                      Last step... you&apos;re almost there!
                    </Text>

                    <View style={styles.loginFieldWrap}>
                      <Text style={styles.loginFieldLabel}>Password</Text>
                      <View
                        style={[
                          styles.phoneRow,
                          localStyles.inputRow,
                          passwordFocused && styles.phoneRowFocused,
                          !!flow.passwordError && styles.inputError,
                        ]}
                      >
                        <View style={styles.pinIconBox}>
                          <Ionicons
                            name="lock-closed-outline"
                            size={18}
                            color={registerColors.textLight}
                          />
                        </View>
                        <TextInput
                          style={[
                            styles.phoneInput,
                            localStyles.fieldInput,
                            localStyles.passwordInput,
                          ]}
                          value={flow.password}
                          onChangeText={flow.handlePasswordChange}
                          placeholder={`At least ${flow.passwordMinLength} characters`}
                          placeholderTextColor={registerColors.grayMuted}
                          secureTextEntry={!flow.showPassword}
                          textContentType="newPassword"
                          autoComplete="new-password"
                          editable={!flow.submitting}
                          onFocus={() => setPasswordFocused(true)}
                          onBlur={() => setPasswordFocused(false)}
                        />
                        <TouchableOpacity
                          style={localStyles.eyeButton}
                          onPress={flow.toggleShowPassword}
                          activeOpacity={0.7}
                          accessibilityLabel={
                            flow.showPassword ? 'Hide password' : 'Show password'
                          }
                        >
                          <Ionicons
                            name={flow.showPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={18}
                            color={registerColors.textLight}
                          />
                        </TouchableOpacity>
                      </View>
                      {!!flow.passwordError && <FieldError message={flow.passwordError} />}
                    </View>

                    <View style={styles.loginFieldWrap}>
                      <Text style={styles.loginFieldLabel}>Confirm password</Text>
                      <View
                        style={[
                          styles.phoneRow,
                          localStyles.inputRow,
                          confirmFocused && styles.phoneRowFocused,
                          !!flow.confirmPasswordError && styles.inputError,
                        ]}
                      >
                        <View style={styles.pinIconBox}>
                          <Ionicons
                            name="lock-closed-outline"
                            size={18}
                            color={registerColors.textLight}
                          />
                        </View>
                        <TextInput
                          style={[
                            styles.phoneInput,
                            localStyles.fieldInput,
                            localStyles.passwordInput,
                          ]}
                          value={flow.confirmPassword}
                          onChangeText={flow.handleConfirmPasswordChange}
                          placeholder="Re-enter password"
                          placeholderTextColor={registerColors.grayMuted}
                          secureTextEntry={!flow.showConfirmPassword}
                          textContentType="newPassword"
                          autoComplete="new-password"
                          editable={!flow.submitting}
                          onFocus={() => setConfirmFocused(true)}
                          onBlur={() => setConfirmFocused(false)}
                        />
                        <TouchableOpacity
                          style={localStyles.eyeButton}
                          onPress={flow.toggleShowConfirmPassword}
                          activeOpacity={0.7}
                          accessibilityLabel={
                            flow.showConfirmPassword
                              ? 'Hide password'
                              : 'Show password'
                          }
                        >
                          <Ionicons
                            name={
                              flow.showConfirmPassword
                                ? 'eye-off-outline'
                                : 'eye-outline'
                            }
                            size={18}
                            color={registerColors.textLight}
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
                      onPress={handleCreateAccount}
                      disabled={flow.submitting}
                      activeOpacity={0.85}
                    >
                      {flow.submitting ? (
                        <ActivityIndicator color={registerColors.white} />
                      ) : (
                        <>
                          <Text style={styles.primaryButtonText}>Create account</Text>
                          <Ionicons
                            name="arrow-forward"
                            size={18}
                            color={registerColors.white}
                          />
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 48,
    paddingBottom: 24,
  },
  sealWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 4,
  },
  titleAfterSeal: {
    marginTop: 4,
  },
  subtitle: {
    textAlign: 'center',
    color: registerColors.textLight,
    fontSize: 13,
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  inputRow: {
    minHeight: 56,
    paddingVertical: 10,
  },
  fieldInput: {
    fontSize: 16,
    flex: 1,
  },
  passwordInput: {
    paddingRight: 8,
  },
  eyeButton: {
    paddingLeft: 4,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  readOnlyValue: {
    color: registerColors.textLight,
  },
  infoStack: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    width: '100%',
  },
  infoCard: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    shadowColor: '#0F2044',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: registerColors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  infoValue: {
    fontSize: 17,
    fontWeight: '700',
    color: registerColors.primary,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  unavailableBox: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    marginBottom: 8,
    width: '100%',
    paddingHorizontal: 12,
  },
});
