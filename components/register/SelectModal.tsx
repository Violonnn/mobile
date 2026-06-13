import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { registerStyles as styles } from '../../styles/screens/register.styles';

type SelectOption = string | { label: string; value: string | number };

type Props = {
  visible: boolean;
  title: string;
  data: SelectOption[];
  onSelect: (value: string | number) => void;
  onClose: () => void;
};

function getLabel(item: SelectOption): string {
  return typeof item === 'string' ? item : item.label;
}

function getValue(item: SelectOption): string | number {
  return typeof item === 'string' ? item : item.value;
}

export default function SelectModal({ visible, title, data, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={data}
            keyExtractor={(item, index) => `${getValue(item)}-${index}`}
            ItemSeparatorComponent={() => <View style={styles.modalDivider} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  onSelect(getValue(item));
                  onClose();
                }}
              >
                <Text style={styles.modalOptionText}>{getLabel(item)}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
