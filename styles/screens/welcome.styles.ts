// styles/screens/welcome.styles.ts
// Styles specific to the Welcome / Landing screen only

import { StyleSheet, Dimensions } from "react-native";
import { colors, fontSizes, fontWeights, radius, spacing } from "../theme";

const { width, height } = Dimensions.get("window");

export const styles = StyleSheet.create({

  // ─── Root ───────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },

  // ─── Header / Logo ──────────────────────────────────────
  header: {
    alignItems: "center",
    paddingTop: 100,
  },
  logo: {
    width: 180,
    height: 120,
    resizeMode: "contain",
  },


  // ─── Hero Text ──────────────────────────────────────────
  heroSection: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    alignItems: "center",
  },
  heroTitle: {
    fontSize: fontSizes.xxxl,
    fontWeight: fontWeights.extrabold,
    color: colors.text,
    textAlign: "center",
    lineHeight: 42,
  },
  heroTitleAccent: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.extrabold,
    color: colors.primary,
    textAlign: "center",
    lineHeight: 42,
  },
  heroSubtitle: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },

 
  Concept: {
  position: "relative",
  width: width * 0.9,
  aspectRatio: 1.2,         
  backgroundColor: colors.primaryLight,
  borderRadius: 40,
  overflow: "hidden",
  alignSelf: "center",
  marginBottom: spacing.xl,
},

conceptImage: {
  width: "100%",
  height: "100%",
  resizeMode: "cover",
  position: "absolute",  
  top: 0,                 
  left: 0,               
},
  
 featuresRow: {
  flexDirection: "row",
  justifyContent: "space-around",
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
  backgroundColor: colors.card,
  marginHorizontal: spacing.lg,
  borderRadius: radius.lg,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 6,
  elevation: 2,
  marginBottom: spacing.lg,
},
featureItem: {
  alignItems: "center",
  flex: 1,
},

featureLabel: {
  fontSize: fontSizes.xs,
  color: colors.textMuted,
  textAlign: "center",
  lineHeight: 16,
  fontWeight: fontWeights.medium,
},
featureIconImage: {
  width: 40,
  height: 40,
  resizeMode: "contain",
  marginBottom: spacing.xs,
},

buttonsSection: {
  paddingHorizontal: spacing.xl,
  gap: spacing.md,
  paddingBottom: spacing.lg,
},

getStartedButton: {
  paddingVertical: 20,
  borderRadius: radius.full,    
  alignItems: "center",
  shadowColor: colors.text,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.35,
  shadowRadius: 12,
  elevation: 8,
  flexDirection: "row",
  justifyContent: "center",
  gap: 8,
},
getStartedText: {
  color: colors.white,
  fontSize: fontSizes.lg,
  fontWeight: fontWeights.bold,
  letterSpacing: 0.5,
},

loginButton: {
  paddingVertical: 20,
  borderRadius: radius.full,
  alignItems: "center",
  borderWidth: 1.5,
  borderColor: colors.primary,
  backgroundColor: colors.primaryLight, 
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 6,
  elevation: 2,
},
loginText: {
  color: colors.primary,
  fontSize: fontSizes.lg,
  fontWeight: fontWeights.semibold,
  letterSpacing: 0.3,
},

guestButton: {
  paddingVertical: spacing.sm,
  alignItems: "center",
},
guestText: {
  color: colors.textMuted,            
  fontSize: fontSizes.md,
  fontWeight: fontWeights.medium,
  textDecorationLine: "underline",    
  letterSpacing: 0.2,
},
});
