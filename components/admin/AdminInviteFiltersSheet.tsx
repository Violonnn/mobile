import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type {
  AdminInviteExpiryFilter,
  AdminInviteGroupFilter,
  AdminInviteRoleFilter,
} from '../../lib/adminInvitePolicy';
import { adminStyles as styles } from '../../styles/screens/admin.styles';
import { colors } from '../../styles/theme';

type AdminInviteFiltersSheetProps = {
  group: AdminInviteGroupFilter;
  role: AdminInviteRoleFilter;
  expiry: AdminInviteExpiryFilter;
  onClose: () => void;
  onApply: (role: AdminInviteRoleFilter, expiry: AdminInviteExpiryFilter) => void;
};

const ROLE_OPTIONS: { value: AdminInviteRoleFilter; label: string }[] = [
  { value: 'all', label: 'All roles' },
  { value: 'mayor', label: 'Mayor' },
  { value: 'mdrrmo', label: 'MDRRMO' },
  { value: 'bdrrmo', label: 'BDRRMO' },
];

function FilterOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterOption, selected && styles.filterOptionSelected]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.filterOptionText, selected && styles.filterOptionTextSelected]}>
        {label}
      </Text>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={selected ? colors.navigationActive : colors.textMuted}
      />
    </TouchableOpacity>
  );
}

export default function AdminInviteFiltersSheet({
  group,
  role,
  expiry,
  onClose,
  onApply,
}: AdminInviteFiltersSheetProps) {
  const [draftRole, setDraftRole] = useState(role);
  const [draftExpiry, setDraftExpiry] = useState<AdminInviteExpiryFilter>(
    group === 'pending' ? expiry : 'any',
  );

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.filterBackdrop}>
        <TouchableOpacity
          style={styles.filterDismissArea}
          onPress={onClose}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Close filters"
        />
        <SafeAreaView style={styles.filterSheet} edges={['bottom']}>
          <View style={styles.filterSheetHeader}>
            <Text style={styles.filterSheetTitle}>Filter invites</Text>
            <TouchableOpacity
              style={styles.iconAction}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close filters"
            >
              <Ionicons name="close-outline" size={22} color={colors.navigationActive} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.filterSheetContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.filterGroup} accessibilityRole="radiogroup">
              <Text style={styles.filterGroupTitle}>Role</Text>
              {ROLE_OPTIONS.map((option) => (
                <FilterOption
                  key={option.value}
                  label={option.label}
                  selected={draftRole === option.value}
                  onPress={() => setDraftRole(option.value)}
                />
              ))}
            </View>

            {group === 'pending' ? (
              <View style={styles.filterGroup} accessibilityRole="radiogroup">
                <Text style={styles.filterGroupTitle}>Expiry</Text>
                <FilterOption
                  label="Any expiry"
                  selected={draftExpiry === 'any'}
                  onPress={() => setDraftExpiry('any')}
                />
                <FilterOption
                  label="Next 48 hours"
                  selected={draftExpiry === 'soon'}
                  onPress={() => setDraftExpiry('soon')}
                />
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={[styles.filterAction, styles.filterActionSecondary]}
              onPress={() => {
                setDraftRole('all');
                setDraftExpiry('any');
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.filterActionText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterAction, styles.filterActionPrimary]}
              onPress={() => onApply(draftRole, group === 'pending' ? draftExpiry : 'any')}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={[styles.filterActionText, styles.filterActionPrimaryText]}>
                Apply filters
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
