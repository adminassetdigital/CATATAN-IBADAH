import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateLongId } from '../lib/dates';

interface DayHeaderProps {
  selectedDate: string;
  todayKey: string;
  doneCount: number;
  totalCount: number;
  onPrevDay: () => void;
  onNextDay: () => void;
  onGoToday: () => void;
}

function getEncouragementMessage(doneCount: number, isToday: boolean): string {
  if (doneCount === 0) {
    return isToday
      ? 'Mulai dari langkah kecil yang paling ringan hari ini.'
      : 'Belum ada catatan pada hari ini. Kamu tetap bisa mengisinya.';
  }
  if (doneCount < 4) {
    return 'Langkah awal yang baik. Teruskan dengan tenang.';
  }
  if (doneCount < 8) {
    return 'Konsisten menjaga kebiasaan baik hari demi hari.';
  }
  return 'Semua 8 ibadah tercatat lengkap pada tanggal ini.';
}

export function DayHeader({
  selectedDate,
  todayKey,
  doneCount,
  totalCount,
  onPrevDay,
  onNextDay,
  onGoToday,
}: DayHeaderProps) {
  const isToday = selectedDate === todayKey;
  const canGoNext = selectedDate < todayKey;
  const progressPct = Math.round((doneCount / totalCount) * 100);

  return (
    <section
      aria-label="Navigasi tanggal dan progres ibadah"
      className="rounded-2xl bg-white border border-[#E6E0D4] p-4 shadow-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrevDay}
          aria-label="Hari sebelumnya"
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-[#E6E0D4] bg-[#FAF8F3] text-[#1C2420] hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1 text-center px-1">
          <h2 className="text-sm font-semibold text-[#1C2420] leading-snug">
            {formatDateLongId(selectedDate)}
          </h2>
          {!isToday && (
            <button
              type="button"
              onClick={onGoToday}
              className="mt-1 inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors"
            >
              Hari ini
            </button>
          )}
          {isToday && (
            <button
              type="button"
              onClick={onGoToday}
              aria-label="Hari ini"
              className="mt-0.5 text-xs font-medium text-emerald-700"
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
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-[#E6E0D4] bg-[#FAF8F3] text-[#1C2420] hover:bg-emerald-50 hover:border-emerald-200 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-[#FAF8F3] transition-colors"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 pt-3.5 border-t border-[#EFECE4]">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-[#1C2420] tabular-nums">
            {doneCount} dari {totalCount} ibadah
          </span>
          <span className="text-xs font-medium text-emerald-800 tabular-nums">
            {progressPct}%
          </span>
        </div>

        <div
          className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[#EFECE4]"
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-label={`${doneCount} dari ${totalCount} ibadah selesai`}
        >
          <div
            className="h-full rounded-full bg-emerald-700 transition-all duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <p className="mt-2 text-xs text-[#55625B]">
          {getEncouragementMessage(doneCount, isToday)}
        </p>
      </div>
    </section>
  );
}
