import React, { type ReactNode } from 'react';
import { Image, Text, View } from 'react-native';
import { adminStyles as styles } from '../../styles/screens/admin.styles';

type AdminPageHeaderProps = {
  title: string;
  action?: ReactNode;
};

export default function AdminPageHeader({ title, action }: AdminPageHeaderProps) {
  return (
    <View style={styles.pageHeaderShell}>
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderIdentity}>
          <Image
            source={require('../../assets/images/mingla.png')}
            style={styles.pageHeaderMark}
            accessibilityLabel="Minglanilla municipal seal"
          />
          <View style={styles.pageHeaderCopy}>
            <Text style={styles.pageHeaderTitle}>{title}</Text>
            <Text style={styles.pageHeaderSubtitle}>Minglanilla · Admin</Text>
          </View>
        </View>
        {action ? <View style={styles.pageHeaderAction}>{action}</View> : null}
      </View>
    </View>
  );
}
