import assert from 'node:assert/strict';
import test from 'node:test';
import {
  completeDemoPinReset,
  completeDemoRegistration,
  DEMO_AUTH_INVALID_OTP_MESSAGE,
  clearDemoOtpState,
  isDemoAuthEnabledFor,
  requestDemoOtp,
  resetDemoAuthStateForTests,
  verifyDemoOtp,
} from '../lib/demoAuth.ts';

test('demo auth requires both a development build and the exact public flag', () => {
  assert.equal(isDemoAuthEnabledFor({ isDevelopment: true, publicFlag: 'true' }), true);
  assert.equal(isDemoAuthEnabledFor({ isDevelopment: false, publicFlag: 'true' }), false);
  assert.equal(isDemoAuthEnabledFor({ isDevelopment: true, publicFlag: 'TRUE' }), false);
  assert.equal(isDemoAuthEnabledFor({ isDevelopment: true, publicFlag: undefined }), false);
});

test('demo OTP verification is deterministic', () => {
  assert.deepEqual(verifyDemoOtp('123456'), { error: null });
  assert.deepEqual(verifyDemoOtp('000000'), { error: DEMO_AUTH_INVALID_OTP_MESSAGE });
});

test('demo completion helpers return success without a service dependency', () => {
  assert.deepEqual(completeDemoRegistration(), { error: null });
  assert.deepEqual(completeDemoPinReset(), { error: null });
});

test('demo sends apply the existing limit and reset when a flow is left', () => {
  resetDemoAuthStateForTests();

  assert.equal(requestDemoOtp('registration', '+639175550101').sendCount, 1);
  assert.equal(requestDemoOtp('registration', '+639175550101').sendCount, 2);
  const lastAllowedSend = requestDemoOtp('registration', '+639175550101');
  assert.equal(lastAllowedSend.sendCount, 3);
  assert.equal(lastAllowedSend.limitReached, true);
  assert.equal(
    requestDemoOtp('registration', '+639175550101').error,
    'Too many OTP requests. Please try again later.',
  );

  assert.equal(requestDemoOtp('registration', '+639175550102').sendCount, 1);

  clearDemoOtpState('registration');
  assert.equal(requestDemoOtp('registration', '+639175550101').sendCount, 1);
});
