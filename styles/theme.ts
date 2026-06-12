// styles/theme.ts
// Shared design tokens — colors, fonts, spacing used across all screens

export const colors = {
  primary: "#1A56DB",        // main blue — buttons, accents
  primaryLight: "#EEF2FF",   // light blue — backgrounds, badges
  secondary: "#60A5FA",      // lighter blue — highlights
  danger: "#F97316",         // orange — warning badges
  success: "#22C55E",        // green — verified badges
  purple: "#7C3AED",         // purple — weather alert icon
  white: "#FFFFFF",
  background: "#F0F4FF",     // light blue-grey background
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