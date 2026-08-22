import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const isClientRuntime = typeof window !== "undefined";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Expo Router also renders routes in Node, where AsyncStorage cannot access window.
    storage: isClientRuntime ? AsyncStorage : undefined,
    autoRefreshToken: isClientRuntime,
    persistSession: isClientRuntime,
    detectSessionInUrl: false,
  },
});
