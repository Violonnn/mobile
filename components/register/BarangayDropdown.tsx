// components/register/BarangayDropdown.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, Pressable } from 'react-native';
import { registerStyles as styles } from '../../styles/screens/register.styles';

type Props = {
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  placeholder?: string;
  hasError?: boolean;
};

export default function BarangayDropdown({
  value,
  options,
  onSelect,
  placeholder = 'Select Barangay',
  hasError = false,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <TouchableOpacity
        style={[styles.dropdown, hasError && styles.inputError]}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.dropdownText, !value && styles.dropdownPlaceholder]}>
          {value || placeholder}
        </Text>
        <Text style={styles.dropdownIcon}>▾</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Barangay</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              ItemSeparatorComponent={() => <View style={styles.modalDivider} />}
              renderItem={({ item }) => {
                const selected = item === value;
                return (
                  <TouchableOpacity
                    style={[styles.modalOption, selected && styles.modalOptionSelected]}
                    onPress={() => {
                      onSelect(item);
                      setVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        selected && styles.modalOptionTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
