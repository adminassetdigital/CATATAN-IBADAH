import { useMemo, useState, type FormEvent } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Pencil,
  Trash2,
} from 'lucide-react';
import { MAX_JURNAL_LENGTH, type JurnalEntry } from '../constants/ibadah';
import { formatDateLongId } from '../lib/dates';

interface JurnalSyukurProps {
  selectedDate: string;
  todayKey: string;
  entries: JurnalEntry[];
  loading: boolean;
  onPrevDay: () => void;
  onNextDay: () => void;
  onGoToday: () => void;
  onAddEntry: (dateKey: string, text: string) => Promise<void>;
  onEditEntry: (entryId: string, text: string) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
}

function formatTimeId(timestamp: number): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function JurnalSyukur({
  selectedDate,
  todayKey,
  entries,
  loading,
  onPrevDay,
  onNextDay,
  onGoToday,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
}: JurnalSyukurProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canGoNext = selectedDate < todayKey;
  const trimmed = text.trim();
  const canSubmit =
    trimmed.length >= 1 && text.length <= MAX_JURNAL_LENGTH && !submitting;

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, JurnalEntry[]>();
    const sorted = [...entries].sort((a, b) => {
      if (a.date !== b.date) {
        return a.date < b.date ? 1 : -1;
      }
      return b.createdAt - a.createdAt;
    });

    for (const entry of sorted) {
      const list = groups.get(entry.date);
      if (list) {
        list.push(entry);
      } else {
        groups.set(entry.date, [entry]);
      }
    }
    return Array.from(groups.entries());
  }, [entries]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await onAddEntry(selectedDate, trimmed);
      setText('');
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal menyimpan entri syukur.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (entry: JurnalEntry) => {
    setConfirmDeleteId(null);
    setEditingId(entry.id);
    setEditingText(entry.text);
    setFormError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  const handleSaveEdit = async (entryId: string) => {
    const nextTrimmed = editingText.trim();
    if (nextTrimmed.length < 1 || nextTrimmed.length > MAX_JURNAL_LENGTH) {
      return;
    }
    setSavingEdit(true);
    setFormError(null);
    try {
      await onEditEntry(entryId, nextTrimmed);
      setEditingId(null);
      setEditingText('');
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal memperbarui entri syukur.'
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async (entryId: string) => {
    setDeletingId(entryId);
    setFormError(null);
    try {
      await onDeleteEntry(entryId);
      setConfirmDeleteId(null);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal menghapus entri syukur.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white border border-[#E6E0D4] p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EFECE4]">
          <button
            type="button"
            onClick={onPrevDay}
            aria-label="Hari sebelumnya"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-[#E6E0D4] bg-[#FAF8F3] text-[#1C2420] hover:bg-emerald-50 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="min-w-0 flex-1 text-center px-1">
            <p className="text-xs text-[#55625B]">Catatan untuk</p>
            <h2 className="text-sm font-semibold text-[#1C2420] truncate">
              {formatDateLongId(selectedDate)}
            </h2>
            {selectedDate !== todayKey && (
              <button
                type="button"
                onClick={onGoToday}
                className="mt-1 inline-flex items-center justify-center rounded-lg px-2.5 py-0.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors"
              >
                Hari ini
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onNextDay}
            disabled={!canGoNext}
            aria-label="Hari berikutnya"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-[#E6E0D4] bg-[#FAF8F3] text-[#1C2420] hover:bg-emerald-50 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-3.5">
          <label htmlFor="jurnal-input" className="sr-only">
            Tulis hal yang kamu syukuri
          </label>
          <textarea
            id="jurnal-input"
            rows={3}
            maxLength={MAX_JURNAL_LENGTH}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_JURNAL_LENGTH))}
            placeholder="Hari ini aku bersyukur atas..."
            className="w-full resize-none rounded-xl border border-[#DDD6C8] bg-[#FAF8F3] px-3.5 py-3 text-sm text-[#1C2420] placeholder:text-[#828D87] focus:border-emerald-700 focus:bg-white focus:outline-none"
          />

          {formError && (
            <p role="alert" className="mt-2 text-xs font-medium text-red-700">
              {formError}
            </p>
          )}

          <div className="mt-2.5 flex items-center justify-between gap-3">
            <span className="text-xs text-[#6B7670] tabular-nums">
              {text.length}/{MAX_JURNAL_LENGTH} karakter
            </span>
            <button
              type="submit"
              disabled={!canSubmit}
              className="min-h-[44px] rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
            >
              {submitting ? 'Menyimpan…' : 'Simpan Syukur'}
            </button>
          </div>
        </form>
      </section>

      <section aria-label="Riwayat jurnal bersyukur" className="space-y-4">
        {loading && entries.length === 0 ? (
          <div className="rounded-2xl bg-white border border-[#E6E0D4] p-6 text-center text-sm text-[#55625B]">
            Memuat catatan syukur…
          </div>
        ) : groupedByDate.length === 0 ? (
          <div className="rounded-2xl bg-white border border-[#E6E0D4] p-7 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Heart className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-base font-semibold text-[#1C2420]">
              Belum ada catatan syukur
            </h3>
            <p className="mt-1.5 text-sm text-[#55625B] leading-relaxed">
              Hal kecil yang terasa hangat hari ini pun layak dicatat. Mulai
              tulis di kolom atas kapan saja kamu siap.
            </p>
          </div>
        ) : (
          groupedByDate.map(([dateKey, dayEntries]) => (
            <div key={dateKey} className="space-y-2">
              <h3 className="px-1 text-xs font-semibold text-[#55625B]">
                {formatDateLongId(dateKey)}
              </h3>
              <div className="space-y-2">
                {dayEntries.map((entry) => {
                  const isEditing = editingId === entry.id;
                  const isConfirmingDelete = confirmDeleteId === entry.id;
                  const isDeleting = deletingId === entry.id;

                  return (
                    <article
                      key={entry.id}
                      className="rounded-2xl bg-white border border-[#E6E0D4] p-4"
                    >
                      {isEditing ? (
                        <div className="space-y-2.5">
                          <label
                            htmlFor={`edit-${entry.id}`}
                            className="sr-only"
                          >
                            Edit entri syukur
                          </label>
                          <textarea
                            id={`edit-${entry.id}`}
                            rows={3}
                            maxLength={MAX_JURNAL_LENGTH}
                            value={editingText}
                            onChange={(e) =>
                              setEditingText(
                                e.target.value.slice(0, MAX_JURNAL_LENGTH)
                              )
                            }
                            className="w-full resize-none rounded-xl border border-[#DDD6C8] bg-[#FAF8F3] px-3 py-2.5 text-sm text-[#1C2420] focus:border-emerald-700 focus:bg-white focus:outline-none"
                          />
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-[#6B7670] tabular-nums">
                              {editingText.length}/{MAX_JURNAL_LENGTH}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={savingEdit}
                                className="min-h-[40px] rounded-xl border border-[#DDD6C8] px-3.5 py-1.5 text-xs font-medium text-[#1C2420] hover:bg-[#FAF8F3] transition-colors"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(entry.id)}
                                disabled={
                                  savingEdit || editingText.trim().length < 1
                                }
                                className="min-h-[40px] rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-45 transition-colors"
                              >
                                {savingEdit ? 'Menyimpan…' : 'Simpan'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-[#1C2420] leading-relaxed whitespace-pre-wrap break-words">
                            {entry.text}
                          </p>
                          <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-[#F3EFE6]">
                            <span className="text-xs text-[#6B7670] tabular-nums">
                              {formatTimeId(entry.createdAt)}
                            </span>

                            {isConfirmingDelete ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-red-700 font-medium mr-1">
                                  Hapus entri?
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  disabled={isDeleting}
                                  className="min-h-[36px] rounded-lg border border-[#DDD6C8] px-2.5 py-1 text-xs font-medium text-[#1C2420] hover:bg-[#FAF8F3]"
                                >
                                  Batal
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleConfirmDelete(entry.id)}
                                  disabled={isDeleting}
                                  className="min-h-[36px] rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                >
                                  {isDeleting ? 'Menghapus…' : 'Hapus'}
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => startEdit(entry)}
                                  aria-label="Edit catatan syukur"
                                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#55625B] hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                                >
                                  <Pencil className="h-4 w-4" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(null);
                                    setConfirmDeleteId(entry.id);
                                  }}
                                  aria-label="Hapus catatan syukur"
                                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#55625B] hover:bg-red-50 hover:text-red-700 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
