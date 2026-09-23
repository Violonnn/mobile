import type { RegistrationDetails } from '../../types/registration';

type ResidentFixture = RegistrationDetails & {
  phone: string;
  pin: string;
};

export const residentHappyPath: ResidentFixture = {
  phone: '09175550101',
  lastName: 'Dela Cruz',
  firstName: 'Juan',
  middleName: 'Santos',
  birthMonth: 6,
  birthYear: '1998',
  barangay: 'Poblacion Ward I',
  agreedToTerms: true,
  pin: '246810',
};

export const residentEmpty: RegistrationDetails = {
  lastName: '',
  firstName: '',
  middleName: '',
  birthMonth: null,
  birthYear: '',
  barangay: '',
  agreedToTerms: false,
};

export const residentUnderage: RegistrationDetails = {
  ...residentHappyPath,
  birthMonth: 12,
  birthYear: '2012',
};

export const residentInvalidName: RegistrationDetails = {
  ...residentHappyPath,
  firstName: 'Juan3',
};

export const otpValid = '123456';
export const otpInvalid = '000000';

export const pinMismatch = {
  pin: '123456',
  confirmation: '654321',
};

export const resetHappyPath = {
  phone: residentHappyPath.phone,
  pin: '135790',
  confirmation: '135790',
};
