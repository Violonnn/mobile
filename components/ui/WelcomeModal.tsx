import React, { useEffect } from 'react';
import { Modal, View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { homeStyles as styles } from '../../styles/screens/home.styles';
import { colors } from '../../styles/theme';

const SUCCESS_IMAGE = require('../../assets/images/registered-success1.png');
const AnimatedImage = Animated.createAnimatedComponent(Image);

type Props = {
  visible: boolean;
  firstName?: string;
  barangay?: string;
  onDone: () => void;
};

export default function WelcomeModal({ visible, firstName, barangay, onDone }: Props) {
  const imageOpacity = useSharedValue(0);
  const imageScale = useSharedValue(0.9);
  const textOpacity = useSharedValue(0);
  const textY = useSharedValue(16);
  const buttonOpacity = useSharedValue(0);
  const buttonY = useSharedValue(12);
  const buttonX = useSharedValue(-48);

  function startEntranceAnimation() {
    imageOpacity.value = 0;
    imageScale.value = 0.9;
    textOpacity.value = 0;
    textY.value = 16;
    buttonOpacity.value = 0;
    buttonY.value = 12;
    buttonX.value = -48;

    imageOpacity.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    imageScale.value = withSpring(1, { damping: 14, stiffness: 110 });

    textOpacity.value = withDelay(420, withTiming(1, { duration: 440 }));
    textY.value = withDelay(420, withSpring(0, { damping: 16, stiffness: 130 }));

    buttonOpacity.value = withDelay(700, withTiming(1, { duration: 380 }));
    buttonY.value = withDelay(700, withSpring(0, { damping: 16, stiffness: 130 }));
    buttonX.value = withDelay(700, withSpring(0, { damping: 14, stiffness: 110 }));
  }

  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(startEntranceAnimation);
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  const imageStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
    transform: [{ scale: imageScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [
      { translateY: buttonY.value },
      { translateX: buttonX.value },
    ],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.welcomeOverlay}>
        <View style={modalStyles.card}>

          <View style={modalStyles.imageWrapper}>
            <AnimatedImage
              source={SUCCESS_IMAGE}
              style={[modalStyles.image, imageStyle]}
              resizeMode="contain"
            />
          </View>

          <Animated.View style={[modalStyles.textBlock, textStyle]}>
            <Text style={modalStyles.title}>
              Welcome to{' '}
              <Text style={modalStyles.titleAccent}>DisasterLink</Text>!
            </Text>
            <Text style={modalStyles.subtitle}>
              {firstName?.trim()
                ? `Hi ${firstName.trim()}! You're all set. We'll show you how to stay safe and connected.`
                : "You're all set. We'll show you how to stay safe and connected."}
            </Text>
          </Animated.View>

          <Animated.View style={[modalStyles.buttonRow, buttonStyle]}>
            <TouchableOpacity onPress={onDone} activeOpacity={0.7} style={modalStyles.button}>
              <Text style={modalStyles.buttonText}>Proceed →</Text>
            </TouchableOpacity>
          </Animated.View>

        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 28,
    marginHorizontal: 24,
    alignItems: 'center',
    gap: 20,
    width: '100%',
    maxWidth: 360,
  },
  imageWrapper: {
    width: '100%',
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  textBlock: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  titleAccent: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonRow: {
    width: '100%',
    alignItems: 'flex-end',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
});