import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  DayItemsMap,
  DayRecord,
  IbadahId,
  IbadahItemState,
  SyncStatus,
} from '../constants/ibadah';
import { sanitizeItemState, saveDayItems, subscribeDays } from '../lib/db';
import { readLocalDays, saveLocalDayItem } from '../lib/localStore';

const DEBOUNCE_MS = 400;

export interface UseDaysResult {
  days: Record<string, DayRecord>;
  loading: boolean;
  error: string | null;
  syncStatus: SyncStatus;
  updateIbadahItem: (
    dateKey: string,
    ibadahId: IbadahId,
    nextState: IbadahItemState
  ) => void;
  clearError: () => void;
}

export function useDays(uid: string | null): UseDaysResult {
  const [localDays, setLocalDays] = useState<Record<string, DayRecord>>(() =>
    readLocalDays()
  );
  const [serverDays, setServerDays] = useState<Record<string, DayRecord>>({});
  const [optimisticItems, setOptimisticItems] = useState<
    Record<string, DayItemsMap>
  >({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSnapshotPending, setHasSnapshotPending] = useState<boolean>(false);
  const [pendingTimerCount, setPendingTimerCount] = useState<number>(0);
  const [inFlightCount, setInFlightCount] = useState<number>(0);
  const [writeFailed, setWriteFailed] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingPatchRef = useRef<Map<string, DayItemsMap>>(new Map());
  const uidRef = useRef<string | null>(uid);
  uidRef.current = uid;

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (uid) {
      return;
    }
    const handleLocalChange = () => {
      setLocalDays(readLocalDays());
    };
    window.addEventListener('cih-local-data-changed', handleLocalChange);
    return () => {
      window.removeEventListener('cih-local-data-changed', handleLocalChange);
    };
  }, [uid]);

  const flushDate = useCallback(async (targetUid: string, dateKey: string) => {
    const timer = timersRef.current.get(dateKey);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(dateKey);
      setPendingTimerCount(timersRef.current.size);
    }

    const patch = pendingPatchRef.current.get(dateKey);
    if (!patch || Object.keys(patch).length === 0) {
      return;
    }
    pendingPatchRef.current.delete(dateKey);

    setInFlightCount((c) => c + 1);
    setWriteFailed(false);
    try {
      await saveDayItems(targetUid, dateKey, patch);
      setError(null);
      setOptimisticItems((prev) => {
        const currentPending = pendingPatchRef.current.get(dateKey);
        if (currentPending && Object.keys(currentPending).length > 0) {
          return prev;
        }
        if (!prev[dateKey]) {
          return prev;
        }
        const next = { ...prev };
        delete next[dateKey];
        return next;
      });
    } catch (err) {
      setWriteFailed(true);
      setError(
        err instanceof Error
          ? err.message
          : 'Gagal menyimpan catatan ibadah.'
      );
    } finally {
      setInFlightCount((c) => Math.max(0, c - 1));
    }
  }, []);

  useEffect(() => {
    const timersMap = timersRef.current;
    const pendingMap = pendingPatchRef.current;

    if (!uid) {
      timersMap.forEach((t) => clearTimeout(t));
      timersMap.clear();
      pendingMap.clear();
      setServerDays({});
      setOptimisticItems({});
      setLocalDays(readLocalDays());
      setLoading(false);
      setError(null);
      setHasSnapshotPending(false);
      setPendingTimerCount(0);
      setInFlightCount(0);
      setWriteFailed(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeDays(
      uid,
      (nextDays, pendingWrites) => {
        setServerDays(nextDays);
        setHasSnapshotPending(pendingWrites);
        setLoading(false);
      },
      (errMsg) => {
        setError(errMsg);
        setLoading(false);
      }
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && uidRef.current) {
        const keys = Array.from(pendingPatchRef.current.keys());
        for (const dateKey of keys) {
          void flushDate(uidRef.current, dateKey);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      timersMap.forEach((t) => clearTimeout(t));
      timersMap.clear();
      pendingMap.clear();
      unsubscribe();
    };
  }, [uid, flushDate]);

  const updateIbadahItem = useCallback(
    (dateKey: string, ibadahId: IbadahId, nextState: IbadahItemState) => {
      const cleanState = sanitizeItemState(ibadahId, nextState);
      setWriteFailed(false);
      setError(null);

      if (!uid) {
        const nextLocal = saveLocalDayItem(dateKey, ibadahId, cleanState);
        setLocalDays(nextLocal);
        return;
      }

      setOptimisticItems((prev) => ({
        ...prev,
        [dateKey]: {
          ...(prev[dateKey] ?? {}),
          [ibadahId]: cleanState,
        },
      }));

      const prevPatch = pendingPatchRef.current.get(dateKey) ?? {};
      pendingPatchRef.current.set(dateKey, {
        ...prevPatch,
        [ibadahId]: cleanState,
      });

      const existingTimer = timersRef.current.get(dateKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const nextTimer = setTimeout(() => {
        void flushDate(uid, dateKey);
      }, DEBOUNCE_MS);
      timersRef.current.set(dateKey, nextTimer);
      setPendingTimerCount(timersRef.current.size);
    },
    [uid, flushDate]
  );

  const days = useMemo(() => {
    if (!uid) {
      return localDays;
    }
    const merged: Record<string, DayRecord> = { ...serverDays };
    for (const [dateKey, optItems] of Object.entries(optimisticItems)) {
      const existingDay = merged[dateKey];
      merged[dateKey] = {
        date: dateKey,
        items: {
          ...(existingDay?.items ?? {}),
          ...optItems,
        },
        updatedAt: existingDay?.updatedAt ?? null,
      };
    }
    return merged;
  }, [uid, localDays, serverDays, optimisticItems]);

  const syncStatus: SyncStatus = useMemo(() => {
    if (!uid) {
      return 'Tersimpan lokal';
    }
    if (writeFailed && isOnline) {
      return 'Gagal menyimpan';
    }
    if (!isOnline) {
      return 'Offline (akan disinkronkan)';
    }
    if (pendingTimerCount > 0 || inFlightCount > 0 || hasSnapshotPending) {
      return 'Menyimpan…';
    }
    return 'Tersimpan';
  }, [uid, writeFailed, isOnline, hasSnapshotPending, pendingTimerCount, inFlightCount]);

  const clearError = useCallback(() => {
    setError(null);
    setWriteFailed(false);
  }, []);

  return {
    days,
    loading,
    error,
    syncStatus,
    updateIbadahItem,
    clearError,
  };
}
