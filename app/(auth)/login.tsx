import React, { useRef, useState } from 'react';
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
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { useLoginFlow } from '../../hooks/useLoginFlow';
import { responsiveLoginImageHeight } from '../../lib/layout';
import { registerStyles as styles, registerColors } from '../../styles/screens/register.styles';
import NumericKeyboardAccessory, { NUMERIC_ACCESSORY_ID } from '../../components/ui/NumericKeyboardAccessory';
import { FacebookIcon, TikTokIcon } from '../../components/ui/SocialBrandIcons';

export default function LoginScreen() {
  const phoneRef = useRef<TextInput>(null);
  const pinRef = useRef<TextInput>(null);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [swapPressed, setSwapPressed] = useState(false);
  const [pinFocused, setPinFocused] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);

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
  } = useLoginFlow();

  const imageHeight = responsiveLoginImageHeight();
  const phoneFieldActive = !phoneLocked && phoneFocused;

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

        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.fixedScrollContent}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.centeredBlock}>
              <Text style={styles.screenTitle}>Login</Text>

              <View style={[styles.imageContainer, { height: imageHeight }]}>
                <LottieView
                  source={require('../../assets/lottie/marker-animation.json')}
                  style={styles.imagePlaceholder}
                  autoPlay
                  loop
                  resizeMode="contain"
                />
              </View>

              <View style={styles.card}>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Welcome back!</Text>

                  <View style={styles.loginFieldWrap}>
                    <Text style={styles.loginFieldLabel}>Mobile Number</Text>
                    <View style={[styles.phoneRow, phoneFieldActive && styles.phoneRowFocused]}>
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
                          placeholderTextColor={registerColors.grayMuted}
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
                            color={swapPressed ? registerColors.primary : registerColors.textLight}
                          />
                        </Pressable>
                      )}
                    </View>
                  </View>

                  {!!phoneError && (
                    <View style={styles.loginFieldWrap}>
                      <Text
                        style={[
                          styles.phoneHint,
                          styles.phoneHintLarge,
                          styles.phoneHintError,
                          { textAlign: 'left', marginTop: 0 },
                        ]}
                      >
                        {phoneError}
                      </Text>
                    </View>
                  )}

                  <View style={styles.loginFieldWrap}>
                    <Text style={styles.loginFieldLabel}>PIN</Text>
                    <View
                      style={[
                        styles.phoneRow,
                        pinFocused && styles.phoneRowFocused,
                        !!pinError && styles.inputError,
                      ]}
                    >
                      <View style={styles.pinIconBox}>
                        <Ionicons name="keypad-outline" size={20} color={registerColors.textLight} />
                      </View>
                      <Pressable
                        style={[styles.pinInputWrapper, styles.loginPinRow]}
                        onPress={() => pinRef.current?.focus()}
                      >
                        <Text
                          style={[
                            styles.pinDisplayText,
                            pin.length === 0 && { color: '#9CA3AF' },
                          ]}
                          pointerEvents="none"
                        >
                          {pin.length === 0
                            ? '······'
                            : pinVisible
                              ? pin
                              : '•'.repeat(pin.length)}
                        </Text>
                        <TextInput
                          ref={pinRef}
                          style={styles.pinHiddenInput}
                          value={pin}
                          onChangeText={handlePinChange}
                          onFocus={() => setPinFocused(true)}
                          onBlur={() => setPinFocused(false)}
                          keyboardType="number-pad"
                          maxLength={6}
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
                        onPress={() => setPinVisible(!pinVisible)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name={pinVisible ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color="#9CA3AF"
                        />
                      </TouchableOpacity>
                    </View>
                    {!!pinError && <Text style={styles.errorText}>{pinError}</Text>}
                  </View>

                  <TouchableOpacity
                    style={styles.forgotPasswordRow}
                    onPress={goToForgotPassword}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={16}
                      color={registerColors.gray}
                      style={{ marginTop: 1 }}
                    />
                    <Text style={styles.forgotPasswordText}>
                      Forgot your password?{' '}
                      <Text style={styles.forgotPasswordLink}>Click here</Text>
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
                    onPress={submitLogin}
                    disabled={submitting}
                    activeOpacity={0.8}
                  >
                    {submitting ? (
                      <ActivityIndicator color={registerColors.white} />
                    ) : (
                      <>
                        <Text style={styles.primaryButtonText}>LOGIN</Text>
                        <Ionicons name="log-in-outline" size={18} color={registerColors.white} />
                      </>
                    )}
                  </TouchableOpacity>

                  <View style={styles.socialFollowSection}>
                    <TouchableOpacity
                      style={styles.loginSignUpButton}
                      onPress={goToRegister}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.loginSignUpButtonText}>SIGN UP</Text>
                    </TouchableOpacity>

                    <View style={styles.socialFollowRow}>
                      <FacebookIcon />
                      <TikTokIcon />
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>

        <NumericKeyboardAccessory />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
