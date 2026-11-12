import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import { listOfficialInvites, type InviteListItem } from '../lib/invites';
import {
  isAdminInviteSnapshotFresh,
  isInviteActiveAt,
  nextInviteExpiryTransition,
  shouldApplyInviteListResult,
} from '../lib/adminInvitePolicy';

type ReloadOptions = { force?: boolean };

type AdminInvitesState = {
  active: InviteListItem[];
  used: InviteListItem[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastLoadedAt: number | null;
  now: number;
  reload: (options?: ReloadOptions) => Promise<void>;
  removeActiveInvite: (inviteId: string) => void;
  refreshAfterMutation: () => Promise<void>;
};

type AdminInvitesProviderProps = PropsWithChildren<{
  userId: string;
  onAccessDenied: () => void;
}>;

type InFlightRequest = {
  id: number;
  promise: Promise<void>;
  mutationVersion: number;
};

const AdminInvitesContext = createContext<AdminInvitesState | null>(null);

function getReadableError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Could not load invitations. Check your connection and retry.';
}

export function AdminInvitesProvider({
  children,
  userId,
  onAccessDenied,
}: AdminInvitesProviderProps) {
  const [activeRows, setActiveRows] = useState<InviteListItem[]>([]);
  const [usedRows, setUsedRows] = useState<InviteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  const userIdRef = useRef(userId);
  const generationRef = useRef(0);
  const mutationVersionRef = useRef(0);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const inFlightRef = useRef<InFlightRequest | null>(null);
  const reloadRef = useRef<((options?: ReloadOptions) => Promise<void>) | null>(null);
  const lastLoadedAtRef = useRef<number | null>(null);
  const revokedInviteIdsRef = useRef(new Set<string>());
  const onAccessDeniedRef = useRef(onAccessDenied);

  useEffect(() => {
    onAccessDeniedRef.current = onAccessDenied;
  }, [onAccessDenied]);

  useEffect(() => {
    if (userIdRef.current === userId) return;
    userIdRef.current = userId;
    generationRef.current += 1;
    mutationVersionRef.current = 0;
    lastLoadedAtRef.current = null;
    revokedInviteIdsRef.current = new Set<string>();
    inFlightRef.current = null;
    setActiveRows([]);
    setUsedRows([]);
    setLoading(true);
    setRefreshing(false);
    setError(null);
    setLastLoadedAt(null);
  }, [userId]);

  const clearProtectedSnapshot = useCallback(() => {
    generationRef.current += 1;
    lastLoadedAtRef.current = null;
    setActiveRows([]);
    setUsedRows([]);
    setError(null);
    setLastLoadedAt(null);
  }, []);

  const reload = useCallback(async (options: ReloadOptions = {}) => {
    if (!mountedRef.current) return;
    const force = options.force === true;
    const requestGeneration = generationRef.current;
    const requestUserId = userIdRef.current;
    const existingRequest = inFlightRef.current;

    if (existingRequest) {
      if (
        !shouldApplyInviteListResult(
          existingRequest.mutationVersion,
          mutationVersionRef.current,
        )
      ) {
        // Let the pre-mutation read settle, ignore its result, then reconcile once.
        await existingRequest.promise;
        if (requestGeneration === generationRef.current) {
          await reloadRef.current?.({ force: true });
        }
        return;
      }
      return existingRequest.promise;
    }

    if (
      !force &&
      isAdminInviteSnapshotFresh(lastLoadedAtRef.current, Date.now())
    ) {
      return;
    }

    const requestMutationVersion = mutationVersionRef.current;
    const requestId = ++requestIdRef.current;
    if (lastLoadedAtRef.current === null) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    const requestPromise = Promise.resolve()
      .then(() => listOfficialInvites())
      .then((result) => {
        if (
          requestGeneration !== generationRef.current ||
          requestUserId !== userIdRef.current ||
          !shouldApplyInviteListResult(
            requestMutationVersion,
            mutationVersionRef.current,
          )
        ) {
          return;
        }

        if (result.accessDenied) {
          clearProtectedSnapshot();
          onAccessDeniedRef.current();
          return;
        }

        if (result.error) {
          setError(result.error);
          return;
        }

        const revokedInviteIds = revokedInviteIdsRef.current;
        const nextActiveRows = result.active.filter(
          (invite) => !revokedInviteIds.has(invite.id),
        );
        const nextUsedRows = result.used.filter(
          (invite) => !revokedInviteIds.has(invite.id),
        );
        const loadedAt = Date.now();

        setActiveRows(nextActiveRows);
        setUsedRows(nextUsedRows);
        setError(null);
        lastLoadedAtRef.current = loadedAt;
        setLastLoadedAt(loadedAt);
        setNow(loadedAt);
      })
      .catch((requestError: unknown) => {
        if (
          requestGeneration === generationRef.current &&
          requestUserId === userIdRef.current &&
          shouldApplyInviteListResult(
            requestMutationVersion,
            mutationVersionRef.current,
          )
        ) {
          setError(getReadableError(requestError));
        }
      })
      .finally(() => {
        if (inFlightRef.current?.id === requestId) {
          inFlightRef.current = null;
        }
        if (
          requestGeneration === generationRef.current &&
          shouldApplyInviteListResult(
            requestMutationVersion,
            mutationVersionRef.current,
          )
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    inFlightRef.current = {
      id: requestId,
      promise: requestPromise,
      mutationVersion: requestMutationVersion,
    };
    await requestPromise;
  }, [clearProtectedSnapshot]);

  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  const removeActiveInvite = useCallback((inviteId: string) => {
    if (!mountedRef.current) return;
    revokedInviteIdsRef.current.add(inviteId);
    setActiveRows((currentRows) =>
      currentRows.filter((invite) => invite.id !== inviteId),
    );
    setUsedRows((currentRows) =>
      currentRows.filter((invite) => invite.id !== inviteId),
    );
  }, []);

  const refreshAfterMutation = useCallback(async () => {
    if (!mountedRef.current) return;
    mutationVersionRef.current += 1;
    await reload({ force: true });
  }, [reload]);

  useEffect(() => {
    mountedRef.current = true;
    void reload();
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      inFlightRef.current = null;
    };
  }, [reload]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState !== 'active') return;
      setNow(Date.now());
      void reload();
    });
    return () => subscription.remove();
  }, [reload]);

  const active = useMemo(
    () =>
      activeRows.filter((invite) =>
        isInviteActiveAt(invite.expires_at, now),
      ),
    [activeRows, now],
  );

  const nextExpiryTransition = useMemo(
    () => nextInviteExpiryTransition(activeRows, now),
    [activeRows, now],
  );

  useEffect(() => {
    if (nextExpiryTransition === null) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, nextExpiryTransition - Date.now() + 1),
    );
    return () => clearTimeout(timer);
  }, [nextExpiryTransition, now]);

  const value = useMemo<AdminInvitesState>(
    () => ({
      active,
      used: usedRows,
      loading,
      refreshing,
      error,
      lastLoadedAt,
      now,
      reload,
      removeActiveInvite,
      refreshAfterMutation,
    }),
    [
      active,
      usedRows,
      loading,
      refreshing,
      error,
      lastLoadedAt,
      now,
      reload,
      removeActiveInvite,
      refreshAfterMutation,
    ],
  );

  return (
    <AdminInvitesContext.Provider value={value}>
      {children}
    </AdminInvitesContext.Provider>
  );
}

export function useAdminInvites(): AdminInvitesState {
  const context = useContext(AdminInvitesContext);
  if (!context) {
    throw new Error('useAdminInvites must be used inside AdminInvitesProvider.');
  }
  return context;
}
