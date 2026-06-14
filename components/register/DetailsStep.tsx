import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerStyles as styles, registerColors } from '../../styles/screens/register.styles';
import { RegistrationDetails } from '../../types/registration';
import LabeledInput from './LabeledInput';
import BarangayDropdown from './BarangayDropdown';
import SelectModal from './SelectModal';

const MINGLANILLA_BARANGAYS = [
  'Cadulawan', 'Calajo-an', 'Camp 7', 'Camp 8', 'Cuanos', 'Guindaruhan',
  'Linao-Lipata', 'Manduang', 'Pakigne', 'Poblacion Ward I',
  'Poblacion Ward II', 'Poblacion Ward III', 'Poblacion Ward IV',
  'Tubod', 'Tulay', 'Tunghaan', 'Tungkil', 'Tungkop', 'Vito',
];

const MONTHS = [
  { label: 'January', value: 1 }, { label: 'February', value: 2 },
  { label: 'March', value: 3 }, { label: 'April', value: 4 },
  { label: 'May', value: 5 }, { label: 'June', value: 6 },
  { label: 'July', value: 7 }, { label: 'August', value: 8 },
  { label: 'September', value: 9 }, { label: 'October', value: 10 },
  { label: 'November', value: 11 }, { label: 'December', value: 12 },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => (currentYear - i).toString());

interface DetailsStepProps {
  details: RegistrationDetails;
  onUpdateDetails: (patch: Partial<RegistrationDetails>) => void;
  onSubmit: () => void;
}

export default function DetailsStep({ details, onUpdateDetails, onSubmit }: DetailsStepProps) {
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [error, setError] = useState('');

  const {
    lastName,
    firstName,
    middleName,
    birthYear,
    birthMonth,
    barangay,
    agreedToTerms,
  } = details;

  function validateAndSubmit() {
    setError('');

    if (!lastName || !firstName || !birthYear || !birthMonth || !barangay) {
      setError('Please fill in all required fields.');
      return;
    }

    const yearNum = parseInt(birthYear, 10);
    const currentMonth = new Date().getMonth() + 1;
    let age = currentYear - yearNum;
    if (currentMonth < birthMonth) {
      age--;
    }

    if (age < 18) {
      setError('You must be 18 years or older to register.');
      return;
    }

    if (!agreedToTerms) {
      setError('You must agree to the Terms & Conditions.');
      return;
    }

    onSubmit();
  }

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Account Information</Text>
      <Text style={styles.otpTargetText}>
        Enter your details to create your account
      </Text>

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <LabeledInput
        label="Last Name"
        placeholder="e.g. Dela Cruz"
        value={lastName}
        onChangeText={(text) => onUpdateDetails({ lastName: text })}
      />
      <LabeledInput
        label="First Name"
        placeholder="e.g. Juan"
        value={firstName}
        onChangeText={(text) => onUpdateDetails({ firstName: text })}
      />
      <LabeledInput
        label="Middle Name"
        placeholder="Optional"
        value={middleName}
        onChangeText={(text) => onUpdateDetails({ middleName: text })}
      />

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text style={styles.label}>Birth Month</Text>
          <TouchableOpacity
            style={[styles.input, styles.dropdownInput]}
            onPress={() => setShowMonthDropdown(true)}
          >
            <Text style={{ color: birthMonth ? registerColors.text : '#aaa' }}>
              {birthMonth ? MONTHS.find((m) => m.value === birthMonth)?.label : 'Select'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.flex1}>
          <Text style={styles.label}>Birth Year</Text>
          <TouchableOpacity
            style={[styles.input, styles.dropdownInput]}
            onPress={() => setShowYearDropdown(true)}
          >
            <Text style={{ color: birthYear ? registerColors.text : '#aaa' }}>
              {birthYear || 'Select'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
        </View>
      </View>


      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Barangay</Text>
        <BarangayDropdown
          value={barangay}
          options={MINGLANILLA_BARANGAYS}
          onSelect={(value) => onUpdateDetails({ barangay: value })}
        />
      </View>

      <TouchableOpacity
        style={styles.modernCheckboxContainer}
        onPress={() => onUpdateDetails({ agreedToTerms: !agreedToTerms })}
      >
        <View style={[styles.circularCheckbox, agreedToTerms && styles.circularCheckboxActive]}>
          {agreedToTerms && <Ionicons name="checkmark" size={12} color="white" />}
        </View>
        <Text style={styles.checkboxText}>
          I agree to the <Text style={styles.linkText}>Terms & Conditions</Text> and{' '}
          <Text style={styles.linkText}>Privacy Policy</Text>
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.modernButton} onPress={validateAndSubmit}>
        <Text style={styles.modernButtonText}>PROCEED</Text>
      </TouchableOpacity>

      <SelectModal
        visible={showMonthDropdown}
        title="Select Birth Month"
        data={MONTHS}
        onSelect={(value) => onUpdateDetails({ birthMonth: Number(value) })}
        onClose={() => setShowMonthDropdown(false)}
      />
      <SelectModal
        visible={showYearDropdown}
        title="Select Birth Year"
        data={YEARS}
        onSelect={(value) => onUpdateDetails({ birthYear: String(value) })}
        onClose={() => setShowYearDropdown(false)}
      />
    </View>
  );
}
