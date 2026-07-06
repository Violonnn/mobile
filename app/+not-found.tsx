// app/+not-found.tsx
// Shown when user navigates to a route that doesn't exist

import { Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, fontSizes, fontWeights, radius, spacing } from "../styles/theme";
import { layout } from "../lib/layout";
import { Ionicons } from "@expo/vector-icons";

// Keep the image large but never wider than the screen on small devices.
const IMAGE_SIZE = Math.min(400, layout.screenWidth * 0.9);

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <Image
        source={require("../assets/images/not-found.png")}
        style={[styles.image, { width: IMAGE_SIZE, height: IMAGE_SIZE }]}
      />

      <Text style={styles.title}>Whoops!</Text>

      <Text style={styles.subtitle}>
        We couldn't find the page{"\n"}you were looking for.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.dismissAll()}
        activeOpacity={0.85}
      >
        <Ionicons name="home" size={18} color={colors.white} />
        <Text style={styles.buttonText}>Go Back Home</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  image: {
    resizeMode: "contain",
    marginBottom: -30,
    borderRadius: 500,
  },
  title: {
    fontSize: 52,
    fontWeight: fontWeights.extrabold,
    color: colors.textMuted,
  },
  subtitle: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 15,
    marginBottom: spacing.xl,
  },
  button: {
    backgroundColor: colors.text,
    paddingVertical: 25,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.full,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
  },
});