const DATE_KEY_REGEX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/**
 * Membentuk kunci tanggal lokal perangkat "YYYY-MM-DD" secara manual.
 * Tidak menggunakan toISOString() agar aman di semua zona waktu (WIB/WITA/WIT).
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
}

export function getTodayKey(): string {
  return formatDateKey(new Date());
}

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_KEY_REGEX.test(value)) {
    return false;
  }
  const [y, m, d] = value.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  return (
    parsed.getFullYear() === y &&
    parsed.getMonth() === m - 1 &&
    parsed.getDate() === d
  );
}

export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysToKey(dateKey: string, deltaDays: number): string {
  const d = parseDateKey(dateKey);
  d.setDate(d.getDate() + deltaDays);
  return formatDateKey(d);
}

export function formatDateLongId(dateKey: string): string {
  const date = parseDateKey(dateKey);
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatDateCompactId(dateKey: string): string {
  const date = parseDateKey(dateKey);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDayWeekdayShort(dateKey: string): string {
  const date = parseDateKey(dateKey);
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
  }).format(date);
}

export function getLastNDaysKeys(count: number, endDateKey: string = getTodayKey()): string[] {
  const result: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    result.push(addDaysToKey(endDateKey, -i));
  }
  return result;
}

export function getCurrentMonthPrefix(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

export function formatMonthYearId(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}
