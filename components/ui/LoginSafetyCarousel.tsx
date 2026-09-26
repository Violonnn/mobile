import React, { useEffect, useState } from 'react';
import {
  InteractionManager,
  type ImageSourcePropType,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';

import { loginStyles as styles } from '../../styles/screens/login.styles';
import { spacing } from '../../styles/theme';
import { SkeletonBlock, SkeletonGroup } from './Skeleton';

type SafetySlide = {
  image: ImageSourcePropType;
  title: string;
  description: string;
};

const CARD_GAP = spacing.sm;
const preparedImageIndexes = new Set<number>();

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
  const [loadedImageIndexes, setLoadedImageIndexes] = useState<number[]>(() =>
    Array.from(preparedImageIndexes),
  );
  // Two cards stay fully visible while the next card invites the user to swipe.
  const cardWidth = Math.round((width - spacing.lg * 2) * 0.44);
  const snapInterval = cardWidth + CARD_GAP;

  useEffect(() => {
    if (preparedImageIndexes.size > 0) return;

    // Let the sign-in form and keyboard render before decoding the two visible photos.
    const task = InteractionManager.runAfterInteractions(() => {
      preparedImageIndexes.add(0);
      preparedImageIndexes.add(1);
      setLoadedImageIndexes([0, 1]);
    });
    return () => task.cancel();
  }, []);

  function loadImagesNearSlide(slideIndex: number) {
    setLoadedImageIndexes((previousIndexes) => {
      const nextIndexes = new Set(previousIndexes);

      [slideIndex - 1, slideIndex, slideIndex + 1].forEach((index) => {
        if (index >= 0 && index < SAFETY_SLIDES.length) {
          nextIndexes.add(index);
          preparedImageIndexes.add(index);
        }
      });

      if (nextIndexes.size === previousIndexes.length) return previousIndexes;
      return Array.from(nextIndexes);
    });
  }

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
      onMomentumScrollEnd={(event) => {
        const slideIndex = Math.round(event.nativeEvent.contentOffset.x / snapInterval);
        loadImagesNearSlide(slideIndex);
      }}
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
          {loadedImageIndexes.includes(index) ? (
            <Image
              source={slide.image}
              style={styles.safetyCarouselImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={0}
            />
          ) : (
            <SkeletonGroup>
              <SkeletonBlock style={styles.safetyCarouselImage} />
            </SkeletonGroup>
          )}
          <View style={styles.safetyCarouselCopy}>
            <Text style={styles.safetyCarouselTitle}>
              {slide.title}
            </Text>
            <Text style={styles.safetyCarouselDescription}>
              {slide.description}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
