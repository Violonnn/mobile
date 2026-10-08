import React, { useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView as GestureHandlerScrollView } from 'react-native-gesture-handler';

import type { AnnouncementRecord } from '../../lib/announcements';
import { homeColors, homeStyles as styles } from '../../styles/screens/home.styles';
import HomeUpdateCard from './HomeUpdateCard';

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
  const [scrollOffset] = useState(() => new Animated.Value(0));
  const hasOpenedEndPromptRef = useRef(false);
  const lastAnnouncement = announcements[announcements.length - 1];

  function openMoreUpdates() {
    onRequestMore();
  }

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const endControlOffset = announcements.length * (cardWidth + CARD_GAP);
    const currentOffset = event.nativeEvent.contentOffset.x;

    if (currentOffset >= endControlOffset - CARD_GAP) {
      if (hasOpenedEndPromptRef.current) return;
      hasOpenedEndPromptRef.current = true;
      openMoreUpdates();
      return;
    }

    // Allow the prompt to open again after the resident moves back into the updates.
    hasOpenedEndPromptRef.current = false;
  }

  if (!lastAnnouncement) return null;

  return (
    <AnimatedCarouselScrollView
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
      onMomentumScrollEnd={handleScrollEnd}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollOffset } } }],
        { useNativeDriver: true },
      )}
    >
      {announcements.map((announcement, index) => {
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
              <HomeUpdateCard
                announcement={announcement}
                label={announcement.scope === 'municipal' ? 'Municipal update' : 'Barangay update'}
                onPress={onOpenAnnouncement}
              />
            </Animated.View>
          </View>
        );

        return <View key={announcement.id}>{card}</View>;
      })}
      <View style={[styles.officialUpdatesEndControlWrap, { width: cardWidth }]}>
        <Pressable
          style={styles.officialUpdatesEndControl}
          onPress={openMoreUpdates}
          accessibilityRole="button"
          accessibilityLabel="See all official updates"
        >
          <View style={styles.officialUpdatesEndControlIcon}>
            <Ionicons name="arrow-forward" size={30} color={homeColors.ink} />
          </View>
          <Text style={styles.officialUpdatesEndControlText}>See all official updates</Text>
        </Pressable>
      </View>
    </AnimatedCarouselScrollView>
  );
}
