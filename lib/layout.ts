import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const layout = {
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  isSmallScreen: SCREEN_HEIGHT < 700,
  isCompactWidth: SCREEN_WIDTH < 380,
  horizontalPadding: 24,
};

export function responsiveImageHeight(ratio = 0.24): number {
  const max = layout.isSmallScreen ? 200 : 260;
  return Math.min(max, Math.round(SCREEN_HEIGHT * ratio));
}

export function getOtpDimensions(boxCount = 6, horizontalPadding = 56) {
  const gap = layout.isCompactWidth ? 6 : 8;
  const availableWidth = SCREEN_WIDTH - horizontalPadding;
  const totalGap = gap * (boxCount - 1);
  const boxWidth = Math.floor((availableWidth - totalGap) / boxCount);
  const boxHeight = Math.min(Math.round(boxWidth * 1.12), layout.isSmallScreen ? 46 : 54);
  const fontSize = Math.min(24, Math.max(16, Math.round(boxWidth * 0.4)));
  return { boxWidth, boxHeight, gap, fontSize };
}

export function scaleByWidth(base: number, referenceWidth = 390): number {
  const scale = SCREEN_WIDTH / referenceWidth;
  return Math.round(base * Math.min(Math.max(scale, 0.82), 1.05));
}
