import { useRef, useState, type ChangeEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Lock,
  LogOut,
  Smartphone,
  Trash2,
  Upload,
} from 'lucide-react';
import type { ExportPayload } from '../constants/ibadah';
import { getTodayKey } from '../lib/dates';
import {
  deleteAllUserData,
  fetchAllUserDataForExport,
  importUserData,
  validateImportPayload,
} from '../lib/db';
import {
  deleteAllLocalData,
  exportLocalData,
  importLocalData,
} from '../lib/localStore';

interface PengaturanProps {
  user: User | null;
  signingIn: boolean;
  authError: string | null;
  onSignIn: () => Promise<void>;
  onLogout: () => Promise<void>;
  onClearAuthError: () => void;
}

function getInitials(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.trim() || 'U';
  const parts = source.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function Pengaturan({
  user,
  signingIn,
  authError,
  onSignIn,
  onLogout,
  onClearAuthError,
}: PengaturanProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<ExportPayload | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>('');

  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deletingAll, setDeletingAll] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleExport = async () => {
    setFeedback(null);
    setExporting(true);
    try {
      const payload = user
        ? await fetchAllUserDataForExport(user.uid)
        : exportLocalData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `catatan-ibadah-${getTodayKey()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setFeedback({
        type: 'success',
        message: `Berhasil mengekspor ${Object.keys(payload.days).length} hari ibadah dan ${payload.jurnal.length} entri syukur.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Gagal mengekspor data JSON.',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    setFeedback(null);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) {
      return;
    }

    try {
      const rawText = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        setFeedback({
          type: 'error',
          message: 'File yang dipilih bukan format JSON yang valid.',
        });
        return;
      }

      const validation = validateImportPayload(parsed);
      if (validation.ok === false) {
        setFeedback({
          type: 'error',
          message: validation.error,
        });
        return;
      }

      setPendingImport(validation.data);
      setPendingFileName(file.name);
      setDeleteStep(0);
    } catch {
      setFeedback({
        type: 'error',
        message: 'Gagal membaca file JSON yang dipilih.',
      });
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImport) {
      return;
    }
    setFeedback(null);
    setImporting(true);
    try {
      if (user) {
        await importUserData(user.uid, pendingImport);
      } else {
        importLocalData(pendingImport);
      }
      const dayCount = Object.keys(pendingImport.days).length;
      const jurnalCount = pendingImport.jurnal.length;
      setPendingImport(null);
      setPendingFileName('');
      setFeedback({
        type: 'success',
        message: `Impor selesai: ${dayCount} hari ibadah dan ${jurnalCount} entri syukur dipulihkan.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Gagal mengimpor data JSON.',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteAll = async () => {
    setFeedback(null);
    setDeletingAll(true);
    try {
      if (user) {
        await deleteAllUserData(user.uid);
      } else {
        deleteAllLocalData();
      }
      setDeleteStep(0);
      setFeedback({
        type: 'success',
        message: 'Seluruh data ibadah dan jurnal syukur telah dihapus.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Gagal menghapus semua data.',
      });
    } finally {
      setDeletingAll(false);
    }
  };

  const showPhoto = Boolean(user?.photoURL) && !imgFailed;

  return (
    <div className="space-y-4">
      {user ? (
        <section className="rounded-2xl bg-white border border-[#E6E0D4] p-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            {showPhoto ? (
              <img
                src={user.photoURL ?? ''}
                alt={user.displayName ?? 'Foto profil akun Google'}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="h-14 w-14 shrink-0 rounded-full border border-[#E6E0D4] object-cover"
              />
            ) : (
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-800 text-base font-semibold text-white"
                aria-hidden="true"
              >
                {getInitials(user.displayName, user.email)}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-[#1C2420] truncate">
                {user.displayName || 'Pengguna Google'}
              </h2>
              <p className="text-xs text-[#55625B] truncate">{user.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void onLogout()}
            className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#DDD6C8] bg-[#FAF8F3] px-4 py-2.5 text-sm font-medium text-[#1C2420] hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Keluar</span>
          </button>
        </section>
      ) : (
        <section className="rounded-2xl bg-white border border-[#E6E0D4] p-4 shadow-xs space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Smartphone className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-[#1C2420]">
                Penyimpanan Perangkat (Tanpa Login)
              </h2>
              <p className="mt-0.5 text-xs text-[#55625B] leading-relaxed">
                Aplikasi langsung siap dipakai. Catatan tersimpan di browser
                perangkat ini, atau kamu bisa menghubungkan akun Google secara
                opsional untuk sinkronisasi antar perangkat.
              </p>
            </div>
          </div>

          {authError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900 space-y-1"
            >
              <p className="font-medium">{authError}</p>
              <button
                type="button"
                onClick={onClearAuthError}
                className="font-medium text-red-700 underline underline-offset-2"
              >
                Tutup
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => void onSignIn()}
            disabled={signingIn}
            className="flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-xl border border-[#DDD6C8] bg-[#FAF8F3] px-4 py-2.5 text-sm font-semibold text-[#1C2420] hover:bg-emerald-50 hover:border-emerald-200 disabled:opacity-50 transition-colors"
          >
            {signingIn ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-emerald-700" aria-hidden="true" />
                <span>Menghubungkan ke Google…</span>
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                <span>Sinkron dengan Google (Opsional)</span>
              </>
            )}
          </button>
        </section>
      )}

      {feedback && (
        <div
          role="status"
          className={`rounded-2xl border p-4 text-sm flex items-start gap-2.5 ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2
              className="h-5 w-5 shrink-0 text-emerald-700 mt-0.5"
              aria-hidden="true"
            />
          ) : (
            <AlertTriangle
              className="h-5 w-5 shrink-0 text-red-700 mt-0.5"
              aria-hidden="true"
            />
          )}
          <p className="min-w-0 flex-1 leading-relaxed">{feedback.message}</p>
        </div>
      )}

      <section className="rounded-2xl bg-white border border-[#E6E0D4] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#1C2420]">
          Cadangkan & Pulihkan Data
        </h3>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || importing || deletingAll}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{exporting ? 'Mengekspor…' : 'Ekspor JSON'}</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={exporting || importing || deletingAll}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#DDD6C8] bg-[#FAF8F3] px-4 py-2.5 text-sm font-semibold text-[#1C2420] hover:bg-emerald-50 hover:border-emerald-200 disabled:opacity-50 transition-colors"
          >
            <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Impor JSON</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileSelected}
            className="hidden"
            aria-label="Pilih file cadangan JSON"
          />
        </div>

        {pendingImport && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 space-y-2.5">
            <p className="text-xs font-semibold text-amber-950">
              Konfirmasi Impor Data
            </p>
            <p className="text-xs text-amber-900 leading-relaxed">
              File <span className="font-medium">{pendingFileName}</span> berisi{' '}
              <span className="font-semibold tabular-nums">
                {Object.keys(pendingImport.days).length}
              </span>{' '}
              hari ibadah dan{' '}
              <span className="font-semibold tabular-nums">
                {pendingImport.jurnal.length}
              </span>{' '}
              entri syukur. Mengimpor akan menimpa seluruh data saat ini.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingImport(null);
                  setPendingFileName('');
                }}
                disabled={importing}
                className="min-h-[40px] rounded-xl border border-[#DDD6C8] bg-white px-3.5 py-1.5 text-xs font-medium text-[#1C2420] hover:bg-[#FAF8F3]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing}
                className="min-h-[40px] rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {importing ? 'Mengimpor…' : 'Timpa & Impor'}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white border border-[#E6E0D4] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#1C2420]">
          Hapus Seluruh Data
        </h3>
        <p className="text-xs text-[#55625B] leading-relaxed">
          Menghapus semua catatan 8 ibadah dan jurnal syukur secara permanen.
        </p>

        {deleteStep === 0 && (
          <button
            type="button"
            onClick={() => {
              setPendingImport(null);
              setFeedback(null);
              setDeleteStep(1);
            }}
            disabled={deletingAll || importing || exporting}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Hapus Semua Data</span>
          </button>
        )}

        {deleteStep === 1 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 space-y-2.5">
            <p className="text-xs font-semibold text-red-900">
              Langkah 1 dari 2: Yakin ingin menghapus semua data?
            </p>
            <p className="text-xs text-red-800 leading-relaxed">
              Sebaiknya ekspor cadangan JSON terlebih dahulu sebelum menghapus.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteStep(0)}
                className="min-h-[40px] rounded-xl border border-[#DDD6C8] bg-white px-3.5 py-1.5 text-xs font-medium text-[#1C2420]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => setDeleteStep(2)}
                className="min-h-[40px] rounded-xl bg-red-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
              >
                Lanjutkan
              </button>
            </div>
          </div>
        )}

        {deleteStep === 2 && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-3.5 space-y-2.5">
            <p className="text-xs font-semibold text-red-950">
              Langkah 2 dari 2: Konfirmasi Terakhir
            </p>
            <p className="text-xs text-red-900 leading-relaxed">
              Tindakan ini tidak dapat dibatalkan. Semua catatan ibadah dan
              jurnal syukur akan dihapus permanen.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteStep(0)}
                disabled={deletingAll}
                className="min-h-[40px] rounded-xl border border-[#DDD6C8] bg-white px-3.5 py-1.5 text-xs font-medium text-[#1C2420]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className="min-h-[40px] rounded-xl bg-red-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {deletingAll ? 'Menghapus…' : 'Ya, Hapus Permanen'}
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="px-2 pb-2 text-center text-xs text-[#55625B] leading-relaxed">
        {user
          ? 'Data tersimpan di akun Google-mu lewat Firebase dan tersinkron antar perangkat.'
          : 'Data tersimpan secara lokal di perangkat ini. Masuk dengan Google kapan saja bila ingin sinkronisasi antar perangkat.'}
      </p>
    </div>
  );
}
