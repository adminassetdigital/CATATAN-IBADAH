import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CloudOff,
  HardDrive,
  Loader2,
} from 'lucide-react';
import {
  IBADAH_IDS,
  IBADAH_LIST,
  type IbadahId,
  type IbadahItemState,
  type SyncStatus,
  type TabId,
} from './constants/ibadah';
import { DayHeader } from './components/DayHeader';
import { ErrorBoundary } from './components/ErrorBoundary';
import { IbadahCard } from './components/IbadahCard';
import { JurnalSyukur } from './components/JurnalSyukur';
import { Pengaturan } from './components/Pengaturan';
import { Statistik } from './components/Statistik';
import { TabBar } from './components/TabBar';
import { useAuth } from './hooks/useAuth';
import { useDays } from './hooks/useDays';
import { useJurnal } from './hooks/useJurnal';
import { addDaysToKey, getTodayKey } from './lib/dates';
import { testConnection } from './lib/firebase';

function SyncIndicator({ status }: { status: SyncStatus }) {
  switch (status) {
    case 'Menyimpan…':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium text-amber-800 whitespace-nowrap shrink-0">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          <span>Menyimpan…</span>
        </span>
      );
    case 'Offline (akan disinkronkan)':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium text-amber-900 whitespace-nowrap shrink-0">
          <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Offline (akan disinkronkan)</span>
        </span>
      );
    case 'Gagal menyimpan':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium text-red-700 whitespace-nowrap shrink-0">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Gagal menyimpan</span>
        </span>
      );
    case 'Tersimpan lokal':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium text-emerald-800 whitespace-nowrap shrink-0">
          <HardDrive className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Tersimpan lokal</span>
        </span>
      );
    case 'Tersimpan':
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium text-emerald-800 whitespace-nowrap shrink-0">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Tersimpan</span>
        </span>
      );
  }
}

function MainApp() {
  const {
    user,
    signingIn,
    authError,
    signInWithGoogle,
    logout,
    clearAuthError,
  } = useAuth();
  const uid = user?.uid ?? null;

  const [activeTab, setActiveTab] = useState<TabId>('hari_ini');
  const [todayKey, setTodayKey] = useState<string>(() => getTodayKey());
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayKey());

  useEffect(() => {
    if (uid) {
      void testConnection();
    }
  }, [uid]);

  useEffect(() => {
    const syncToday = () => {
      const latestToday = getTodayKey();
      setTodayKey((prevToday) => {
        if (prevToday !== latestToday) {
          setSelectedDate((prevSel) =>
            prevSel === prevToday ? latestToday : prevSel
          );
          return latestToday;
        }
        return prevToday;
      });
    };

    const intervalId = setInterval(syncToday, 60_000);
    window.addEventListener('focus', syncToday);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', syncToday);
    };
  }, []);

  const {
    days,
    loading: daysLoading,
    error: daysError,
    syncStatus: daysSyncStatus,
    updateIbadahItem,
    clearError: clearDaysError,
  } = useDays(uid);

  const {
    entries: jurnalEntries,
    loading: jurnalLoading,
    error: jurnalError,
    hasPendingWrites: jurnalPendingWrites,
    addEntry,
    editEntry,
    removeEntry,
    clearError: clearJurnalError,
  } = useJurnal(uid);

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const effectiveSyncStatus: SyncStatus = (() => {
    if (!uid) {
      return 'Tersimpan lokal';
    }
    if (daysSyncStatus === 'Gagal menyimpan') {
      return 'Gagal menyimpan';
    }
    if (!isOnline) {
      return 'Offline (akan disinkronkan)';
    }
    if (daysSyncStatus === 'Menyimpan…' || jurnalPendingWrites) {
      return 'Menyimpan…';
    }
    return 'Tersimpan';
  })();

  const handlePrevDay = useCallback(() => {
    setSelectedDate((prev) => addDaysToKey(prev, -1));
  }, []);

  const handleNextDay = useCallback(() => {
    setSelectedDate((prev) => {
      if (prev >= todayKey) {
        return prev;
      }
      const next = addDaysToKey(prev, 1);
      return next > todayKey ? todayKey : next;
    });
  }, [todayKey]);

  const handleGoToday = useCallback(() => {
    setSelectedDate(todayKey);
  }, [todayKey]);

  const selectedDayItems = days[selectedDate]?.items ?? {};
  let doneCount = 0;
  for (const id of IBADAH_IDS) {
    if (selectedDayItems[id]?.done) {
      doneCount += 1;
    }
  }

  const handleItemChange = useCallback(
    (ibadahId: IbadahId, nextState: IbadahItemState) => {
      updateIbadahItem(selectedDate, ibadahId, nextState);
    },
    [selectedDate, updateIbadahItem]
  );

  const activeError = daysError || jurnalError;

  return (
    <div className="min-h-screen bg-[#FAF8F3] pb-20">
      <header className="sticky top-0 z-20 border-b border-[#E6E0D4] bg-[#FAF8F3]/95 backdrop-blur-md">
        <div className="mx-auto flex h-13 max-w-md items-center justify-between gap-2 px-4">
          <h1 className="text-sm sm:text-base font-bold tracking-tight text-[#1C2420] truncate">
            Catatan Ibadah Harian
          </h1>
          <SyncIndicator status={effectiveSyncStatus} />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-4 space-y-4">
        {activeError && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-3.5 flex items-start gap-2.5"
          >
            <AlertCircle
              className="h-4 w-4 shrink-0 text-red-700 mt-0.5"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-red-900">{activeError}</p>
              <button
                type="button"
                onClick={() => {
                  clearDaysError();
                  clearJurnalError();
                }}
                className="mt-1 text-xs font-medium text-red-700 underline underline-offset-2"
              >
                Tutup
              </button>
            </div>
          </div>
        )}

        {activeTab === 'hari_ini' && (
          <div className="space-y-3.5">
            <DayHeader
              selectedDate={selectedDate}
              todayKey={todayKey}
              doneCount={doneCount}
              totalCount={IBADAH_LIST.length}
              onPrevDay={handlePrevDay}
              onNextDay={handleNextDay}
              onGoToday={handleGoToday}
            />

            {daysLoading && Object.keys(days).length === 0 ? (
              <div className="rounded-2xl bg-white border border-[#E6E0D4] p-6 text-center text-sm text-[#55625B]">
                Memuat catatan ibadah…
              </div>
            ) : (
              <div className="space-y-2.5">
                {IBADAH_LIST.map((def) => {
                  const currentItem: IbadahItemState = selectedDayItems[
                    def.id
                  ] ?? {
                    done: false,
                    detail: null,
                  };
                  return (
                    <IbadahCard
                      key={def.id}
                      definition={def}
                      state={currentItem}
                      onChange={(nextState) =>
                        handleItemChange(def.id, nextState)
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'syukur' && (
          <JurnalSyukur
            selectedDate={selectedDate}
            todayKey={todayKey}
            entries={jurnalEntries}
            loading={jurnalLoading}
            onPrevDay={handlePrevDay}
            onNextDay={handleNextDay}
            onGoToday={handleGoToday}
            onAddEntry={addEntry}
            onEditEntry={editEntry}
            onDeleteEntry={removeEntry}
          />
        )}

        {activeTab === 'statistik' && (
          <Statistik days={days} loading={daysLoading} />
        )}

        {activeTab === 'pengaturan' && (
          <Pengaturan
            user={user}
            signingIn={signingIn}
            authError={authError}
            onSignIn={signInWithGoogle}
            onLogout={logout}
            onClearAuthError={clearAuthError}
          />
        )}
      </main>

      <TabBar activeTab={activeTab} onChangeTab={setActiveTab} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
