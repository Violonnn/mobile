import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLoginFlow } from '../../hooks/useLoginFlow';
import { responsiveImageHeight } from '../../lib/layout';
import { registerStyles as styles, registerColors } from '../../styles/screens/register.styles';
import NumericKeyboardAccessory, { NUMERIC_ACCESSORY_ID } from '../../components/ui/NumericKeyboardAccessory';

export default function LoginScreen() {
  const pinRef = useRef<TextInput>(null);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [pinFocused, setPinFocused] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);

  const {
    phoneDigits,
    phoneError,
    pin,
    pinError,
    submitting,
    canSubmit,
    phoneValidation,
    handlePhoneInput,
    handlePinChange,
    submitLogin,
    goBack,
  } = useLoginFlow();

  const imageHeight = responsiveImageHeight(0.22);

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
                <Image
                  source={require('../../assets/images/inputPIN.png')}
                  style={styles.imagePlaceholder}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.card}>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Welcome back</Text>
                  <Text style={styles.stepSubtitle}>
                    Enter your mobile number and{' '}
                    <Text style={styles.stepSubtitleBold}>6-digit PIN</Text>
                  </Text>

                  <Text style={styles.fieldLabel}>Mobile Number</Text>
                  <View style={[styles.phoneRow, phoneFocused && styles.phoneRowFocused]}>
                    <View style={styles.phonePrefixBox}>
                      <Text style={styles.phonePrefixText}>+63</Text>
                    </View>
                    <TextInput
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
                  </View>

                  {!!phoneError && (
                    <Text style={[styles.phoneHint, styles.phoneHintLarge, styles.phoneHintError]}>
                      {phoneError}
                    </Text>
                  )}

<View style={styles.fieldGroup}>
                    <Text style={styles.label}>PIN</Text>
                    <View
                      style={[
                        styles.input,
                        styles.dropdownInput,
                        pinFocused && styles.inputFocused,
                        !!pinError && styles.inputError,
                      ]}
                    >
                      <Pressable style={styles.pinInputWrapper} onPress={() => pinRef.current?.focus()}>
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
                          onSubmitEditing={() => {
                            if (canSubmit) submitLogin();
                          }}
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

                  <View style={styles.pinHintRow}>
                    <Ionicons name="information-circle-outline" size={14} color="#9CA3AF" />
                    <Text style={styles.pinHintText}>
                      Your PIN is checked on the server — it is never stored in the app.
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
                    onPress={submitLogin}
                    disabled={!canSubmit}
                    activeOpacity={0.8}
                  >
                    {submitting ? (
                      <ActivityIndicator color={registerColors.white} />
                    ) : (
                      <>
                        <Text
                          style={[
                            styles.primaryButtonText,
                            !phoneValidation.valid && styles.primaryButtonTextDisabled,
                          ]}
                        >
                          LOGIN
                        </Text>
                        <Ionicons name="log-in-outline" size={18} color={registerColors.white} />
                      </>
                    )}
                  </TouchableOpacity>
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
