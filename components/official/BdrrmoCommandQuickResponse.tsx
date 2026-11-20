import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';

import { mdrrmoCommandStyles as styles } from '../../styles/screens/mdrrmoCommand.styles';
import { colors, screenEdgeInset } from '../../styles/theme';

const QUICK_ACTIONS = [
  {
    label: 'Reports',
    icon: 'location-outline' as const,
    route: '/official/incidents?queue=needs_review&from=command',
  },
  {
    label: 'Post advisory',
    icon: 'megaphone-outline' as const,
    route: '/official/community?feed=official&compose=1',
  },
  {
    label: 'Hotlines',
    icon: 'call-outline' as const,
    route: '/official/resources?tab=hotlines&from=command',
  },
  {
    label: 'Facilities',
    icon: 'business-outline' as const,
    route: '/official/resources?tab=facilities&from=command',
  },
  {
    label: 'Centers',
    icon: 'home-outline' as const,
    iconFamily: 'material-community' as const,
    route: '/official/resources?tab=centers&from=command',
  },
];

export default function BdrrmoCommandQuickResponse() {
  const router = useRouter();

  return (
    <View style={[styles.quickResponseSection, { paddingHorizontal: screenEdgeInset }]}>
      <View style={styles.quickResponseHeader}>
        <Text style={styles.quickResponseTitle}>Quick tools</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickResponseActions}
        contentContainerStyle={styles.quickResponseScrollableActionsContent}
      >
        {QUICK_ACTIONS.map((action, index) => (
          <TouchableOpacity
            key={action.label}
            style={[
              styles.quickResponseAction,
              styles.quickResponseScrollableAction,
              index < QUICK_ACTIONS.length - 1 && styles.quickResponseActionBorder,
            ]}
            onPress={() => router.push(action.route as Href)}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            {action.iconFamily === 'material-community' ? (
              <MaterialCommunityIcons name="warehouse" size={31} color={colors.navigationActive} />
            ) : (
              <Ionicons name={action.icon} size={31} color={colors.navigationActive} />
            )}
            <Text style={styles.quickResponseBdrrmoActionLabel} numberOfLines={1}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
