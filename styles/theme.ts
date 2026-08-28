// styles/theme.ts
// Shared design tokens — colors, fonts, spacing used across all screens

export const colors = {
  navigationActive: "#0F2044", // dark blue used by active navigation and the resident header
  primary: "#1A56DB",        // main blue — buttons, accents
  themeSoft: "#AAC0DC",      // soft desaturated blue — in-app header + nav highlight
  primaryLight: "#EEF2FF",   // light blue — backgrounds, badges
  secondary: "#60A5FA",      // lighter blue — highlights
  danger: "#F97316",         // orange — warning badges
  unverified: "#DC2626",     // red — report verification is still needed
  success: "#22C55E",        // green — verified badges
  purple: "#7C3AED",         // purple — weather alert icon
  white: "#FFFFFF",
  offWhite: "#FAFAF8",
  background: "#FFFFFF",     // pure white screen canvas — not used by onboarding
  card: "#FFFFFF",           // white cards
  text: "#111827",           // dark text
  textMuted: "#6B7280",      // grey subtitle text
  border: "#E5E7EB",         // light border
};

export const fontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 34,
};

export const fontWeights = {
  normal: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  extrabold: "800" as const,
};

// Sora — a clean, modern, geometric sans-serif. Minimalist and distinctive
// (not the usual system font), and versatile enough for use across the app.
// Each weight is registered as its own family name (Expo Google Fonts).
export const fonts = {
  regular: "Sora_400Regular",
  medium: "Sora_500Medium",
  semibold: "Sora_600SemiBold",
  bold: "Sora_700Bold",
  extrabold: "Sora_800ExtraBold",
  // Condensed display face for escalation card titles — elongated, modern.
  display: "BarlowCondensed_600SemiBold",
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
