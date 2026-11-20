import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../styles/theme';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { reportOperationsStyles as operationStyles } from '../../styles/components/reportOperations.styles';

/** Shared disclosure layout, with a rail for steps and a separate utility variant. */
export default function OperationTimelineStep({
  title,
  summary,
  icon,
  current = false,
  last = false,
  defaultExpanded = false,
  collapsible = true,
  utility = false,
  showSummary = true,
  compactCurrentStep = false,
  compactHeading = false,
  mediumSummary = false,
  children,
}: {
  title: string;
  summary: string;
  icon: keyof typeof Ionicons.glyphMap;
  current?: boolean;
  last?: boolean;
  defaultExpanded?: boolean;
  collapsible?: boolean;
  utility?: boolean;
  showSummary?: boolean;
  compactCurrentStep?: boolean;
  compactHeading?: boolean;
  mediumSummary?: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState<boolean | null>(null);
  // A newly current step overrides a previous manual collapse.
  const open = current || !collapsible || (expanded ?? defaultExpanded);
  const heading = (
    <>
      <View style={[operationStyles.rowCopy, compactHeading && operationStyles.rowCopyCompact]}>
        {current && <Text style={operationStyles.eyebrow}>CURRENT STEP</Text>}
        <Text style={styles.sectionTitle}>{title}</Text>
        {showSummary ? (
          <Text style={[
            operationStyles.caption,
            compactHeading && operationStyles.summaryTitle,
            mediumSummary && operationStyles.summaryMedium,
          ]}>
            {summary}
          </Text>
        ) : null}
      </View>
      {!current && collapsible && (
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      )}
    </>
  );
  return (
    <View
      style={utility
        ? operationStyles.utilityArea
        : styles.reportMetaTimelineItem}
    >
      {!utility && (
        <View style={styles.reportMetaTimelineMarker}>
          <View
            style={[
              styles.reportMetaTimelineIcon,
              current && styles.reportMetaTimelineIconCurrent,
              current && operationStyles.currentStepMarker,
            ]}
          >
            <Ionicons
              name={icon}
              size={current ? 24 : 18}
              color={colors.navigationActive}
            />
          </View>
          {!last && <View style={styles.reportMetaTimelineLine} />}
        </View>
      )}
      <View
        style={[
          utility ? operationStyles.section : operationStyles.stepContent,
          !utility && compactHeading && operationStyles.stepContentCompact,
          current && operationStyles.currentStepContent,
          current && compactCurrentStep && operationStyles.currentStepContentCompact,
        ]}
      >
        {current || !collapsible
          ? <View style={[operationStyles.stepHeading, compactHeading && operationStyles.stepHeadingCompact]}>{heading}</View>
          : (
            <TouchableOpacity
              style={[operationStyles.stepHeading, compactHeading && operationStyles.stepHeadingCompact]}
              accessibilityRole='button'
              accessibilityState={{ expanded: open }}
              onPress={() => setExpanded(!open)}
            >
              {heading}
            </TouchableOpacity>
          )}
        <View style={!open && operationStyles.collapsedStep}>{children}</View>
      </View>
    </View>
  );
}
