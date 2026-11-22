import { Check, Minus, Plus } from 'lucide-react';
import {
  MAX_NOTE_LENGTH,
  SHOLAT_WAKTU_LIST,
  type IbadahDefinition,
  type IbadahItemState,
  type SholatWaktu,
} from '../constants/ibadah';
import { formatRupiah } from '../lib/dates';

interface IbadahCardProps {
  definition: IbadahDefinition;
  state: IbadahItemState;
  onChange: (nextState: IbadahItemState) => void;
}

export function IbadahCard({ definition, state, onChange }: IbadahCardProps) {
  const { id, label, subtitle, detailType } = definition;
  const { done, detail } = state;

  const handleToggleDone = () => {
    onChange({
      done: !done,
      detail,
    });
  };

  const dzikirCount = typeof detail === 'number' ? detail : 0;
  const numericDetail = typeof detail === 'number' ? detail : null;
  const noteDetail = typeof detail === 'string' ? detail : '';
  const selectedWaktu: SholatWaktu[] = Array.isArray(detail)
    ? (detail as SholatWaktu[])
    : [];

  const handleDzikirStep = (delta: number) => {
    const nextCount = Math.max(0, dzikirCount + delta);
    onChange({
      done,
      detail: nextCount === 0 ? null : nextCount,
    });
  };

  const handleNumberInput = (raw: string) => {
    const digitsOnly = raw.replace(/[^0-9]/g, '');
    if (digitsOnly === '') {
      onChange({ done, detail: null });
      return;
    }
    const parsed = Math.min(10000000000, parseInt(digitsOnly, 10));
    onChange({
      done,
      detail: Number.isNaN(parsed) ? null : parsed,
    });
  };

  const handleWaktuToggle = (waktu: SholatWaktu) => {
    const exists = selectedWaktu.includes(waktu);
    const nextList = exists
      ? selectedWaktu.filter((w) => w !== waktu)
      : [...selectedWaktu, waktu];

    onChange({
      done: nextList.length > 0 ? true : false,
      detail: nextList.length > 0 ? nextList : null,
    });
  };

  const handleNoteChange = (raw: string) => {
    const clipped = raw.slice(0, MAX_NOTE_LENGTH);
    onChange({
      done,
      detail: clipped.length > 0 ? clipped : null,
    });
  };

  return (
    <article
      className={`rounded-2xl border p-4 transition-colors ${
        done
          ? 'bg-emerald-50/55 border-emerald-200'
          : 'bg-white border-[#E6E0D4]'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={`Tandai ${label} ${done ? 'belum selesai' : 'selesai'}`}
          onClick={handleToggleDone}
          className={`flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border-2 transition-colors ${
            done
              ? 'border-emerald-700 bg-emerald-700 text-white'
              : 'border-[#C9C1B2] bg-[#FAF8F3] text-transparent hover:border-emerald-600'
          }`}
        >
          <Check className="h-5 w-5 stroke-[2.5]" aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1 pt-0.5">
          <button
            type="button"
            onClick={handleToggleDone}
            className="w-full text-left"
          >
            <h3
              className={`text-base font-semibold leading-snug ${
                done ? 'text-emerald-950' : 'text-[#1C2420]'
              }`}
            >
              {label}
            </h3>
            <p className="mt-0.5 text-xs text-[#55625B]">{subtitle}</p>
          </button>

          {detailType === 'stepper' && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-[#55625B]">
                Hitungan
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDzikirStep(-1)}
                  disabled={dzikirCount <= 0}
                  aria-label="Kurangi hitungan dzikir"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#E6E0D4] bg-white text-[#1C2420] hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="min-w-[3.25rem] text-center text-base font-semibold text-[#1C2420] tabular-nums">
                  {dzikirCount}
                </span>
                <button
                  type="button"
                  onClick={() => handleDzikirStep(1)}
                  aria-label="Tambah hitungan dzikir"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#E6E0D4] bg-white text-[#1C2420] hover:bg-emerald-50 transition-colors"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {detailType === 'pages' && (
            <div className="mt-3 flex items-center gap-2">
              <label htmlFor={`input-${id}`} className="sr-only">
                Jumlah halaman Al-Qur’an
              </label>
              <input
                id={`input-${id}`}
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
                value={numericDetail ?? ''}
                onChange={(e) => handleNumberInput(e.target.value)}
                className="min-h-[44px] w-28 rounded-xl border border-[#DDD6C8] bg-white px-3 py-2 text-sm font-medium text-[#1C2420] tabular-nums focus:border-emerald-700 focus:outline-none"
              />
              <span className="text-xs font-medium text-[#55625B]">
                halaman
              </span>
            </div>
          )}

          {detailType === 'waktu' && (
            <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Pilih waktu sholat di masjid">
              {SHOLAT_WAKTU_LIST.map((waktu) => {
                const active = selectedWaktu.includes(waktu);
                return (
                  <button
                    key={waktu}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleWaktuToggle(waktu)}
                    className={`min-h-[40px] rounded-xl px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-emerald-700 text-white'
                        : 'bg-white border border-[#DDD6C8] text-[#1C2420] hover:border-emerald-400'
                    }`}
                  >
                    {waktu}
                  </button>
                );
              })}
            </div>
          )}

          {detailType === 'rakaat' && (
            <div className="mt-3 flex items-center gap-2">
              <label htmlFor={`input-${id}`} className="sr-only">
                Jumlah rakaat sholat malam
              </label>
              <input
                id={`input-${id}`}
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
                value={numericDetail ?? ''}
                onChange={(e) => handleNumberInput(e.target.value)}
                className="min-h-[44px] w-28 rounded-xl border border-[#DDD6C8] bg-white px-3 py-2 text-sm font-medium text-[#1C2420] tabular-nums focus:border-emerald-700 focus:outline-none"
              />
              <span className="text-xs font-medium text-[#55625B]">
                rakaat
              </span>
            </div>
          )}

          {detailType === 'note' && (
            <div className="mt-3">
              <label htmlFor={`input-${id}`} className="sr-only">
                Catatan {label}
              </label>
              <input
                id={`input-${id}`}
                type="text"
                maxLength={MAX_NOTE_LENGTH}
                placeholder="Tulis catatan singkat (opsional)…"
                value={noteDetail}
                onChange={(e) => handleNoteChange(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-[#DDD6C8] bg-white px-3 py-2 text-sm text-[#1C2420] placeholder:text-[#8A948E] focus:border-emerald-700 focus:outline-none"
              />
              <div className="mt-1 text-right text-[11px] text-[#6B7670] tabular-nums">
                {noteDetail.length}/{MAX_NOTE_LENGTH}
              </div>
            </div>
          )}

          {detailType === 'rupiah' && (
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#55625B]">Rp</span>
                <label htmlFor={`input-${id}`} className="sr-only">
                  Nominal sedekah dalam Rupiah
                </label>
                <input
                  id={`input-${id}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="0"
                  value={numericDetail ?? ''}
                  onChange={(e) => handleNumberInput(e.target.value)}
                  className="min-h-[44px] w-full max-w-[190px] rounded-xl border border-[#DDD6C8] bg-white px-3 py-2 text-sm font-medium text-[#1C2420] tabular-nums focus:border-emerald-700 focus:outline-none"
                />
              </div>
              {numericDetail !== null && numericDetail > 0 && (
                <p className="mt-1 text-xs text-emerald-800 tabular-nums">
                  {formatRupiah(numericDetail)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
