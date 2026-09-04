import React, { useCallback, useRef, useState } from 'react';
import { Animated, Image, type ImageSourcePropType, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { homeStyles as styles } from '../../styles/screens/home.styles';

const DISPLAY_DURATION_MS = 4_000;
const FADE_DURATION_MS = 350;

const reminderImages: ImageSourcePropType[] = [
  require('../../assets/images/reminder1.png'),
  require('../../assets/images/reminder2.png'),
  require('../../assets/images/reminder3.png'),
  require('../../assets/images/reminder4.png'),
  require('../../assets/images/reminder5.png'),
  require('../../assets/images/reminder6.png'),
];

function createRandomImageOrder(previousImageIndex?: number): number[] {
  const randomOrder = reminderImages.map((_, imageIndex) => imageIndex);

  // Fisher-Yates gives every reminder an equal chance in each six-image cycle.
  for (let currentIndex = randomOrder.length - 1; currentIndex > 0; currentIndex -= 1) {
    const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
    [randomOrder[currentIndex], randomOrder[randomIndex]] = [
      randomOrder[randomIndex],
      randomOrder[currentIndex],
    ];
  }

  // Prevent the cycle boundary from displaying the same reminder twice in a row.
  if (randomOrder[0] === previousImageIndex && randomOrder.length > 1) {
    const replacementIndex = 1 + Math.floor(Math.random() * (randomOrder.length - 1));
    [randomOrder[0], randomOrder[replacementIndex]] = [
      randomOrder[replacementIndex],
      randomOrder[0],
    ];
  }

  return randomOrder;
}

export default function ReminderBanner() {
  const initialOrderRef = useRef(createRandomImageOrder());
  const imageOrderRef = useRef(initialOrderRef.current);
  const orderPositionRef = useRef(0);
  const isTransitioningRef = useRef(false);
  const isFocusedRef = useRef(false);
  const activeSlotRef = useRef<0 | 1>(0);
  const pendingSlotRef = useRef<0 | 1 | null>(null);
  const slotImageIndexesRef = useRef<[number, number]>([
    initialOrderRef.current[0],
    initialOrderRef.current[0],
  ]);
  const firstSlotOpacity = useRef(new Animated.Value(1)).current;
  const secondSlotOpacity = useRef(new Animated.Value(0)).current;
  const [slotImageIndexes, setSlotImageIndexes] = useState<[number, number]>(
    slotImageIndexesRef.current,
  );
  const [cyclePosition, setCyclePosition] = useState(0);

  const crossfadeToSlot = useCallback(
    (nextSlot: 0 | 1) => {
      if (!isFocusedRef.current || pendingSlotRef.current !== nextSlot) return;

      const currentOpacity = activeSlotRef.current === 0
        ? firstSlotOpacity
        : secondSlotOpacity;
      const nextOpacity = nextSlot === 0 ? firstSlotOpacity : secondSlotOpacity;

      Animated.parallel([
        Animated.timing(currentOpacity, {
          toValue: 0,
          duration: FADE_DURATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(nextOpacity, {
          toValue: 1,
          duration: FADE_DURATION_MS,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;

        activeSlotRef.current = nextSlot;
        pendingSlotRef.current = null;
        isTransitioningRef.current = false;
        setCyclePosition(orderPositionRef.current);
      });
    },
    [firstSlotOpacity, secondSlotOpacity],
  );

  const handleSlotLoaded = useCallback(
    (loadedSlot: 0 | 1) => {
      crossfadeToSlot(loadedSlot);
    },
    [crossfadeToSlot],
  );

  const showNextReminder = useCallback(() => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    const nextPosition = orderPositionRef.current + 1;
    if (nextPosition >= imageOrderRef.current.length) {
      const previousImageIndex = imageOrderRef.current[imageOrderRef.current.length - 1];
      imageOrderRef.current = createRandomImageOrder(previousImageIndex);
      orderPositionRef.current = 0;
    } else {
      orderPositionRef.current = nextPosition;
    }

    const nextImageIndex = imageOrderRef.current[orderPositionRef.current];
    const nextSlot: 0 | 1 = activeSlotRef.current === 0 ? 1 : 0;
    pendingSlotRef.current = nextSlot;

    // If the hidden slot already contains this asset, it is ready to crossfade immediately.
    if (slotImageIndexesRef.current[nextSlot] === nextImageIndex) {
      crossfadeToSlot(nextSlot);
      return;
    }

    const nextSlotImageIndexes: [number, number] = [...slotImageIndexesRef.current];
    nextSlotImageIndexes[nextSlot] = nextImageIndex;
    slotImageIndexesRef.current = nextSlotImageIndexes;
    setSlotImageIndexes(nextSlotImageIndexes);
  }, [crossfadeToSlot]);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      const rotationTimer = setInterval(showNextReminder, DISPLAY_DURATION_MS);

      return () => {
        isFocusedRef.current = false;
        clearInterval(rotationTimer);
        firstSlotOpacity.stopAnimation();
        secondSlotOpacity.stopAnimation();
        firstSlotOpacity.setValue(activeSlotRef.current === 0 ? 1 : 0);
        secondSlotOpacity.setValue(activeSlotRef.current === 1 ? 1 : 0);
        pendingSlotRef.current = null;
        isTransitioningRef.current = false;
      };
    }, [firstSlotOpacity, secondSlotOpacity, showNextReminder]),
  );

  return (
    <View
      style={styles.reminderBanner}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Preparedness reminder ${cyclePosition + 1} of ${reminderImages.length}`}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.reminderBannerImageLayer, { opacity: firstSlotOpacity }]}
      >
        <Image
          source={reminderImages[slotImageIndexes[0]]}
          resizeMode="stretch"
          style={styles.reminderBannerImage}
          onLoad={() => handleSlotLoaded(0)}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.reminderBannerImageLayer, { opacity: secondSlotOpacity }]}
      >
        <Image
          source={reminderImages[slotImageIndexes[1]]}
          resizeMode="stretch"
          style={styles.reminderBannerImage}
          onLoad={() => handleSlotLoaded(1)}
        />
      </Animated.View>
      <View style={styles.reminderIndicators} pointerEvents="none">
        {reminderImages.map((_, indicatorIndex) => (
          <View
            key={indicatorIndex}
            style={[
              styles.reminderIndicator,
              indicatorIndex === cyclePosition && styles.reminderIndicatorActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}
