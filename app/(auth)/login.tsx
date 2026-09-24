import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import DemoAuthBanner from '../../components/auth/DemoAuthBanner';
import LoginSplashTransition from '../../components/ui/LoginSplashTransition';
import NumericKeyboardAccessory, {
  LOGIN_NUMERIC_ACCESSORY_ID,
} from '../../components/ui/NumericKeyboardAccessory';
import { SkeletonBlock, SkeletonGroup } from '../../components/ui/Skeleton';
import { useLoginFlow } from '../../hooks/useLoginFlow';
import { takeResidentLoginIntro } from '../../lib/residentLoginIntro';
import { loginColors, loginStyles as styles } from '../../styles/screens/login.styles';
import { fonts } from '../../styles/theme';

const PIN_LENGTH = 6;
const LOGIN_LOGO_SOURCE = require('../../assets/images/splash_iconDL-transparent.png');
const PLACEHOLDER_DOTS = '······';

export default function LoginScreen() {
  const phoneRef = useRef<TextInput>(null);
  const pinRef = useRef<TextInput>(null);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [pinFocused, setPinFocused] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);
  const [playLoginIntro] = useState(() => takeResidentLoginIntro());
  const [showLoginContent, setShowLoginContent] = useState(() => !playLoginIntro);
  const [loginContentOpacity] = useState(() => new Animated.Value(playLoginIntro ? 0 : 1));
  const [loginLogoScale] = useState(() => new Animated.Value(playLoginIntro ? 1.2 : 1));
  const [loginLogoTranslateY] = useState(() => new Animated.Value(playLoginIntro ? -180 : 0));

  const {
    phoneDigits,
    phoneError,
    pin,
    pinError,
    submitting,
    phoneLocked,
    phoneLoaded,
    hasSavedPhone,
    handlePhoneInput,
    clearPhoneForEdit,
    handlePinChange,
    submitLogin,
    goToForgotPassword,
    goToRegister,
    goToOfficialLogin,
  } = useLoginFlow();

  function handleSavedPhonePress() {
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
    Keyboard.dismiss();
    goToRegister();
  }

  function handlePinInputChange(text: string) {
    if (text.length === 0) {
      setPinVisible(false);
    }

    handlePinChange(text);
  }

  const handleSplashComplete = useCallback(() => {
    setShowLoginContent(true);
    Animated.timing(loginContentOpacity, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
    // The login logo drops into its resting position after the splash logo exits.
    Animated.parallel([
      Animated.spring(loginLogoTranslateY, {
        toValue: 0,
        friction: 7,
        tension: 75,
        useNativeDriver: true,
      }),
      Animated.spring(loginLogoScale, {
        toValue: 1,
        friction: 7,
        tension: 75,
        useNativeDriver: true,
      }),
    ]).start();
  }, [loginContentOpacity, loginLogoScale, loginLogoTranslateY]);

  const pinDisplayText =
    pin.length === 0 ? PLACEHOLDER_DOTS : pinVisible ? pin : '•'.repeat(pin.length);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <DemoAuthBanner />
      {playLoginIntro && !showLoginContent && (
        <LoginSplashTransition onComplete={handleSplashComplete} />
      )}
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
            {/* ── Content section ── */}
            <Animated.View
              pointerEvents={showLoginContent ? 'auto' : 'none'}
              style={[styles.loginContentShell, { opacity: loginContentOpacity }]}
            >
              <View style={styles.loginMainContent}>
              <Animated.View
                style={[
                  styles.loginLogoWrap,
                  { transform: [{ translateY: loginLogoTranslateY }, { scale: loginLogoScale }] },
                ]}
              >
                <Image source={LOGIN_LOGO_SOURCE} style={styles.loginLogo} resizeMode="contain" />
              </Animated.View>
              <View style={styles.content}>
                <Text style={styles.sectionLabel}>Welcome back</Text>
                <Text style={styles.headline}>
                  Login to <Text style={styles.headlineAccent}>your</Text> account
                </Text>

              {/* ── Mobile number field ── */}
              <View style={styles.fieldWrap}>
                <Pressable
                  style={[
                    styles.fieldRow,
                    !phoneLocked && phoneFocused && styles.fieldRowFocused,
                    !!phoneError && styles.fieldRowError,
                  ]}
                  onPress={handleSavedPhonePress}
                  disabled={!phoneLocked || !hasSavedPhone}
                  accessibilityRole={phoneLocked && hasSavedPhone ? 'button' : undefined}
                  accessibilityLabel={phoneLocked && hasSavedPhone ? 'Change saved mobile number' : undefined}
                >
                  <View style={styles.phonePrefixBox}>
                    <Text style={styles.phonePrefixText}>+63</Text>
                  </View>
                  {!phoneLoaded ? (
                    <SkeletonGroup style={styles.phoneLoadingValue}>
                      <SkeletonBlock style={styles.phoneLoadingBlock} />
                    </SkeletonGroup>
                  ) : phoneLocked ? (
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
                      inputAccessoryViewID={LOGIN_NUMERIC_ACCESSORY_ID}
                      editable={!submitting}
                    />
                  )}
                </Pressable>
              </View>

              {!!phoneError && <FieldError message={phoneError} textStyle={styles.fieldErrorText} />}

              {/* ── PIN field ── */}
              <View style={styles.fieldWrap}>
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
                      onChangeText={handlePinInputChange}
                      onFocus={() => setPinFocused(true)}
                      onBlur={() => setPinFocused(false)}
                      keyboardType="number-pad"
                      maxLength={PIN_LENGTH}
                      autoCorrect={false}
                      autoComplete="off"
                      textContentType="none"
                      caretHidden
                      inputAccessoryViewID={LOGIN_NUMERIC_ACCESSORY_ID}
                      returnKeyType="done"
                      onSubmitEditing={submitLogin}
                      editable={phoneLoaded && !submitting}
                    />
                  </Pressable>
                  {pin.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setPinVisible((prev) => !prev)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessibilityLabel={pinVisible ? 'Hide PIN' : 'Show PIN'}
                    >
                      <Ionicons
                        name={pinVisible ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#9CA3AF"
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {!!pinError && <FieldError message={pinError} textStyle={styles.fieldErrorText} />}

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
                {submitting && <ActivityIndicator color={loginColors.white} />}
                <Text style={styles.loginButtonText}>{submitting ? 'Signing in…' : 'Sign in'}</Text>
              </TouchableOpacity>

              {/* ── Sign up row ── */}
              <TouchableOpacity
                style={styles.signUpRow}
                onPress={handleSignUp}
                activeOpacity={0.7}
              >
                <Text style={styles.signUpPrompt}>Don&apos;t have an account?</Text>
                <Text style={styles.signUpLink}>Sign up</Text>
              </TouchableOpacity>

              {/* ── Official access (preserved from current design) ── */}
              </View>
              </View>
            </Animated.View>
          </ScrollView>
        </TouchableWithoutFeedback>

        <NumericKeyboardAccessory
          accessoryID={LOGIN_NUMERIC_ACCESSORY_ID}
          doneTextStyle={{ fontFamily: fonts.semibold }}
        />
      </KeyboardAvoidingView>

      {/* Keep Official Access outside keyboard avoidance so it stays below the keyboard. */}
      <Animated.View
        pointerEvents={showLoginContent ? 'auto' : 'none'}
        style={[styles.officialSection, { opacity: loginContentOpacity }]}
      >
        <TouchableOpacity onPress={goToOfficialLogin} activeOpacity={0.7}>
          <View style={styles.officialLoginContent}>
            <Text style={styles.officialLoginTitle}>Official Access</Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color={loginColors.text}
              style={styles.officialLoginArrow}
            />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
