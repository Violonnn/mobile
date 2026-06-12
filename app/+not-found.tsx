// app/+not-found.tsx
// Shown when user navigates to a route that doesn't exist

import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Image } from "react-native";
import { useRouter } from "expo-router";
import { colors, fontSizes, fontWeights, radius, spacing } from "../styles/theme";
import { Ionicons } from "@expo/vector-icons";

const { height } = Dimensions.get("window");

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>

        {/* Image */}
      <Image
        source={require("../assets/images/not-found.png")}
        style={styles.image}
      />


      {/* Whoops */}
      <Text style={styles.title}>Whoops!</Text>
      
    
      {/* Subtitle */}
      <Text style={styles.subtitle}>
        We couldn't find the page{"\n"}you were looking for.
      </Text>

      {/* Back Button */}
      <TouchableOpacity
      
        style={styles.button}
        onPress={() => router.dismissAll()}
        activeOpacity={0.85}
      >
        <Ionicons name="home" size={18} color={colors.white} />
        <Text style={styles.buttonText}>Go Back Home</Text>
      </TouchableOpacity>

    </View>
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
    width: 400,
    height: 400,
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