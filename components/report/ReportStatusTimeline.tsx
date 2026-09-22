import React, { type ComponentProps, useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  lineToNextColor: string | null;
};

type ReportStatusTimelineProps = {
  status: string;
  barangayLabel?: string;
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

function buildTimeline(
  status: string,
  barangayLabel: string,
  activeColor: string,
): TimelineStep[] {
  const normalizedStatus = status.trim().toLocaleLowerCase();
  const underReviewStep: TimelineStep = {
    label: 'Under review',
    name: barangayLabel,
    complete: false,
    current: true,
    lineToNextColor: colors.unverified,
  };
  const confirmedStep: TimelineStep = {
    label: 'Confirmed',
    name: 'Response ongoing',
    complete: false,
    current: false,
    lineToNextColor: null,
  };
  const resolvedStep: TimelineStep = {
    label: 'Resolved',
    name: 'Awaiting response',
    complete: false,
    current: false,
    lineToNextColor: null,
  };

  if (normalizedStatus === 'verified') {
    return [
      {
        ...underReviewStep,
        complete: true,
        current: false,
        lineToNextColor: COMPLETED_TIMELINE_COLOR,
      },
      {
        ...confirmedStep,
        complete: true,
        current: true,
        lineToNextColor: activeColor,
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
        lineToNextColor: COMPLETED_TIMELINE_COLOR,
      },
      {
        ...confirmedStep,
        complete: true,
        current: false,
        lineToNextColor: COMPLETED_TIMELINE_COLOR,
      },
      {
        label: 'Municipal review',
        name: 'Requiring Municipal Assistance',
        complete: false,
        current: true,
        lineToNextColor: colors.escalated,
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
        lineToNextColor: COMPLETED_TIMELINE_COLOR,
      },
      {
        ...confirmedStep,
        complete: true,
        current: false,
        lineToNextColor: COMPLETED_TIMELINE_COLOR,
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

export default function ReportStatusTimeline({
  status,
  barangayLabel = 'Barangay review',
  style,
}: ReportStatusTimelineProps) {
  const statusPresentation = useMemo(() => getReportStatusPresentation(status), [status]);
  const timeline = useMemo(
    () => buildTimeline(status, barangayLabel, statusPresentation.color),
    [barangayLabel, status, statusPresentation.color],
  );
  const currentTimelineIndex = timeline.findIndex((step) => step.current);

  return (
    <View style={[styles.timeline, style]}>
      {timeline.map((step, index) => {
        const previousStep = timeline[index - 1];
        const previousLineColor = previousStep?.lineToNextColor ?? PENDING_TIMELINE_COLOR;
        const nextLineColor = step.lineToNextColor ?? PENDING_TIMELINE_COLOR;
        const isNextTimelineStep = index === currentTimelineIndex + 1;

        return (
          <View key={step.label} style={styles.step}>
            <View style={styles.markerRow}>
              {index > 0 ? (
                <View style={[styles.connector, { backgroundColor: previousLineColor }]} />
              ) : (
                <View style={styles.connectorSpacer} />
              )}
              <View
                style={[
                  styles.dot,
                  step.complete && styles.dotComplete,
                  !step.complete && styles.dotPending,
                  step.current && { backgroundColor: statusPresentation.color },
                ]}
              >
                <Ionicons name={timelineIconName(step.label)} size={13} color={colors.white} />
              </View>
              {index < timeline.length - 1 ? (
                <View style={[styles.connector, { backgroundColor: nextLineColor }]} />
              ) : (
                <View style={styles.connectorSpacer} />
              )}
            </View>
            <Text
              style={[
                styles.label,
                step.complete && !step.current && styles.completeText,
                step.current && { color: statusPresentation.color },
              ]}
            >
              {step.label}
            </Text>
            {step.name && !isNextTimelineStep ? (
              <Text
                style={[
                  styles.name,
                  step.complete && !step.current && styles.completeText,
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
  dotComplete: {
    backgroundColor: 'rgba(15, 32, 68, 0.22)',
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
