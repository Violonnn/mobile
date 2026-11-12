import { useCallback, useEffect, useRef, useState } from 'react';

import {
  isValidReportId,
  openReporterDialer,
  requestReporterContact,
} from '../lib/officialReports';
import type { PendingReportCall } from '../lib/reportContactFlow';
import { type HotlineRecord, openHotlineDialer } from '../lib/resources';

/** Native dialers cannot reliably report whether a call happened. Show an
 * explicit follow-up after handoff instead of opening another modal over iOS. */
export function useReportCallFlow() {
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCall, setPendingCall] = useState<PendingReportCall | null>(
    null,
  );
  const requestInFlight = useRef(false);
  const pendingCallRef = useRef<PendingReportCall | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const startCall = useCallback(async (target: PendingReportCall) => {
    if (requestInFlight.current) return;
    if (pendingCallRef.current) {
      setError(
        'Finish the previous call follow-up or choose No call made first.',
      );
      return;
    }
    if (!isValidReportId(target.reportId)) {
      setError('This report is unavailable. Reload it before calling.');
      return;
    }

    requestInFlight.current = true;
    setCalling(true);
    setError(null);
    try {
      let dialerResult: { error: string | null };
      if (target.kind === 'reporter') {
        const contact = await requestReporterContact(target.reportId);
        if (!mounted.current) return;
        if (contact.error || !contact.phone) {
          setError(contact.error ?? 'Reporter contact is unavailable.');
          return;
        }
        // The full number stays inside this request, never in component state,
        // feedback, event details, or the pending-call object.
        dialerResult = await openReporterDialer(contact.phone);
      } else {
        if (!target.hotline?.isActive) {
          setError('This hotline is unavailable. Choose an active contact.');
          return;
        }
        dialerResult = await openHotlineDialer(target.hotline.number);
      }
      if (!mounted.current) return;
      if (dialerResult.error) {
        setError(dialerResult.error);
        return;
      }
      pendingCallRef.current = target;
      setPendingCall(target);
    } catch {
      if (mounted.current) {
        setError('Could not open the phone dialer. Please try again.');
      }
    } finally {
      requestInFlight.current = false;
      if (mounted.current) setCalling(false);
    }
  }, []);

  const startReporterCall = useCallback(
    (reportId: string) => startCall({ kind: 'reporter', reportId }),
    [startCall],
  );
  const startHotlineCall = useCallback(
    (hotline: HotlineRecord, reportId: string) =>
      startCall({ kind: 'hotline', reportId, hotline }),
    [startCall],
  );
  const clearPendingCall = useCallback(() => {
    pendingCallRef.current = null;
    setPendingCall(null);
    setError(null);
  }, []);
  const clearError = useCallback(() => setError(null), []);

  return {
    calling,
    error,
    pendingCall,
    startReporterCall,
    startHotlineCall,
    clearPendingCall,
    clearError,
  };
}
