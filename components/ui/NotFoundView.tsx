// components/ui/NotFoundView.tsx
// Reusable "page not found" placeholder. Used by the global +not-found route
// and by not-yet-built navigation tabs (feed, map, profile).

import { Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, fontSizes, fontWeights, radius, spacing } from "../../styles/theme";
import { layout } from "../../lib/layout";
import { Ionicons } from "@expo/vector-icons";

// Keep the image large but never wider than the screen on small devices.
const IMAGE_SIZE = Math.min(400, layout.screenWidth * 0.9);

type NotFoundViewProps = {
  /** Called when the user taps the primary action. Defaults to going home. */
  onGoHome?: () => void;
};

export default function NotFoundView({ onGoHome }: NotFoundViewProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onGoHome) {
      onGoHome();
      return;
    }
    router.dismissAll();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Image
        source={require("../../assets/images/not-found.png")}
        style={[styles.image, { width: IMAGE_SIZE, height: IMAGE_SIZE }]}
      />

      <Text style={styles.title}>Whoops!</Text>

      <Text style={styles.subtitle}>
        We couldn&apos;t find the page{"\n"}you were looking for.
      </Text>

      <TouchableOpacity style={styles.button} onPress={handlePress} activeOpacity={0.85}>
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
