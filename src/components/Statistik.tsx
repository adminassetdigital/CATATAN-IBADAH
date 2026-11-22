import { useMemo } from 'react';
import { BookOpen, Coins, Flame } from 'lucide-react';
import { IBADAH_IDS, IBADAH_LIST, type DayRecord } from '../constants/ibadah';
import {
  addDaysToKey,
  formatDayWeekdayShort,
  formatMonthYearId,
  formatRupiah,
  getCurrentMonthPrefix,
  getLastNDaysKeys,
  getTodayKey,
} from '../lib/dates';

interface StatistikProps {
  days: Record<string, DayRecord>;
  loading: boolean;
}

function countCompletedItems(record: DayRecord | undefined): number {
  if (!record) {
    return 0;
  }
  let count = 0;
  for (const id of IBADAH_IDS) {
    if (record.items[id]?.done) {
      count += 1;
    }
  }
  return count;
}

export function Statistik({ days, loading }: StatistikProps) {
  const todayKey = getTodayKey();
  const monthPrefix = getCurrentMonthPrefix();
  const currentMonthLabel = formatMonthYearId();

  const stats = useMemo(() => {
    // 1. Streak: hari berturut-turut dengan minimal 1 ibadah selesai.
    // Jika hari ini belum ada yang selesai, hitung mundur mulai kemarin
    // agar streak aktif tidak terputus sebelum hari berakhir.
    let streak = 0;
    const todayDone = countCompletedItems(days[todayKey]) > 0;
    let cursor = todayDone ? todayKey : addDaysToKey(todayKey, -1);

    for (let i = 0; i < 400; i++) {
      if (countCompletedItems(days[cursor]) > 0) {
        streak += 1;
        cursor = addDaysToKey(cursor, -1);
      } else {
        break;
      }
    }

    // 2. Grafik batang 7 hari terakhir
    const last7Keys = getLastNDaysKeys(7, todayKey);
    const last7Days = last7Keys.map((dateKey) => ({
      dateKey,
      label: formatDayWeekdayShort(dateKey),
      dayNum: Number(dateKey.slice(8, 10)),
      doneCount: countCompletedItems(days[dateKey]),
    }));

    // 3. Persentase penyelesaian tiap ibadah dalam 30 hari terakhir
    const last30Keys = getLastNDaysKeys(30, todayKey);
    const perIbadah30Days = IBADAH_LIST.map((def) => {
      let completedDays = 0;
      for (const key of last30Keys) {
        if (days[key]?.items[def.id]?.done) {
          completedDays += 1;
        }
      }
      const percentage = Math.round((completedDays / 30) * 100);
      return {
        id: def.id,
        label: def.label,
        completedDays,
        percentage,
      };
    });

    // 4. Total halaman Al-Qur'an & total sedekah bulan berjalan
    let monthlyQuranPages = 0;
    let monthlySedekah = 0;
    for (const [dateKey, record] of Object.entries(days)) {
      if (!dateKey.startsWith(monthPrefix)) {
        continue;
      }
      const quranItem = record.items.quran;
      if (quranItem?.done && typeof quranItem.detail === 'number') {
        monthlyQuranPages += quranItem.detail;
      }
      const sedekahItem = record.items.sedekah;
      if (sedekahItem?.done && typeof sedekahItem.detail === 'number') {
        monthlySedekah += sedekahItem.detail;
      }
    }

    return {
      streak,
      todayDone,
      last7Days,
      perIbadah30Days,
      monthlyQuranPages,
      monthlySedekah,
    };
  }, [days, todayKey, monthPrefix]);

  if (loading && Object.keys(days).length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-[#E6E0D4] p-6 text-center text-sm text-[#55625B]">
        Menghitung statistik ibadah…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white border border-[#E6E0D4] p-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Flame className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#55625B]">
              Streak Saat Ini
            </p>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[#1C2420] tabular-nums">
                {stats.streak}
              </span>
              <span className="text-sm font-medium text-[#55625B]">
                hari berturut-turut
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#6B7670]">
              {stats.streak === 0
                ? 'Mulai satu ibadah hari ini untuk membangun streak pertamamu.'
                : stats.todayDone
                ? 'Hari ini sudah tercatat. Pertahankan ritme baikmu.'
                : 'Catat minimal 1 ibadah hari ini untuk melanjutkan streak.'}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white border border-[#E6E0D4] p-4">
          <div className="flex items-center gap-2 text-emerald-800">
            <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-xs font-medium text-[#55625B] truncate">
              Al-Qur’an
            </span>
          </div>
          <p className="mt-2 text-xl font-bold text-[#1C2420] tabular-nums">
            {stats.monthlyQuranPages}
            <span className="ml-1 text-xs font-medium text-[#55625B]">
              hlm
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-[#6B7670] truncate">
            {currentMonthLabel}
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-[#E6E0D4] p-4">
          <div className="flex items-center gap-2 text-emerald-800">
            <Coins className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-xs font-medium text-[#55625B] truncate">
              Sedekah
            </span>
          </div>
          <p className="mt-2 text-lg font-bold text-[#1C2420] tabular-nums break-words">
            {formatRupiah(stats.monthlySedekah)}
          </p>
          <p className="mt-0.5 text-[11px] text-[#6B7670] truncate">
            {currentMonthLabel}
          </p>
        </div>
      </section>

      <section
        aria-label="Grafik 7 hari terakhir"
        className="rounded-2xl bg-white border border-[#E6E0D4] p-4"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#1C2420]">
            7 Hari Terakhir
          </h2>
          <span className="text-xs text-[#6B7670]">Maks. 8 ibadah/hari</span>
        </div>

        <div
          className="mt-4 grid grid-cols-7 gap-2 items-end"
          role="img"
          aria-label="Grafik batang jumlah ibadah selesai selama 7 hari terakhir"
        >
          {stats.last7Days.map((day) => {
            const heightPct = Math.round((day.doneCount / 8) * 100);
            const isToday = day.dateKey === todayKey;
            return (
              <div
                key={day.dateKey}
                className="flex flex-col items-center gap-1.5"
              >
                <span className="text-[11px] font-medium text-[#55625B] tabular-nums">
                  {day.doneCount}
                </span>
                <div className="h-24 w-full max-w-[30px] rounded-lg bg-[#F3EFE6] flex items-end overflow-hidden">
                  <div
                    className={`w-full rounded-t-md transition-all duration-300 ${
                      day.doneCount > 0
                        ? isToday
                          ? 'bg-emerald-700'
                          : 'bg-emerald-600/80'
                        : 'bg-transparent'
                    }`}
                    style={{
                      height: day.doneCount > 0 ? `${Math.max(10, heightPct)}%` : '0%',
                    }}
                  />
                </div>
                <div className="text-center leading-tight">
                  <div
                    className={`text-[11px] ${
                      isToday
                        ? 'font-semibold text-emerald-800'
                        : 'text-[#55625B]'
                    }`}
                  >
                    {day.label}
                  </div>
                  <div className="text-[10px] text-[#7D8781] tabular-nums">
                    {day.dayNum}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section
        aria-label="Persentase 30 hari terakhir per ibadah"
        className="rounded-2xl bg-white border border-[#E6E0D4] p-4"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#1C2420]">
            Konsistensi 30 Hari Terakhir
          </h2>
          <span className="text-xs text-[#6B7670]">30 hari</span>
        </div>

        <div className="mt-3.5 space-y-3">
          {stats.perIbadah30Days.map((item) => (
            <div key={item.id}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-medium text-[#1C2420] truncate">
                  {item.label}
                </span>
                <span className="shrink-0 text-[#55625B] tabular-nums">
                  {item.percentage}% ({item.completedDays}/30)
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#EFECE4]">
                <div
                  className="h-full rounded-full bg-emerald-700 transition-all duration-300"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
