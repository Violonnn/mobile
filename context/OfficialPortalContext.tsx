// context/OfficialPortalContext.tsx
// Loads active official access once and exposes scope + role kind to tabs/screens.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchActiveOfficialAccess,
  type OfficialAccessScope,
} from '../lib/officialRegistration';
import {
  officialKindFromScope,
  type OfficialKind,
} from '../lib/officialReports';

type OfficialPortalContextValue = {
  scope: OfficialAccessScope | null;
  officialKind: OfficialKind | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

const OfficialPortalContext = createContext<OfficialPortalContextValue>({
  scope: null,
  officialKind: null,
  loading: true,
  error: null,
  reload: async () => {},
});

export function OfficialPortalProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<OfficialAccessScope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { scope: accessScope, error: accessError } =
      await fetchActiveOfficialAccess();
    if (!accessScope) {
      setScope(null);
      setError(accessError || 'Could not load official access.');
      setLoading(false);
      return;
    }
    setScope(accessScope);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { scope: accessScope, error: accessError } =
        await fetchActiveOfficialAccess();
      if (cancelled) return;
      if (!accessScope) {
        setScope(null);
        setError(accessError || 'Could not load official access.');
        setLoading(false);
        return;
      }
      setScope(accessScope);
      setError(null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const officialKind = useMemo(
    () => (scope ? officialKindFromScope(scope) : null),
    [scope],
  );

  const value = useMemo(
    () => ({
      scope,
      officialKind,
      loading,
      error,
      reload,
    }),
    [scope, officialKind, loading, error, reload],
  );

  return (
    <OfficialPortalContext.Provider value={value}>
      {children}
    </OfficialPortalContext.Provider>
  );
}

export function useOfficialPortal(): OfficialPortalContextValue {
  return useContext(OfficialPortalContext);
}
