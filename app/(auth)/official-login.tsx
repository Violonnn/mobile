import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import FieldError from '../../components/register/FieldError';
import { useAccessSwitch } from '../../hooks/useAccessSwitch';
import { useOfficialLoginFlow } from '../../hooks/useOfficialLoginFlow';
import { loginColors, loginStyles as styles } from '../../styles/screens/login.styles';

/** Official sign-in only. Registration remains invite-URL only. */
export default function OfficialLoginScreen() {
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const flow = useOfficialLoginFlow();
  const { isSwitchingAccess, switchAccess } = useAccessSwitch(flow.goBack);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            bounces={false}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          >
            <View style={localStyles.loginMainContent}>
              <View style={localStyles.sealWrap}>
                <Image
                  source={require('../../assets/images/mingla.png')}
                  style={localStyles.seal}
                  resizeMode="contain"
                  fadeDuration={0}
                  accessibilityLabel="Municipality of Minglanilla official seal"
                />
              </View>

              <View style={localStyles.content}>
                <Text style={styles.sectionLabel}>Good to see you again.</Text>
                <Text style={styles.headline}>
                  Continue <Text style={localStyles.monitoringText}>monitoring</Text> and{' '}
                  <Text style={localStyles.coordinatingText}>coordinating</Text> local reports.
                </Text>

                <View style={styles.fieldWrap}>
                  <View
                    style={[
                      styles.fieldRow,
                      emailFocused && styles.fieldRowFocused,
                      !!flow.emailError && styles.fieldRowError,
                    ]}
                  >
                    <View style={styles.pinIconBox}>
                      <Ionicons name="mail-outline" size={18} color={loginColors.textLight} />
                    </View>
                    <TextInput
                      style={styles.phoneInput}
                      value={flow.email}
                      onChangeText={flow.handleEmailChange}
                      placeholder="lgu@example.com"
                      placeholderTextColor={loginColors.grayMuted}
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
                  {!!flow.emailError && (
                    <FieldError message={flow.emailError} textStyle={styles.fieldErrorText} />
                  )}
                </View>

                <View style={styles.fieldWrap}>
                  <View
                    style={[
                      styles.fieldRow,
                      passwordFocused && styles.fieldRowFocused,
                      !!flow.passwordError && styles.fieldRowError,
                    ]}
                  >
                    <View style={styles.pinIconBox}>
                      <Ionicons name="lock-closed-outline" size={18} color={loginColors.textLight} />
                    </View>
                    <TextInput
                      style={[styles.phoneInput, localStyles.passwordInput]}
                      value={flow.password}
                      onChangeText={flow.handlePasswordChange}
                      placeholder="Enter password"
                      placeholderTextColor={loginColors.grayMuted}
                      secureTextEntry={!flow.showPassword}
                      textContentType="password"
                      autoComplete="password"
                      editable={!flow.submitting}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      onSubmitEditing={flow.submitLogin}
                    />
                    {flow.password.length > 0 && (
                      <TouchableOpacity
                        style={localStyles.eyeButton}
                        onPress={flow.toggleShowPassword}
                        activeOpacity={0.7}
                        accessibilityLabel={flow.showPassword ? 'Hide password' : 'Show password'}
                      >
                        <Ionicons
                          name={flow.showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color={loginColors.textLight}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                  {!!flow.passwordError && (
                    <FieldError message={flow.passwordError} textStyle={styles.fieldErrorText} />
                  )}
                </View>

                {!!flow.formError && (
                  <FieldError message={flow.formError} textStyle={styles.fieldErrorText} />
                )}

                <TouchableOpacity
                  style={[
                    styles.loginButton,
                    localStyles.officialLoginButton,
                    flow.submitting && styles.loginButtonDisabled,
                  ]}
                  onPress={flow.submitLogin}
                  disabled={flow.submitting}
                  activeOpacity={0.85}
                >
                  {flow.submitting && <ActivityIndicator color={loginColors.white} />}
                  <Text style={styles.loginButtonText}>
                    {flow.submitting ? 'Signing in…' : 'Sign in'}
                  </Text>
                </TouchableOpacity>

              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      <View style={styles.officialSection}>
        <TouchableOpacity
          onPress={switchAccess}
          disabled={isSwitchingAccess}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go to resident access"
        >
          <View style={styles.officialLoginContent}>
            <Ionicons
              name="arrow-back"
              size={18}
              color={loginColors.text}
              style={localStyles.residentAccessArrow}
            />
            <Text style={styles.officialLoginTitle}>Resident Access</Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  loginMainContent: {
    flex: 1,
    justifyContent: 'center',
    // Bottom space raises the vertically centered form slightly for easier reach.
    paddingBottom: 32,
  },
  sealWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 32,
  },
  seal: {
    width: 168,
    height: 168,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  monitoringText: {
    color: '#FD0132',
  },
  coordinatingText: {
    color: '#2100AF',
  },
  officialLoginButton: {
    backgroundColor: loginColors.text,
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
  residentAccessArrow: {
    marginRight: 8,
  },
});
