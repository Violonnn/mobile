import React from 'react';
import { View, Text } from 'react-native';
import { registerStyles as styles } from '../../styles/screens/register.styles';

const STEP_LABELS = ['Phone', 'Verify', 'Details'];

type Step = 0 | 1 | 2;

export default function Stepper({ current }: { current: Step }) {
  return (
    <View style={styles.stepperWrapper}>
      <View style={styles.stepperRow}>
        {STEP_LABELS.map((label, i) => {
          const isDone = i < current;
          const isActive = i === current;
          const isLast = i === STEP_LABELS.length - 1;
          return (
            <React.Fragment key={i}>
              <View style={[
                styles.stepNode,
                isDone ? styles.stepNodeDone : isActive ? styles.stepNodeActive : styles.stepNodeInactive,
              ]}>
                {isDone
                  ? <Text style={styles.stepNodeText}>✓</Text>
                  : <Text style={[styles.stepNodeText, !isActive && styles.stepNodeTextInactive]}>{i + 1}</Text>
                }
              </View>
              {!isLast && (
                <View style={[styles.stepConnector, isDone ? styles.stepConnectorDone : styles.stepConnectorInactive]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
      <View style={styles.stepLabelsRow}>
        {STEP_LABELS.map((label, i) => (
          <Text key={i} style={[
            styles.stepLabel,
            i < current ? styles.stepLabelDone : i === current ? styles.stepLabelActive : styles.stepLabelInactive,
          ]}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}