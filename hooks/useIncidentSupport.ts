import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { fetchIncidentEngagement, type IncidentEngagement } from '../lib/publicIncidents';

/**
 * Support (upvote) toggle for a public incident post. The server returns the
 * authoritative counts, which the caller stores so cards and sheets agree.
 */
export function useIncidentSupport(onEngagementChange: (incidentCaseId: string, engagement: IncidentEngagement) => void) {
  const pendingIds = useRef(new Set<string>());
  const [busyId, setBusyId] = useState<string | null>(null);

  const toggleSupport = useCallback(async (incidentCaseId: string) => {
    // Ignore repeat taps while the same post is saving.
    if (pendingIds.current.has(incidentCaseId)) return;
    pendingIds.current.add(incidentCaseId);
    setBusyId(incidentCaseId);
    try {
      const result = await fetchIncidentEngagement(incidentCaseId, true);
      if (result.engagement) {
        onEngagementChange(incidentCaseId, result.engagement);
        return;
      }
      Alert.alert('Support not saved', result.error ?? 'Could not save your support. Please try again.');
    } finally {
      pendingIds.current.delete(incidentCaseId);
      setBusyId((current) => (current === incidentCaseId ? null : current));
    }
  }, [onEngagementChange]);

  return { toggleSupport, busyId };
}
