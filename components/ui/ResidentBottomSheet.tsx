import React, { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type AccessibilityActionEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createMutableNumber } from '../../lib/mutableNumber';
import { colors, radius, spacing } from '../../styles/theme';

type ResidentBottomSheetProps = {
  visible: boolean;
  children: ReactNode;
  onClose: () => void;
  initialHeightRatio?: number;
  minimumHeight?: number;
  bottomOffset?: number;
  sheetStyle?: StyleProp<ViewStyle>;
  backdropStyle?: StyleProp<ViewStyle>;
  handleAccessibilityLabel?: string;
  closeAccessibilityLabel?: string;
  animationType?: 'none' | 'slide' | 'fade';
};

const MINIMUM_VISIBLE_HEIGHT = 112;
const DRAG_THRESHOLD = 52;
const FLING_VELOCITY = 0.42;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

/**
 * Shared resident sheet with a functional handle and collapsed/full-screen snaps.
 * Only the handle owns the pan responder, so vertical content scrolling remains natural.
 */
export default function ResidentBottomSheet({
  visible,
  children,
  onClose,
  initialHeightRatio = 0.72,
  minimumHeight = 320,
  bottomOffset = 0,
  sheetStyle,
  backdropStyle,
  handleAccessibilityLabel = 'Resize panel',
  closeAccessibilityLabel = 'Close panel',
  animationType = 'fade',
}: ResidentBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const topClearance = Math.max(insets.top, spacing.sm);
  const availableHeight = Math.max(
    MINIMUM_VISIBLE_HEIGHT,
    windowHeight - topClearance - bottomOffset,
  );
  const collapsedHeight = clamp(
    availableHeight * initialHeightRatio,
    Math.min(minimumHeight, availableHeight),
    availableHeight,
  );

  const [sheetHeight] = useState(() => new Animated.Value(collapsedHeight));
  const [dragStartHeight] = useState(() => createMutableNumber(collapsedHeight));
  const [expandedValue] = useState(() => createMutableNumber());
  const [expanded, setExpanded] = useState(false);
  const [previousVisible, setPreviousVisible] = useState(visible);

  if (visible !== previousVisible) {
    setPreviousVisible(visible);
    if (visible) {
      expandedValue.write(0);
      setExpanded(false);
      sheetHeight.setValue(collapsedHeight);
    }
  }

  const animateToHeight = useCallback(
    (height: number, nextExpanded: boolean, completion?: () => void) => {
      expandedValue.write(nextExpanded ? 1 : 0);
      setExpanded(nextExpanded);
      Animated.spring(sheetHeight, {
        toValue: height,
        damping: 24,
        stiffness: 240,
        mass: 0.85,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) completion?.();
      });
    },
    [expandedValue, sheetHeight],
  );

  const expandSheet = useCallback(() => {
    animateToHeight(availableHeight, true);
  }, [animateToHeight, availableHeight]);

  const collapseSheet = useCallback(() => {
    animateToHeight(collapsedHeight, false);
  }, [animateToHeight, collapsedHeight]);

  const dismissSheet = useCallback(() => {
    expandedValue.write(0);
    setExpanded(false);
    Animated.timing(sheetHeight, {
      toValue: 0,
      duration: 160,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [expandedValue, onClose, sheetHeight]);

  useEffect(() => {
    if (!visible) return;
    sheetHeight.setValue(expandedValue.read() === 1 ? availableHeight : collapsedHeight);
  }, [availableHeight, collapsedHeight, expandedValue, sheetHeight, visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          sheetHeight.stopAnimation((currentHeight) => {
            dragStartHeight.write(currentHeight);
          });
        },
        onPanResponderMove: (_, gesture) => {
          const nextHeight = clamp(
            dragStartHeight.read() - gesture.dy,
            MINIMUM_VISIBLE_HEIGHT,
            availableHeight,
          );
          sheetHeight.setValue(nextHeight);
        },
        onPanResponderRelease: (_, gesture) => {
          sheetHeight.stopAnimation((currentHeight) => {
            const draggedUp = gesture.dy < -DRAG_THRESHOLD || gesture.vy < -FLING_VELOCITY;
            const draggedDown = gesture.dy > DRAG_THRESHOLD || gesture.vy > FLING_VELOCITY;

            if (draggedUp) {
              expandSheet();
              return;
            }

            if (draggedDown && expandedValue.read() === 1) {
              collapseSheet();
              return;
            }

            if (draggedDown || currentHeight < collapsedHeight * 0.72) {
              dismissSheet();
              return;
            }

            const expansionMidpoint = collapsedHeight + (availableHeight - collapsedHeight) / 2;
            if (currentHeight >= expansionMidpoint) {
              expandSheet();
              return;
            }

            collapseSheet();
          });
        },
        onPanResponderTerminate: collapseSheet,
      }),
    [
      availableHeight,
      collapseSheet,
      collapsedHeight,
      dismissSheet,
      dragStartHeight,
      expandedValue,
      expandSheet,
      sheetHeight,
    ],
  );

  const toggleExpanded = () => {
    if (expandedValue.read() === 1) {
      collapseSheet();
      return;
    }
    expandSheet();
  };

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') {
      expandSheet();
      return;
    }
    if (event.nativeEvent.actionName === 'decrement') {
      if (expandedValue.read() === 1) {
        collapseSheet();
        return;
      }
      dismissSheet();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      hardwareAccelerated
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={[styles.backdrop, backdropStyle]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close panel"
        />

        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
            {
              height: sheetHeight,
              marginBottom: bottomOffset,
            },
          ]}
        >
          <View style={styles.handleGestureArea} {...panResponder.panHandlers}>
            <TouchableOpacity
              style={styles.handleButton}
              onPress={toggleExpanded}
              activeOpacity={0.72}
              accessibilityRole="adjustable"
              accessibilityLabel={handleAccessibilityLabel}
              accessibilityHint="Swipe up to expand, swipe down to collapse or close"
              accessibilityState={{ expanded }}
              accessibilityActions={[
                { name: 'increment', label: 'Expand panel' },
                { name: 'decrement', label: expanded ? 'Collapse panel' : 'Close panel' },
              ]}
              onAccessibilityAction={handleAccessibilityAction}
            >
              <View style={styles.handle} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={dismissSheet}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel={closeAccessibilityLabel}
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={[styles.content, { paddingBottom: insets.bottom }]}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(17, 24, 39, 0.46)',
  },
  sheet: {
    width: '100%',
    overflow: 'hidden',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(229, 231, 235, 0.9)',
    backgroundColor: colors.white,
    ...Platform.select({
      ios: {
        shadowColor: '#111827',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  handleGestureArea: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleButton: {
    width: '100%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: '#9CA3AF',
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: spacing.md,
    zIndex: 2,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
});
