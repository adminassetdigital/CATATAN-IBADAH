export type IbadahId =
  | 'dzikir'
  | 'berdoa'
  | 'quran'
  | 'sholat_masjid'
  | 'sholat_malam'
  | 'silaturahmi'
  | 'majelis_ilmu'
  | 'sedekah';

export type SholatWaktu = 'Subuh' | 'Zuhur' | 'Asar' | 'Magrib' | 'Isya';

export const SHOLAT_WAKTU_LIST: readonly SholatWaktu[] = [
  'Subuh',
  'Zuhur',
  'Asar',
  'Magrib',
  'Isya',
] as const;

export type IbadahDetail = number | string | string[] | null;

export interface IbadahItemState {
  done: boolean;
  detail: IbadahDetail;
}

export type DayItemsMap = Partial<Record<IbadahId, IbadahItemState>>;

export interface DayRecord {
  date: string;
  items: DayItemsMap;
  updatedAt: unknown;
}

export interface JurnalEntry {
  id: string;
  date: string;
  text: string;
  createdAt: number;
  updatedAt: number;
}

export type SyncStatus =
  | 'Tersimpan'
  | 'Tersimpan lokal'
  | 'Menyimpan…'
  | 'Offline (akan disinkronkan)'
  | 'Gagal menyimpan';

export type TabId = 'hari_ini' | 'syukur' | 'statistik' | 'pengaturan';

export interface IbadahDefinition {
  id: IbadahId;
  label: string;
  subtitle: string;
  detailType: 'stepper' | 'none' | 'pages' | 'waktu' | 'rakaat' | 'note' | 'rupiah';
}

export const MAX_NOTE_LENGTH = 100;
export const MAX_JURNAL_LENGTH = 280;
export const MAX_BATCH_OPS = 400;
export const DAYS_QUERY_LIMIT = 400;

export const IBADAH_LIST: readonly IbadahDefinition[] = [
  {
    id: 'dzikir',
    label: 'Dzikir',
    subtitle: 'Catat jumlah bacaan bila perlu',
    detailType: 'stepper',
  },
  {
    id: 'berdoa',
    label: 'Berdoa',
    subtitle: 'Luangkan waktu untuk memohon kebaikan',
    detailType: 'none',
  },
  {
    id: 'quran',
    label: 'Membaca Al-Qur’an',
    subtitle: 'Jumlah halaman yang dibaca',
    detailType: 'pages',
  },
  {
    id: 'sholat_masjid',
    label: 'Sholat di Masjid',
    subtitle: 'Pilih waktu yang sempat dihadiri',
    detailType: 'waktu',
  },
  {
    id: 'sholat_malam',
    label: 'Sholat Malam',
    subtitle: 'Jumlah rakaat yang dikerjakan',
    detailType: 'rakaat',
  },
  {
    id: 'silaturahmi',
    label: 'Silaturahmi',
    subtitle: 'Catatan singkat opsional',
    detailType: 'note',
  },
  {
    id: 'majelis_ilmu',
    label: 'Majelis Ilmu',
    subtitle: 'Catatan kajian atau pelajaran opsional',
    detailType: 'note',
  },
  {
    id: 'sedekah',
    label: 'Sedekah',
    subtitle: 'Nominal Rupiah opsional',
    detailType: 'rupiah',
  },
] as const;

export const IBADAH_IDS: readonly IbadahId[] = IBADAH_LIST.map((item) => item.id);

export interface ExportPayload {
  version: number;
  exportedAt: string;
  days: Record<string, DayItemsMap>;
  jurnal: Array<{
    id: string;
    date: string;
    text: string;
    createdAt: number;
    updatedAt: number;
  }>;
}
