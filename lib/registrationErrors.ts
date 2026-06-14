export const PHONE_ALREADY_REGISTERED = 'This phone number is already registered.';

export function formatPhoneRegistrationError(message: string): string {
  if (/already registered/i.test(message)) {
    return PHONE_ALREADY_REGISTERED;
  }
  return message;
}
