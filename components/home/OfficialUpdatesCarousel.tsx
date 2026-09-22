/* RNGH and React Native Animated require stable imperative refs while configuring gestures. */
/* eslint-disable react-hooks/refs */
import React, { useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Gesture,
  GestureDetector,
  ScrollView as GestureHandlerScrollView,
} from 'react-native-gesture-handler';

import type { AnnouncementRecord } from '../../lib/announcements';
import { homeColors, homeStyles as styles } from '../../styles/screens/home.styles';
import HomeUpdateCard from './HomeUpdateCard';

const SWIPE_TRIGGER_DISTANCE = 72;
const CARD_GAP = 4;
const INACTIVE_CARD_SCALE = 0.86;
const INACTIVE_CARD_OPACITY = 0.78;
const AnimatedCarouselScrollView = Animated.createAnimatedComponent(GestureHandlerScrollView);

type OfficialUpdatesCarouselProps = {
  announcements: AnnouncementRecord[];
  cardWidth: number;
  carouselWidth: number;
  trailingSpace: number;
  onOpenAnnouncement: () => void;
  onRequestMore: () => void;
};

export default function OfficialUpdatesCarousel({
  announcements,
  cardWidth,
  carouselWidth,
  trailingSpace,
  onOpenAnnouncement,
  onRequestMore,
}: OfficialUpdatesCarouselProps) {
  const [swipeProgress] = useState(() => new Animated.Value(0));
  const [scrollOffset] = useState(() => new Animated.Value(0));
  const isPromptOpeningRef = useRef(false);
  const carouselScrollRef = useRef(null);
  const lastAnnouncement = announcements[announcements.length - 1];
  const lastCardOffset = swipeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -36],
  });

  function resetSwipeIndicator() {
    Animated.timing(swipeProgress, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }

  function completeRightSwipe(translationX: number) {
    const completedSwipe = translationX >= SWIPE_TRIGGER_DISTANCE * 0.8;

    if (!completedSwipe || isPromptOpeningRef.current) {
      resetSwipeIndicator();
      return;
    }

    isPromptOpeningRef.current = true;
    Animated.timing(swipeProgress, {
      toValue: 1,
      duration: 130,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onRequestMore();
      swipeProgress.setValue(0);
      isPromptOpeningRef.current = false;
    });
  }

  // The final card reserves the next leftward carousel swipe for the prompt.
  const rightSwipeGesture = Gesture.Pan()
    .activeOffsetX(-6)
    .failOffsetY([-18, 18])
    .blocksExternalGesture(carouselScrollRef)
    .runOnJS(true)
    .onUpdate((event) => {
      if (event.translationX >= 0) return;
      const progress = Math.min(1, -event.translationX / SWIPE_TRIGGER_DISTANCE);
      swipeProgress.setValue(progress);
    })
    .onEnd((event) => completeRightSwipe(-event.translationX))
    .onFinalize((_, success) => {
      if (!success && !isPromptOpeningRef.current) resetSwipeIndicator();
    });

  if (!lastAnnouncement) return null;

  return (
    <AnimatedCarouselScrollView
      ref={carouselScrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.officialUpdatesCarouselContent,
        { paddingHorizontal: trailingSpace },
      ]}
      style={[styles.officialUpdatesCarousel, { width: carouselWidth }]}
      decelerationRate="fast"
      snapToInterval={cardWidth + CARD_GAP}
      scrollEventThrottle={16}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollOffset } } }],
        { useNativeDriver: true },
      )}
    >
      {announcements.map((announcement, index) => {
        const isLastAnnouncement = announcement.id === lastAnnouncement.id;
        const cardOffset = index * (cardWidth + CARD_GAP);
        const emphasisRange = [
          cardOffset - cardWidth - CARD_GAP,
          cardOffset,
          cardOffset + cardWidth + CARD_GAP,
        ];
        const card = (
          <View style={[styles.officialUpdateCardWrap, { width: cardWidth }]}>
            <Animated.View
              style={[
                styles.officialUpdateCardEmphasis,
                {
                  opacity: scrollOffset.interpolate({
                    inputRange: emphasisRange,
                    outputRange: [INACTIVE_CARD_OPACITY, 1, INACTIVE_CARD_OPACITY],
                    extrapolate: 'clamp',
                  }),
                  transform: [
                    {
                      scale: scrollOffset.interpolate({
                        inputRange: emphasisRange,
                        outputRange: [INACTIVE_CARD_SCALE, 1, INACTIVE_CARD_SCALE],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                },
              ]}
            >
              <Animated.View
                style={isLastAnnouncement ? { transform: [{ translateX: lastCardOffset }] } : undefined}
              >
                <HomeUpdateCard
                  announcement={announcement}
                  label={announcement.scope === 'municipal' ? 'Municipal update' : 'Barangay update'}
                  onPress={onOpenAnnouncement}
                />
              </Animated.View>
            </Animated.View>

            {isLastAnnouncement ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.officialUpdateSwipeArrow,
                  {
                    opacity: swipeProgress,
                    transform: [
                      {
                        translateX: swipeProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [18, 0],
                        }),
                      },
                      {
                        scale: swipeProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.45, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Ionicons name="arrow-forward" size={25} color={homeColors.ink} />
              </Animated.View>
            ) : null}
          </View>
        );

        return isLastAnnouncement ? (
          <GestureDetector key={announcement.id} gesture={rightSwipeGesture}>
            {card}
          </GestureDetector>
        ) : (
          <View key={announcement.id}>{card}</View>
        );
      })}
    </AnimatedCarouselScrollView>
  );
}
