import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_PHONE_KEY = 'disasterlink_saved_phone';

export async function getSavedPhone(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(SAVED_PHONE_KEY);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

export async function setSavedPhone(digits: string): Promise<void> {
  try {
    const trimmed = digits.trim();
    if (!trimmed) {
      await AsyncStorage.removeItem(SAVED_PHONE_KEY);
      return;
    }
    await AsyncStorage.setItem(SAVED_PHONE_KEY, trimmed);
  } catch {
    // Non-critical — login still works without persistence
  }
}
