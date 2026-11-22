import { useCallback, useEffect, useState } from 'react';
import type { JurnalEntry } from '../constants/ibadah';
import {
  createJurnalEntry,
  deleteJurnalEntry,
  subscribeJurnal,
  updateJurnalEntry,
} from '../lib/db';
import {
  createLocalJurnalEntry,
  deleteLocalJurnalEntry,
  readLocalJurnal,
  updateLocalJurnalEntry,
} from '../lib/localStore';

export interface UseJurnalResult {
  entries: JurnalEntry[];
  loading: boolean;
  error: string | null;
  hasPendingWrites: boolean;
  addEntry: (dateKey: string, text: string) => Promise<void>;
  editEntry: (entryId: string, text: string) => Promise<void>;
  removeEntry: (entryId: string) => Promise<void>;
  clearError: () => void;
}

export function useJurnal(uid: string | null): UseJurnalResult {
  const [entries, setEntries] = useState<JurnalEntry[]>(() =>
    readLocalJurnal()
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPendingWrites, setHasPendingWrites] = useState<boolean>(false);

  useEffect(() => {
    if (!uid) {
      setEntries(readLocalJurnal());
      setLoading(false);
      setError(null);
      setHasPendingWrites(false);

      const handleLocalChange = () => {
        setEntries(readLocalJurnal());
      };
      window.addEventListener('cih-local-data-changed', handleLocalChange);
      return () => {
        window.removeEventListener('cih-local-data-changed', handleLocalChange);
      };
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeJurnal(
      uid,
      (nextEntries, pendingWrites) => {
        setEntries(nextEntries);
        setHasPendingWrites(pendingWrites);
        setLoading(false);
      },
      (errMsg) => {
        setError(errMsg);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  const addEntry = useCallback(
    async (dateKey: string, text: string) => {
      setError(null);
      if (!uid) {
        const next = createLocalJurnalEntry(dateKey, text);
        setEntries(next);
        return;
      }
      try {
        await createJurnalEntry(uid, dateKey, text);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Gagal menyimpan entri syukur.';
        setError(msg);
        throw err;
      }
    },
    [uid]
  );

  const editEntry = useCallback(
    async (entryId: string, text: string) => {
      setError(null);
      if (!uid) {
        const next = updateLocalJurnalEntry(entryId, text);
        setEntries(next);
        return;
      }
      try {
        await updateJurnalEntry(uid, entryId, text);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Gagal memperbarui entri syukur.';
        setError(msg);
        throw err;
      }
    },
    [uid]
  );

  const removeEntry = useCallback(
    async (entryId: string) => {
      setError(null);
      if (!uid) {
        const next = deleteLocalJurnalEntry(entryId);
        setEntries(next);
        return;
      }
      try {
        await deleteJurnalEntry(uid, entryId);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Gagal menghapus entri syukur.';
        setError(msg);
        throw err;
      }
    },
    [uid]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    entries,
    loading,
    error,
    hasPendingWrites,
    addEntry,
    editEntry,
    removeEntry,
    clearError,
  };
}
