import React from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mdrrmoCommandStyles as styles } from '../../styles/screens/mdrrmoCommand.styles';

export type ResourceCreateType = 'hotline' | 'facility' | 'center';

type ResourceTypePickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: ResourceCreateType) => void;
};

const OPTIONS: {
  type: ResourceCreateType;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  { type: 'hotline', title: 'Hotline', subtitle: 'Publish a verified emergency number', icon: 'call-outline', color: '#F04438' },
  { type: 'facility', title: 'Facility', subtitle: 'Add a hospital, station, or public service', icon: 'business-outline', color: '#146EF5' },
  { type: 'center', title: 'Evacuation center', subtitle: 'Create a shelter and set its capacity', icon: 'home-outline', color: '#169B55' },
];

export default function ResourceTypePickerSheet({ visible, onClose, onSelect }: ResourceTypePickerSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetOverline}>NEW PUBLIC RESOURCE</Text>
          <Text style={styles.sheetTitle}>What are you adding?</Text>
          <Text style={styles.sheetSubtitle}>Choose the information residents should see during an emergency.</Text>
          {OPTIONS.map((option) => (
            <TouchableOpacity key={option.type} style={styles.pickerRow} onPress={() => onSelect(option.type)}>
              <View style={styles.pickerIcon}>
                <Ionicons name={option.icon} size={34} color={option.color} />
              </View>
              <View style={styles.pickerCopy}>
                <Text style={styles.pickerTitle}>{option.title}</Text>
                <Text style={styles.pickerSubtitle}>{option.subtitle}</Text>
              </View>
              <Ionicons name="arrow-forward" size={24} color="#111827" />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
