import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import LoginSafetyCarousel from '../../components/ui/LoginSafetyCarousel';
import { useOfficialLoginFlow } from '../../hooks/useOfficialLoginFlow';
import { loginColors, loginStyles as styles } from '../../styles/screens/login.styles';

/** Official sign-in only. Registration remains invite-URL only. */
export default function OfficialLoginScreen() {
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [sealTranslateY] = useState(() => new Animated.Value(-80));
  const flow = useOfficialLoginFlow();

  useEffect(() => {
    // The seal enters once from above, then settles into its resting position.
    const bounceAnimation = Animated.spring(sealTranslateY, {
      toValue: 0,
      friction: 5,
      tension: 85,
      useNativeDriver: true,
    });

    bounceAnimation.start();
    return () => bounceAnimation.stop();
  }, [sealTranslateY]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity
          style={localStyles.backButton}
          onPress={flow.goBack}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={loginColors.text} />
        </TouchableOpacity>

        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            bounces={false}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          >
            <View style={localStyles.loginMainContent}>
              <Animated.View
                style={[localStyles.sealWrap, { transform: [{ translateY: sealTranslateY }] }]}
              >
                <Image
                  source={require('../../assets/images/mingla.png')}
                  style={localStyles.seal}
                  resizeMode="contain"
                  accessibilityLabel="Municipality of Minglanilla official seal"
                />
              </Animated.View>

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
                  {flow.submitting ? (
                    <ActivityIndicator color={loginColors.white} />
                  ) : (
                    <Text style={styles.loginButtonText}>Sign in</Text>
                  )}
                </TouchableOpacity>

                <LoginSafetyCarousel />

              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
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
  loginMainContent: {
    flex: 1,
    justifyContent: 'center',
  },
  sealWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 32,
  },
  seal: {
    width: 144,
    height: 144,
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
});
