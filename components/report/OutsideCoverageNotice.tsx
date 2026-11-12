import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchActiveHotlines, openHotlineDialer, type HotlineRecord } from '../../lib/resources';
import { colors, fonts, radius, spacing } from '../../styles/theme';

export default function OutsideCoverageNotice({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [hotlines, setHotlines] = useState<HotlineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [previousRetry, setPreviousRetry] = useState(retry);
  if (retry !== previousRetry) {
    setPreviousRetry(retry);
    setLoading(true);
    setError(null);
  }
  useEffect(() => {
    let cancelled = false;
    void fetchActiveHotlines().then((result) => {
      if (cancelled) return;
      setHotlines(result.hotlines.filter((hotline) => hotline.barangayId === null));
      setError(result.error);
    }).catch(() => { if (!cancelled) setError('Could not load emergency contacts.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retry]);
  async function dial(number: string) {
    const result = await openHotlineDialer(number);
    if (result.error) setError(result.error);
  }
  return <View style={styles.card}>
    <Text style={styles.title}>Outside coverage</Text>
    <Text style={styles.body}>This location appears to be outside DisasterLink&apos;s coverage area. It was not sent to any office.</Text>
    <Text style={styles.body}>For urgent assistance, call an emergency hotline. If you believe the coverage check is wrong, contact MDRRMO.</Text>
    <TouchableOpacity accessibilityRole='button' onPress={() => void dial('911')} style={styles.button}><Text style={styles.link}>National emergency hotline · 911</Text></TouchableOpacity>
    {loading && <ActivityIndicator color={colors.primary} accessibilityLabel='Loading local emergency contacts' />}
    {hotlines.filter((hotline) => hotline.number !== '911').map((hotline) => <TouchableOpacity key={hotline.id} accessibilityRole='button' onPress={() => void dial(hotline.number)} style={styles.button}><Text style={styles.link}>{hotline.name} · {hotline.number}</Text></TouchableOpacity>)}
    {!loading && !hotlines.some((hotline) => /mdrrmo/i.test(hotline.name)) && <Text style={styles.body}>An MDRRMO number is not available here. Check the municipality&apos;s official contact directory.</Text>}
    {error && <><Text accessibilityRole='alert' style={styles.body}>{error}</Text><TouchableOpacity accessibilityRole='button' onPress={() => setRetry((value) => value + 1)} style={styles.button}><Text style={styles.link}>Reload contacts</Text></TouchableOpacity></>}
    <TouchableOpacity accessibilityRole='button' onPress={onClose} style={styles.button}><Text style={styles.link}>Close</Text></TouchableOpacity>
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: spacing.md, gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primaryLight },
  title: { fontFamily: fonts.semibold, fontSize: 18, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  button: { paddingVertical: spacing.sm },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
});
