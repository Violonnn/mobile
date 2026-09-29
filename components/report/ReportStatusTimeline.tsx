import React, { type ComponentProps, useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { getReportStatusPresentation } from '../../lib/reports';
import { colors, fonts, radius } from '../../styles/theme';

const COMPLETED_TIMELINE_COLOR = 'rgba(15, 32, 68, 0.14)';
const PENDING_TIMELINE_COLOR = '#CBD5E1';

type TimelineIconName = ComponentProps<typeof Ionicons>['name'];

type TimelineStep = {
  label: string;
  name: string;
  complete: boolean;
  current: boolean;
  color: string;
};

type ReportStatusTimelineProps = {
  status: string;
  barangayLabel?: string;
  /** Uses full status colors for completed resident workflow stages. */
  useStatusProgressColors?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function residentReportStatusIconName(status: string): TimelineIconName {
  const normalizedStatus = status.trim().toLocaleLowerCase();
  if (normalizedStatus === 'verified') return 'location-outline';
  if (normalizedStatus === 'escalated') return 'document-text-outline';
  if (normalizedStatus === 'resolved') return 'checkmark';
  return 'time-outline';
}

function timelineIconName(label: string): TimelineIconName {
  if (label === 'Under review') return 'time-outline';
  if (label === 'Confirmed') return 'location-outline';
  if (label === 'Municipal review') return 'document-text-outline';
  return 'checkmark';
}

function buildTimeline(status: string, barangayLabel: string): TimelineStep[] {
  const normalizedStatus = status.trim().toLocaleLowerCase();
  const underReviewColor = getReportStatusPresentation('unverified').color;
  const confirmedColor = getReportStatusPresentation('verified').color;
  const municipalReviewColor = getReportStatusPresentation('escalated').color;
  const resolvedColor = getReportStatusPresentation('resolved').color;
  const underReviewStep: TimelineStep = {
    label: 'Under review',
    name: barangayLabel,
    complete: false,
    current: true,
    color: underReviewColor,
  };
  const confirmedStep: TimelineStep = {
    label: 'Confirmed',
    name: 'Response ongoing',
    complete: false,
    current: false,
    color: confirmedColor,
  };
  const resolvedStep: TimelineStep = {
    label: 'Resolved',
    name: 'Awaiting response',
    complete: false,
    current: false,
    color: resolvedColor,
  };

  if (normalizedStatus === 'verified') {
    return [
      {
        ...underReviewStep,
        complete: true,
        current: false,
      },
      {
        ...confirmedStep,
        complete: true,
        current: true,
      },
      resolvedStep,
    ];
  }

  if (normalizedStatus === 'escalated') {
    return [
      {
        ...underReviewStep,
        complete: true,
        current: false,
      },
      {
        ...confirmedStep,
        complete: true,
        current: false,
      },
      {
        label: 'Municipal review',
        name: 'Requiring Municipal Assistance',
        complete: false,
        current: true,
        color: municipalReviewColor,
      },
      resolvedStep,
    ];
  }

  if (normalizedStatus === 'resolved') {
    return [
      {
        ...underReviewStep,
        complete: true,
        current: false,
      },
      {
        ...confirmedStep,
        complete: true,
        current: false,
      },
      {
        ...resolvedStep,
        complete: true,
        current: true,
      },
    ];
  }

  return [underReviewStep, confirmedStep];
}

function blendTimelineColors(startColor: string, endColor: string): string {
  const startMatch = startColor.match(/^#([\da-f]{6})$/i);
  const endMatch = endColor.match(/^#([\da-f]{6})$/i);

  if (!startMatch || !endMatch) return endColor;

  const startValue = Number.parseInt(startMatch[1], 16);
  const endValue = Number.parseInt(endMatch[1], 16);
  const red = Math.round((((startValue >> 16) & 255) + ((endValue >> 16) & 255)) / 2);
  const green = Math.round((((startValue >> 8) & 255) + ((endValue >> 8) & 255)) / 2);
  const blue = Math.round(((startValue & 255) + (endValue & 255)) / 2);

  return `rgb(${red}, ${green}, ${blue})`;
}

function getStageDisplayColor(
  step: TimelineStep | undefined,
  useStatusProgressColors: boolean,
): string {
  if (!step || (!step.complete && !step.current)) return PENDING_TIMELINE_COLOR;
  if (useStatusProgressColors || step.current) return step.color;
  return COMPLETED_TIMELINE_COLOR;
}

export default function ReportStatusTimeline({
  status,
  barangayLabel = 'Barangay review',
  useStatusProgressColors = false,
  style,
}: ReportStatusTimelineProps) {
  const timeline = useMemo(() => buildTimeline(status, barangayLabel), [barangayLabel, status]);
  const currentTimelineIndex = timeline.findIndex((step) => step.current);

  return (
    <View style={[styles.timeline, style]}>
      {timeline.map((step, index) => {
        const previousStep = timeline[index - 1];
        const nextStep = timeline[index + 1];
        const isReached = step.complete || step.current;
        const previousColor = getStageDisplayColor(previousStep, useStatusProgressColors);
        const currentColor = getStageDisplayColor(step, useStatusProgressColors);
        const nextColor = getStageDisplayColor(nextStep, useStatusProgressColors);
        const shouldUseStageColor = isReached && (useStatusProgressColors || step.current);
        const isNextTimelineStep = index === currentTimelineIndex + 1;

        return (
          <View key={step.label} style={styles.step}>
            <View style={styles.markerRow}>
              {index > 0 ? (
                useStatusProgressColors ? (
                  <LinearGradient
                    colors={[blendTimelineColors(previousColor, currentColor), currentColor]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.connector}
                  />
                ) : (
                  <View style={[styles.connector, { backgroundColor: previousColor }]} />
                )
              ) : (
                <View style={styles.connectorSpacer} />
              )}
              <View
                style={[
                  styles.dot,
                  isReached
                    ? { backgroundColor: currentColor }
                    : styles.dotPending,
                ]}
              >
                <Ionicons name={timelineIconName(step.label)} size={13} color={colors.white} />
              </View>
              {index < timeline.length - 1 ? (
                useStatusProgressColors ? (
                  <LinearGradient
                    // Each connector is split around a node so neighboring halves share one blended midpoint.
                    colors={[currentColor, blendTimelineColors(currentColor, nextColor)]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.connector}
                  />
                ) : (
                  <View style={[styles.connector, { backgroundColor: currentColor }]} />
                )
              ) : (
                <View style={styles.connectorSpacer} />
              )}
            </View>
            <Text
              style={[
                styles.label,
                shouldUseStageColor ? { color: step.color } : step.complete && styles.completeText,
              ]}
            >
              {step.label}
            </Text>
            {step.name && !isNextTimelineStep ? (
              <Text
                style={[
                  styles.name,
                  shouldUseStageColor ? { color: step.color } : step.complete && styles.completeText,
                ]}
                numberOfLines={2}
              >
                {step.name}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: {
    minHeight: 68,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  step: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 2,
  },
  markerRow: {
    width: '100%',
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
  },
  connector: {
    height: 2,
    flex: 1,
  },
  connectorSpacer: {
    flex: 1,
  },
  dot: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: PENDING_TIMELINE_COLOR,
  },
  dotPending: {
    backgroundColor: PENDING_TIMELINE_COLOR,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.text,
    textAlign: 'center',
  },
  name: {
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 13,
    color: '#6D7B92',
    textAlign: 'center',
  },
  completeText: {
    opacity: 0.34,
  },
});
