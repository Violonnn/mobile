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
  escalated: "#B75D32",      // muted orange — report escalated to municipal response
  success: "#22C55E",        // green — verified badges
  purple: "#7C3AED",         // purple — weather alert icon
  white: "#FFFFFF",
  offWhite: "#FAFAF8",
  background: "#FFFFFF",     // pure white screen canvas — not used by onboarding
  card: "#FFFFFF",           // white cards
  text: "#1C2B4B",           // subtle dark blue — default body/title text
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

// Inter is the shared UI font, matching the resident Home screen.
// Each weight is registered as its own family name (Expo Google Fonts).
export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
  // Retained for specialized display styles while preserving the shared font.
  display: "Inter_600SemiBold",
  // Reusable section-title weight.
  section: "Inter_600SemiBold",
};

// md/lg/xl match onboarding: boxy with a slight round. full stays for
// pills, chips, and circles.
export const radius = {
  sm: 8,
  md: 12,
  lg: 12,
  xl: 12,
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
