import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerStyles as styles, registerColors } from '../../styles/screens/register.styles';
import { RegistrationDetails } from '../../types/registration';
import LabeledInput from './LabeledInput';
import BarangayDropdown from './BarangayDropdown';
import SelectModal from './SelectModal';
import LegalModal from './LegalModal';
import FieldError from './FieldError';

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

const ERROR_REQUIRED_FIELDS = 'Please fill in all required fields.';
const ERROR_MIN_AGE = 'You must be 18 years or older to register.';
const ERROR_TERMS = 'You must agree to the Terms & Conditions.';

type FieldErrors = {
  lastName?: string;
  firstName?: string;
  birthMonth?: string;
  birthYear?: string;
  barangay?: string;
  terms?: string;
};

function computeAge(birthYear: string, birthMonth: number | null): number | null {
  if (!birthYear || birthMonth == null) return null;
  const yearNum = parseInt(birthYear, 10);
  if (Number.isNaN(yearNum)) return null;
  const currentMonth = new Date().getMonth() + 1;
  let age = currentYear - yearNum;
  if (currentMonth < birthMonth) age--;
  return age;
}

interface DetailsStepProps {
  details: RegistrationDetails;
  onUpdateDetails: (patch: Partial<RegistrationDetails>) => void;
  onSubmit: () => void;
}

export default function DetailsStep({ details, onUpdateDetails, onSubmit }: DetailsStepProps) {
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showLegal, setShowLegal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    lastName,
    firstName,
    middleName,
    birthYear,
    birthMonth,
    barangay,
    agreedToTerms,
  } = details;

  useEffect(() => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      let changed = false;

      if (lastName && next.lastName) {
        delete next.lastName;
        changed = true;
      }
      if (firstName && next.firstName) {
        delete next.firstName;
        changed = true;
      }
      if (birthMonth && next.birthMonth && next.birthMonth !== ERROR_MIN_AGE) {
        delete next.birthMonth;
        changed = true;
      }
      if (birthYear && next.birthYear && next.birthYear !== ERROR_MIN_AGE) {
        delete next.birthYear;
        changed = true;
      }
      if (barangay && next.barangay) {
        delete next.barangay;
        changed = true;
      }
      if (agreedToTerms && next.terms) {
        delete next.terms;
        changed = true;
      }

      if (changed && Object.keys(next).length === 0) {
        setError('');
      }

      return changed ? next : prev;
    });
  }, [lastName, firstName, birthYear, birthMonth, barangay, agreedToTerms]);

  function validateAndSubmit() {
    const nextErrors: FieldErrors = {};

    if (!lastName) nextErrors.lastName = 'Last name is required.';
    if (!firstName) nextErrors.firstName = 'First name is required.';
    if (!birthMonth) nextErrors.birthMonth = 'Select your birth month.';
    if (!birthYear) nextErrors.birthYear = 'Select your birth year.';
    if (!barangay) nextErrors.barangay = 'Select your barangay.';

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError(ERROR_REQUIRED_FIELDS);
      return;
    }

    const age = computeAge(birthYear, birthMonth);
    if (age === null || age < 18) {
      setFieldErrors({
        birthMonth: ERROR_MIN_AGE,
        birthYear: ERROR_MIN_AGE,
      });
      setError(ERROR_MIN_AGE);
      return;
    }

    if (!agreedToTerms) {
      setFieldErrors({ terms: ERROR_TERMS });
      setError(ERROR_TERMS);
      return;
    }

    setError('');
    setFieldErrors({});
    setSubmitting(true);
    onSubmit();
  }

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Account Information</Text>
      <Text style={styles.otpTargetText}>Enter your details to create your account</Text>

      <LabeledInput
        label="Last Name"
        placeholder="e.g. Dela Cruz"
        value={lastName}
        onChangeText={(text) => onUpdateDetails({ lastName: text })}
        leadingIcon="person-outline"
        error={fieldErrors.lastName}
      />
      <LabeledInput
        label="First Name"
        placeholder="e.g. Juan"
        value={firstName}
        onChangeText={(text) => onUpdateDetails({ firstName: text })}
        leadingIcon="person-outline"
        error={fieldErrors.firstName}
      />
      <LabeledInput
        label="Middle Name"
        placeholder="Optional"
        value={middleName}
        onChangeText={(text) => onUpdateDetails({ middleName: text })}
        leadingIcon="person-outline"
      />

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text style={styles.label}>Birth Month</Text>
          <TouchableOpacity
            style={[
              styles.input,
              styles.dropdownInput,
              !!fieldErrors.birthMonth && styles.inputError,
            ]}
            onPress={() => setShowMonthDropdown(true)}
          >
            <Ionicons name="calendar-outline" size={18} color={registerColors.textLight} />
            <Text style={{ color: birthMonth ? registerColors.text : '#aaa', flex: 1, marginLeft: 8 }}>
              {birthMonth ? MONTHS.find((m) => m.value === birthMonth)?.label : 'Select'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
          <FieldError message={fieldErrors.birthMonth ?? ''} />
        </View>

        <View style={styles.flex1}>
          <Text style={styles.label}>Birth Year</Text>
          <TouchableOpacity
            style={[
              styles.input,
              styles.dropdownInput,
              !!fieldErrors.birthYear && styles.inputError,
            ]}
            onPress={() => setShowYearDropdown(true)}
          >
            <Ionicons name="calendar-outline" size={18} color={registerColors.textLight} />
            <Text style={{ color: birthYear ? registerColors.text : '#aaa', flex: 1, marginLeft: 8 }}>
              {birthYear || 'Select'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
          <FieldError message={fieldErrors.birthYear ?? ''} />
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Barangay</Text>
        <BarangayDropdown
          value={barangay}
          options={MINGLANILLA_BARANGAYS}
          onSelect={(value) => onUpdateDetails({ barangay: value })}
          hasError={!!fieldErrors.barangay}
        />
        <FieldError message={fieldErrors.barangay ?? ''} />
      </View>

      <TouchableOpacity
        style={styles.modernCheckboxContainer}
        onPress={() => {
          if (agreedToTerms) {
            onUpdateDetails({ agreedToTerms: false });
          } else {
            setShowLegal(true);
          }
        }}
      >
        <View
          style={[
            styles.circularCheckbox,
            agreedToTerms && styles.circularCheckboxActive,
            !!fieldErrors.terms && styles.checkboxError,
          ]}
        >
          {agreedToTerms && <Ionicons name="checkmark" size={12} color="white" />}
        </View>
        <Text style={styles.checkboxText}>
          I agree to the <Text style={styles.linkText}>Terms & Conditions</Text> and{' '}
          <Text style={styles.linkText}>Privacy Policy</Text>
        </Text>
      </TouchableOpacity>
      <FieldError message={fieldErrors.terms ?? ''} />

      {!!error && <FieldError message={error} />}

      <TouchableOpacity
        style={styles.modernButton}
        onPress={validateAndSubmit}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color={registerColors.white} />
        ) : (
          <Text style={styles.modernButtonText}>PROCEED</Text>
        )}
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
      <LegalModal
        visible={showLegal}
        onAccept={() => {
          onUpdateDetails({ agreedToTerms: true });
          setShowLegal(false);
        }}
      />
    </View>
  );
}
