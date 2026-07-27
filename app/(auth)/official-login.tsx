import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOfficialLoginFlow } from '../../hooks/useOfficialLoginFlow';
import { registerStyles as styles, registerColors } from '../../styles/screens/register.styles';
import FieldError from '../../components/register/FieldError';

/**
 * Seal must be large enough to read ring text, but never taller than ~30%
 * of the screen so the form below stays usable.
 */
function responsiveSealSize(screenWidth: number, screenHeight: number): number {
  const shortPhone = screenHeight < 700;
  const byWidth = Math.round(screenWidth * (shortPhone ? 0.42 : 0.48));
  const byHeight = Math.round(screenHeight * (shortPhone ? 0.16 : 0.2));
  const min = shortPhone ? 120 : 140;
  const max = shortPhone ? 160 : 180;
  return Math.max(min, Math.min(max, byWidth, byHeight));
}

/**
 * Official sign-in only.
 * Registration is invite-URL only (/invite) — not discoverable here.
 */
export default function OfficialLoginScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const sealSize = responsiveSealSize(screenWidth, screenHeight);

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const flow = useOfficialLoginFlow();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'android' ? 'height' : undefined}
        enabled={Platform.OS === 'android'}
      >
        <TouchableOpacity style={styles.backButton} onPress={flow.goBack} activeOpacity={0.8}>
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
                  source={require('../../assets/images/mingla.png')}
                  style={{ width: sealSize, height: sealSize }}
                  resizeMode="contain"
                  accessibilityLabel="Municipality of Minglanilla official seal"
                />
              </View>

              <Text style={[styles.screenTitle, localStyles.titleAfterSeal]}>
                Official Access
              </Text>
              <Text style={localStyles.subtitle}>
                Authorized government personnel only
              </Text>

              <View style={styles.card}>
                <View style={styles.stepContent}>
                  <View style={styles.loginFieldWrap}>
                    <Text style={styles.loginFieldLabel}>Email</Text>
                    <View
                      style={[
                        styles.phoneRow,
                        localStyles.inputRow,
                        emailFocused && styles.phoneRowFocused,
                        !!flow.emailError && styles.inputError,
                      ]}
                    >
                      <View style={styles.pinIconBox}>
                        <Ionicons
                          name="mail-outline"
                          size={18}
                          color={registerColors.textLight}
                        />
                      </View>
                      <TextInput
                        style={[styles.phoneInput, localStyles.fieldInput]}
                        value={flow.email}
                        onChangeText={flow.handleEmailChange}
                        placeholder="lgu@example.com"
                        placeholderTextColor={registerColors.grayMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        textContentType="emailAddress"
                        autoComplete="email"
                        editable={!flow.submitting}
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => setEmailFocused(false)}
                      />
                    </View>
                    {!!flow.emailError && <FieldError message={flow.emailError} />}
                  </View>

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
                        placeholder="Enter password"
                        placeholderTextColor={registerColors.grayMuted}
                        secureTextEntry={!flow.showPassword}
                        textContentType="password"
                        autoComplete="password"
                        editable={!flow.submitting}
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => setPasswordFocused(false)}
                        onSubmitEditing={flow.submitLogin}
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

                  {!!flow.formError && (
                    <View style={styles.loginFieldWrap}>
                      <FieldError message={flow.formError} />
                    </View>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      flow.submitting && styles.primaryButtonDisabled,
                    ]}
                    onPress={flow.submitLogin}
                    disabled={flow.submitting}
                    activeOpacity={0.85}
                  >
                    {flow.submitting ? (
                      <ActivityIndicator color={registerColors.white} />
                    ) : (
                      <>
                        <Text style={styles.primaryButtonText}>Sign in</Text>
                        <Ionicons
                          name="log-in-outline"
                          size={18}
                          color={registerColors.white}
                        />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
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
});
