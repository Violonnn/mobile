import React from 'react';
import {
  type ImageSourcePropType,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';

import { useAccessibilityLayout } from '../../hooks/useAccessibilityLayout';
import { homeStyles as styles } from '../../styles/screens/home.styles';

type ReminderCard = {
  image: ImageSourcePropType;
  title: string;
  description: string;
};

const REMINDERS: ReminderCard[] = [
  {
    image: require('../../assets/images/reminderHuman1.png'),
    title: 'Hazy-day safety',
    description: 'Wear a mask and check local air-quality advisories.',
  },
  {
    image: require('../../assets/images/reminderHuman2.png'),
    title: 'Beat dengue',
    description: 'Empty standing water every week to help prevent mosquitoes.',
  },
  {
    image: require('../../assets/images/reminderHuman3.png'),
    title: 'Protect your pets',
    description: "Keep your pet's anti-rabies vaccination up to date.",
  },
];

export default function ReminderForYouCarousel() {
  const { isLargeText } = useAccessibilityLayout();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.reminderForYouCarouselContent}
      style={styles.reminderForYouCarousel}
    >
      {REMINDERS.map((reminder) => (
        <View
          key={reminder.title}
          style={[
            styles.reminderForYouCard,
            isLargeText && styles.reminderForYouCardLargeText,
          ]}
        >
          <Image
            source={reminder.image}
            style={styles.reminderForYouImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            accessibilityLabel={reminder.title}
          />
          <View style={styles.reminderForYouCopy}>
            <Text style={styles.reminderForYouTitle}>
              {reminder.title}
            </Text>
            <Text style={styles.reminderForYouDescription}>
              {reminder.description}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
