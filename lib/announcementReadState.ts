import AsyncStorage from '@react-native-async-storage/async-storage';

const READ_ANNOUNCEMENTS_KEY = 'resident-feed-read-announcements-v1';

export async function loadReadAnnouncementIds(): Promise<Set<string>> {
  try {
    const storedValue = await AsyncStorage.getItem(READ_ANNOUNCEMENTS_KEY);
    if (!storedValue) return new Set();

    const parsedValue: unknown = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return new Set();
    return new Set(parsedValue.filter((item): item is string => typeof item === 'string'));
  } catch {
    return new Set();
  }
}

export async function saveReadAnnouncementIds(ids: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(READ_ANNOUNCEMENTS_KEY, JSON.stringify([...ids]));
  } catch {
    // Read receipts are a convenience only; announcement loading must still work.
  }
}
