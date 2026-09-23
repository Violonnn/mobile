import React from 'react';
import {
  type ImageSourcePropType,
  Image,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { loginStyles as styles } from '../../styles/screens/login.styles';
import { spacing } from '../../styles/theme';

type SafetySlide = {
  image: ImageSourcePropType;
  title: string;
  description: string;
};

const CARD_GAP = spacing.sm;

const SAFETY_SLIDES: SafetySlide[] = [
  {
    image: require('../../assets/images/municipal.png'),
    title: 'Together, we prepare',
    description: 'A safer Minglanilla starts with all of us staying ready.',
  },
  {
    image: require('../../assets/images/police.png'),
    title: 'Every report matters',
    description: 'Your quick action can help protect a neighbor in need.',
  },
  {
    image: require('../../assets/images/bombero4.png'),
    title: 'Ready to respond',
    description: 'Courage is closer when our community stays prepared.',
  },
  {
    image: require('../../assets/images/bombero3.png'),
    title: 'Safer, together',
    description: 'Prepared families help build a stronger community.',
  },
];

export default function LoginSafetyCarousel() {
  const { width } = useWindowDimensions();
  // Two cards stay fully visible while the next card invites the user to swipe.
  const cardWidth = Math.round((width - spacing.lg * 2) * 0.44);
  const snapInterval = cardWidth + CARD_GAP;

  return (
    <ScrollView
      horizontal
      decelerationRate="fast"
      showsHorizontalScrollIndicator={false}
      snapToInterval={snapInterval}
      snapToAlignment="start"
      style={styles.safetyCarousel}
      contentContainerStyle={styles.safetyCarouselContent}
      accessibilityLabel="Community safety information"
    >
      {SAFETY_SLIDES.map((slide, index) => (
        <View
          key={slide.title}
          style={[
            styles.safetyCarouselCard,
            { width: cardWidth },
            index < SAFETY_SLIDES.length - 1 && { marginRight: CARD_GAP },
          ]}
        >
          <Image source={slide.image} style={styles.safetyCarouselImage} resizeMode="cover" />
          <View style={styles.safetyCarouselCopy}>
            <Text style={styles.safetyCarouselTitle} numberOfLines={1}>
              {slide.title}
            </Text>
            <Text style={styles.safetyCarouselDescription} numberOfLines={2}>
              {slide.description}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
