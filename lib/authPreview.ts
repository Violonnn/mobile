import type { ForgotPasswordFlowOptions } from '../hooks/useForgotPasswordFlow';
import type { RegistrationFlowOptions } from '../hooks/useRegistrationFlow';
import { isDemoAuthEnabled } from './demoAuth';
import {
  otpInvalid,
  otpValid,
  pinMismatch,
  residentEmpty,
  residentHappyPath,
  residentInvalidName,
  residentUnderage,
  resetHappyPath,
} from './fixtures/demoResident';
import { OTP_COOLDOWN_SECONDS } from '../types/registration';

const DEMO_PHONE_INPUT = '917 555 0101';

export type RegistrationPreviewName =
  | 'phone-empty'
  | 'phone-valid'
  | 'otp-empty'
  | 'otp-invalid'
  | 'otp-cooldown'
  | 'details-empty'
  | 'details-invalid-name'
  | 'details-underage'
  | 'details-happy'
  | 'pin-short'
  | 'pin-mismatch'
  | 'pin-submitting';

export type ForgotPasswordPreviewName =
  | 'phone-valid'
  | 'otp-invalid'
  | 'otp-valid'
  | 'pin-mismatch'
  | 'pin-submitting'
  | 'pin-ready';

export function getRegistrationPreview(
  preview: RegistrationPreviewName | undefined,
): RegistrationFlowOptions {
  if (!isDemoAuthEnabled() || !preview) return {};

  const sentOtp = { initialPhone: DEMO_PHONE_INPUT, initialOtpSendCount: 1, isPreview: true };
  switch (preview) {
    case 'phone-empty': return { isPreview: true };
    case 'phone-valid': return { initialPhone: DEMO_PHONE_INPUT, isPreview: true };
    case 'otp-empty': return { initialStep: 1, ...sentOtp };
    case 'otp-invalid':
      return { initialStep: 1, ...sentOtp, initialOtp: otpInvalid, initialOtpError: 'Invalid or expired OTP. Please try again.' };
    case 'otp-cooldown':
      return { initialStep: 1, ...sentOtp, initialResendCooldown: OTP_COOLDOWN_SECONDS };
    case 'details-empty': return { initialStep: 2, initialDetails: residentEmpty, initialVerified: true, isPreview: true };
    case 'details-invalid-name': return { initialStep: 2, initialDetails: residentInvalidName, initialVerified: true, isPreview: true };
    case 'details-underage': return { initialStep: 2, initialDetails: residentUnderage, initialVerified: true, isPreview: true };
    case 'details-happy': return { initialStep: 2, initialDetails: residentHappyPath, initialVerified: true, isPreview: true };
    case 'pin-short': return { initialStep: 3, initialPhone: DEMO_PHONE_INPUT, initialPin: '12345', initialVerified: true, isPreview: true };
    case 'pin-mismatch':
      return { initialStep: 3, initialPhone: DEMO_PHONE_INPUT, initialPin: pinMismatch.pin, initialConfirmPin: pinMismatch.confirmation, initialVerified: true, isPreview: true };
    case 'pin-submitting':
      return { initialStep: 3, initialPhone: DEMO_PHONE_INPUT, initialPin: residentHappyPath.pin, initialConfirmPin: residentHappyPath.pin, initialVerified: true, initialSubmitting: true, isPreview: true };
  }
}

export function getForgotPasswordPreview(
  preview: ForgotPasswordPreviewName | undefined,
): ForgotPasswordFlowOptions {
  if (!isDemoAuthEnabled() || !preview) return {};

  const sentOtp = { initialPhone: DEMO_PHONE_INPUT, initialOtpSendCount: 1, isPreview: true };
  switch (preview) {
    case 'phone-valid': return { initialPhone: DEMO_PHONE_INPUT, isPreview: true };
    case 'otp-invalid':
      return { initialStep: 1, ...sentOtp, initialOtp: otpInvalid, initialOtpError: 'Invalid or expired OTP. Please try again.' };
    case 'otp-valid': return { initialStep: 1, ...sentOtp, initialOtp: otpValid };
    case 'pin-mismatch':
      return { initialStep: 2, initialPhone: DEMO_PHONE_INPUT, initialPin: pinMismatch.pin, initialConfirmPin: pinMismatch.confirmation, initialVerified: true, isPreview: true };
    case 'pin-submitting':
      return { initialStep: 2, initialPhone: DEMO_PHONE_INPUT, initialPin: resetHappyPath.pin, initialConfirmPin: resetHappyPath.confirmation, initialVerified: true, initialSubmitting: true, isPreview: true };
    case 'pin-ready':
      return { initialStep: 2, initialPhone: DEMO_PHONE_INPUT, initialPin: resetHappyPath.pin, initialConfirmPin: resetHappyPath.confirmation, initialVerified: true, isPreview: true };
  }
}
