import {
  IBADAH_IDS,
  MAX_JURNAL_LENGTH,
  type DayItemsMap,
  type DayRecord,
  type ExportPayload,
  type IbadahId,
  type IbadahItemState,
  type JurnalEntry,
} from '../constants/ibadah';
import { isValidDateKey } from './dates';
import { sanitizeDayItems, sanitizeItemState } from './db';

const LOCAL_DAYS_KEY = 'cih_days_v1';
const LOCAL_JURNAL_KEY = 'cih_jurnal_v1';

export function readLocalDays(): Record<string, DayRecord> {
  try {
    const raw = window.localStorage.getItem(LOCAL_DAYS_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const result: Record<string, DayRecord> = {};
    for (const [dateKey, record] of Object.entries(
      parsed as Record<string, unknown>
    )) {
      if (!isValidDateKey(dateKey) || typeof record !== 'object' || record === null) {
        continue;
      }
      const r = record as { items?: unknown; updatedAt?: unknown };
      result[dateKey] = {
        date: dateKey,
        items: sanitizeDayItems(r.items),
        updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : Date.now(),
      };
    }
    return result;
  } catch {
    return {};
  }
}

export function writeLocalDays(days: Record<string, DayRecord>): void {
  try {
    window.localStorage.setItem(LOCAL_DAYS_KEY, JSON.stringify(days));
  } catch (err) {
    console.error('Gagal menyimpan data harian ke penyimpanan lokal:', err);
  }
}

export function saveLocalDayItem(
  dateKey: string,
  ibadahId: IbadahId,
  nextState: IbadahItemState
): Record<string, DayRecord> {
  const current = readLocalDays();
  const existingDay = current[dateKey];
  const cleanState = sanitizeItemState(ibadahId, nextState);
  const nextDays: Record<string, DayRecord> = {
    ...current,
    [dateKey]: {
      date: dateKey,
      items: {
        ...(existingDay?.items ?? {}),
        [ibadahId]: cleanState,
      },
      updatedAt: Date.now(),
    },
  };
  writeLocalDays(nextDays);
  return nextDays;
}

export function readLocalJurnal(): JurnalEntry[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_JURNAL_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const entries: JurnalEntry[] = [];
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) {
        continue;
      }
      const e = item as Record<string, unknown>;
      if (
        typeof e.id === 'string' &&
        e.id.length > 0 &&
        isValidDateKey(e.date) &&
        typeof e.text === 'string' &&
        e.text.trim().length >= 1 &&
        typeof e.createdAt === 'number' &&
        typeof e.updatedAt === 'number'
      ) {
        entries.push({
          id: e.id,
          date: e.date,
          text: e.text.trim().slice(0, MAX_JURNAL_LENGTH),
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
        });
      }
    }
    return entries.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function writeLocalJurnal(entries: JurnalEntry[]): void {
  try {
    window.localStorage.setItem(LOCAL_JURNAL_KEY, JSON.stringify(entries));
  } catch (err) {
    console.error('Gagal menyimpan jurnal ke penyimpanan lokal:', err);
  }
}

function generateLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  }
  return `loc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createLocalJurnalEntry(
  dateKey: string,
  rawText: string
): JurnalEntry[] {
  const text = rawText.trim();
  if (!isValidDateKey(dateKey)) {
    throw new Error('Format tanggal tidak valid.');
  }
  if (text.length < 1 || text.length > MAX_JURNAL_LENGTH) {
    throw new Error(
      `Teks syukur harus antara 1 hingga ${MAX_JURNAL_LENGTH} karakter.`
    );
  }
  const now = Date.now();
  const nextEntry: JurnalEntry = {
    id: generateLocalId(),
    date: dateKey,
    text,
    createdAt: now,
    updatedAt: now,
  };
  const next = [nextEntry, ...readLocalJurnal()];
  writeLocalJurnal(next);
  return next;
}

export function updateLocalJurnalEntry(
  entryId: string,
  rawText: string
): JurnalEntry[] {
  const text = rawText.trim();
  if (text.length < 1 || text.length > MAX_JURNAL_LENGTH) {
    throw new Error(
      `Teks syukur harus antara 1 hingga ${MAX_JURNAL_LENGTH} karakter.`
    );
  }
  const now = Date.now();
  const next = readLocalJurnal().map((entry) =>
    entry.id === entryId ? { ...entry, text, updatedAt: now } : entry
  );
  writeLocalJurnal(next);
  return next;
}

export function deleteLocalJurnalEntry(entryId: string): JurnalEntry[] {
  const next = readLocalJurnal().filter((entry) => entry.id !== entryId);
  writeLocalJurnal(next);
  return next;
}

export function exportLocalData(): ExportPayload {
  const rawDays = readLocalDays();
  const days: Record<string, DayItemsMap> = {};
  for (const [dateKey, record] of Object.entries(rawDays)) {
    const clean: DayItemsMap = {};
    for (const id of IBADAH_IDS) {
      if (record.items[id] !== undefined) {
        clean[id] = sanitizeItemState(id, record.items[id]);
      }
    }
    days[dateKey] = clean;
  }

  const jurnal = readLocalJurnal().map((entry) => ({
    id: entry.id,
    date: entry.date,
    text: entry.text,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }));

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    days,
    jurnal,
  };
}

export function importLocalData(payload: ExportPayload): {
  days: Record<string, DayRecord>;
  jurnal: JurnalEntry[];
} {
  const now = Date.now();
  const nextDays: Record<string, DayRecord> = {};
  for (const [dateKey, items] of Object.entries(payload.days)) {
    nextDays[dateKey] = {
      date: dateKey,
      items: sanitizeDayItems(items),
      updatedAt: now,
    };
  }
  const nextJurnal: JurnalEntry[] = payload.jurnal
    .map((entry) => ({
      id: entry.id,
      date: entry.date,
      text: entry.text,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);

  writeLocalDays(nextDays);
  writeLocalJurnal(nextJurnal);
  window.dispatchEvent(new CustomEvent('cih-local-data-changed'));
  return { days: nextDays, jurnal: nextJurnal };
}

export function deleteAllLocalData(): void {
  try {
    window.localStorage.removeItem(LOCAL_DAYS_KEY);
    window.localStorage.removeItem(LOCAL_JURNAL_KEY);
    window.dispatchEvent(new CustomEvent('cih-local-data-changed'));
  } catch (err) {
    console.error('Gagal menghapus data lokal:', err);
  }
}
