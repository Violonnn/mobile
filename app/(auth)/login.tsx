import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import FieldError from '../../components/register/FieldError';
import NumericKeyboardAccessory, { NUMERIC_ACCESSORY_ID } from '../../components/ui/NumericKeyboardAccessory';
import { useLoginFlow } from '../../hooks/useLoginFlow';
import { loginColors, loginStyles as styles } from '../../styles/screens/login.styles';

const PIN_LENGTH = 6;
const PLACEHOLDER_DOTS = '······';

export default function LoginScreen() {
  const phoneRef = useRef<TextInput>(null);
  const pinRef = useRef<TextInput>(null);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [pinFocused, setPinFocused] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);
  const [swapPressed, setSwapPressed] = useState(false);
  const [signUpLoading, setSignUpLoading] = useState(false);

  const {
    phoneDigits,
    phoneError,
    pin,
    pinError,
    submitting,
    phoneLocked,
    hasSavedPhone,
    handlePhoneInput,
    clearPhoneForEdit,
    handlePinChange,
    submitLogin,
    goBack,
    goToForgotPassword,
    goToRegister,
    goToOfficialLogin,
  } = useLoginFlow();

  useFocusEffect(
    useCallback(() => {
      setSignUpLoading(false);
    }, []),
  );

  function handleSwapPhonePress() {
    Alert.alert(
      'Change mobile number?',
      'Do you want to use a different mobile number? Your current number will be cleared.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: () => {
            clearPhoneForEdit();
            requestAnimationFrame(() => phoneRef.current?.focus());
          },
        },
      ],
    );
  }

  function handleSignUp() {
    setSignUpLoading(true);
    goToRegister();
  }

  const pinDisplayText =
    pin.length === 0 ? PLACEHOLDER_DOTS : pinVisible ? pin : '•'.repeat(pin.length);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* ── Hero image with overlay ── */}
            <View style={styles.heroWrapper}>
              <Image
                source={require('../../assets/images/loginHeader.png')}
                style={styles.heroImage}
                resizeMode="cover"
              />
              <View style={styles.heroOverlay}>
                <Text style={styles.heroBrandText}>DisasterLink</Text>
              </View>
            </View>

            {/* ── Back button overlaying the hero ── */}
            <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.8}>
              <Ionicons name="chevron-back" size={18} color={loginColors.white} />
            </TouchableOpacity>

            {/* ── Content section ── */}
            <View style={styles.content}>
              <Text style={styles.sectionLabel}>Resident Login</Text>
              <Text style={styles.headline}>Welcome back.</Text>
              <Text style={styles.subtitle}>Enter your mobile number and PIN.</Text>

              {/* ── Mobile number field ── */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Mobile number</Text>
                <View
                  style={[
                    styles.fieldRow,
                    !phoneLocked && phoneFocused && styles.fieldRowFocused,
                    !!phoneError && styles.fieldRowError,
                  ]}
                >
                  <View style={styles.phonePrefixBox}>
                    <Text style={styles.phonePrefixText}>+63</Text>
                  </View>
                  {phoneLocked ? (
                    <View style={styles.phoneLockedValue}>
                      <Text
                        style={[
                          styles.phoneDisplayText,
                          !phoneDigits && styles.phoneDisplayPlaceholder,
                        ]}
                      >
                        {phoneDigits || '9XX XXX XXXX'}
                      </Text>
                    </View>
                  ) : (
                    <TextInput
                      ref={phoneRef}
                      style={styles.phoneInput}
                      value={phoneDigits}
                      onChangeText={handlePhoneInput}
                      onFocus={() => setPhoneFocused(true)}
                      onBlur={() => setPhoneFocused(false)}
                      keyboardType="number-pad"
                      placeholder="9XX XXX XXXX"
                      placeholderTextColor={loginColors.grayMuted}
                      maxLength={12}
                      returnKeyType="next"
                      inputAccessoryViewID={NUMERIC_ACCESSORY_ID}
                    />
                  )}
                  {hasSavedPhone && phoneLocked && (
                    <Pressable
                      style={[
                        styles.phoneSwapIconBtn,
                        swapPressed && styles.phoneSwapIconBtnPressed,
                      ]}
                      onPress={handleSwapPhonePress}
                      onPressIn={() => setSwapPressed(true)}
                      onPressOut={() => setSwapPressed(false)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityLabel="Change saved mobile number"
                    >
                      <Ionicons
                        name="swap-horizontal"
                        size={18}
                        color={swapPressed ? loginColors.primary : loginColors.textLight}
                      />
                    </Pressable>
                  )}
                </View>
              </View>

              {!!phoneError && <FieldError message={phoneError} />}

              {/* ── PIN field ── */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>6-digit PIN</Text>
                <View
                  style={[
                    styles.fieldRow,
                    pinFocused && styles.fieldRowFocused,
                    !!pinError && styles.fieldRowError,
                  ]}
                >
                  <Pressable
                    style={[styles.pinInputWrapper]}
                    onPress={() => pinRef.current?.focus()}
                  >
                    <Text
                      style={[
                        styles.pinDisplayText,
                        pin.length === 0 && { color: '#9CA3AF' },
                      ]}
                      pointerEvents="none"
                    >
                      {pinDisplayText}
                    </Text>
                    <TextInput
                      ref={pinRef}
                      style={styles.pinHiddenInput}
                      value={pin}
                      onChangeText={handlePinChange}
                      onFocus={() => setPinFocused(true)}
                      onBlur={() => setPinFocused(false)}
                      keyboardType="number-pad"
                      maxLength={PIN_LENGTH}
                      autoCorrect={false}
                      autoComplete="off"
                      textContentType="none"
                      caretHidden
                      inputAccessoryViewID={NUMERIC_ACCESSORY_ID}
                      returnKeyType="done"
                      onSubmitEditing={submitLogin}
                    />
                  </Pressable>
                  <TouchableOpacity
                    onPress={() => setPinVisible((prev) => !prev)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={pinVisible ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {!!pinError && <FieldError message={pinError} />}

              {/* ── Forgot PIN ── */}
              <TouchableOpacity
                style={styles.forgotPinRow}
                onPress={goToForgotPassword}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotPinText}>Forgot PIN?</Text>
              </TouchableOpacity>

              {/* ── Login button ── */}
              <TouchableOpacity
                style={[styles.loginButton, submitting && styles.loginButtonDisabled]}
                onPress={submitLogin}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color={loginColors.white} />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>Log in</Text>
                    <View style={styles.loginButtonArrow}>
                      <Ionicons name="arrow-forward" size={18} color={loginColors.white} />
                    </View>
                  </>
                )}
              </TouchableOpacity>

              {/* ── Sign up row ── */}
              <TouchableOpacity
                style={styles.signUpRow}
                onPress={handleSignUp}
                disabled={signUpLoading}
                activeOpacity={0.7}
              >
                {signUpLoading ? (
                  <ActivityIndicator color={loginColors.primary} />
                ) : (
                  <>
                    <Text style={styles.signUpPrompt}>New here?</Text>
                    <Text style={styles.signUpLink}>Create account</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* ── Official access (preserved from current design) ── */}
              <TouchableOpacity
                style={styles.officialSection}
                onPress={goToOfficialLogin}
                activeOpacity={0.7}
              >
                <View style={styles.officialLoginContent}>
                  <Image
                    source={require('../../assets/images/mingla.png')}
                    style={styles.officialLoginLogo}
                    resizeMode="cover"
                  />
                  <View style={styles.officialLoginTextGroup}>
                    <View style={styles.officialLoginTitleRow}>
                      <Text style={styles.officialLoginTitle}>Official Access</Text>
                      <Ionicons
                        name="arrow-forward"
                        size={17}
                        color={loginColors.text}
                      />
                    </View>
                    <Text style={styles.officialLoginSubtitle}>
                      Authorized government personnel only
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>

        <NumericKeyboardAccessory />
      </KeyboardAvoidingView>
    </View>
  );
}
