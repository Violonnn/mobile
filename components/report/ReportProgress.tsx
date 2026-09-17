import React from 'react';
import { Text, View } from 'react-native';
import { reportStyles as styles } from '../../styles/screens/report.styles';

type Props = {
  stepNumber: number;
  label: string;
};

export default function ReportProgress({ stepNumber, label }: Props) {
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressSteps}>
        {[1, 2, 3, 4].map((number, index) => (
          <React.Fragment key={number}>
            {index > 0 ? (
              <View
                style={[
                  styles.progressConnector,
                  number <= stepNumber && styles.progressConnectorActive,
                ]}
              />
            ) : null}
            <View
              style={[
                styles.progressDot,
                number === stepNumber && styles.progressDotCurrent,
                number < stepNumber && styles.progressDotComplete,
              ]}
            >
              {number === stepNumber ? (
                <Text style={styles.progressDotText}>{number}</Text>
              ) : null}
            </View>
          </React.Fragment>
        ))}
      </View>
      <Text style={styles.progressLabel}>
        {stepNumber} of 4 · {label.toUpperCase()}
      </Text>
    </View>
  );
}
