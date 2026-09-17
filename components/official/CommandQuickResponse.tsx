import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';

import { colors } from '../../styles/theme';
import { mdrrmoCommandStyles as styles } from '../../styles/screens/mdrrmoCommand.styles';

const QUICK_ACTIONS = [
  {
    label: 'Reports',
    icon: 'location-outline' as const,
    route: '/official/incidents?from=command',
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
    route: '/official/resources?tab=centers&from=command',
  },
];

export default function CommandQuickResponse() {
  const router = useRouter();

  return (
    <View style={styles.quickResponseSection}>
      <View style={styles.quickResponseHeader}>
        <Text style={styles.quickResponseTitle}>Quick tools</Text>
      </View>

      <View style={styles.quickResponseActions}>
        {QUICK_ACTIONS.map((action, index) => (
          <TouchableOpacity
            key={action.label}
            style={[
              styles.quickResponseAction,
              index < QUICK_ACTIONS.length - 1 && styles.quickResponseActionBorder,
            ]}
            onPress={() => router.push(action.route as Href)}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Ionicons name={action.icon} size={31} color={colors.navigationActive} />
            <Text style={styles.quickResponseActionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
