import AsyncStorage from '@react-native-async-storage/async-storage';

export type ResidentMapTheme = 'light' | 'dark';

const RESIDENT_MAP_THEME_KEY = 'disasterlink_resident_map_theme';

export async function getResidentMapTheme(): Promise<ResidentMapTheme> {
  try {
    const storedTheme = await AsyncStorage.getItem(RESIDENT_MAP_THEME_KEY);
    return storedTheme === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export async function setResidentMapTheme(theme: ResidentMapTheme): Promise<void> {
  await AsyncStorage.setItem(RESIDENT_MAP_THEME_KEY, theme);
}
