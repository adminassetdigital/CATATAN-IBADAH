import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  DAYS_QUERY_LIMIT,
  IBADAH_IDS,
  MAX_BATCH_OPS,
  MAX_JURNAL_LENGTH,
  MAX_NOTE_LENGTH,
  SHOLAT_WAKTU_LIST,
  type DayItemsMap,
  type DayRecord,
  type ExportPayload,
  type IbadahDetail,
  type IbadahId,
  type IbadahItemState,
  type JurnalEntry,
  type SholatWaktu,
} from '../constants/ibadah';
import { isValidDateKey } from './dates';
import { auth, db } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function logFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) ?? [],
    },
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  return errInfo;
}

export function mapFirestoreErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  const msg = error instanceof Error ? error.message : String(error);

  if (
    code === 'permission-denied' ||
    msg.includes('Missing or insufficient permissions') ||
    msg.includes('permission-denied')
  ) {
    return 'Izin ditolak oleh server. Pastikan kamu masuk dengan akun Google yang sesuai.';
  }
  if (
    code === 'resource-exhausted' ||
    msg.includes('Quota exceeded') ||
    msg.includes('resource-exhausted')
  ) {
    return 'Kuota harian database tercapai. Silakan coba lagi besok.';
  }
  if (
    code === 'unavailable' ||
    msg.includes('unavailable') ||
    msg.includes('network') ||
    msg.includes('offline')
  ) {
    return 'Gangguan jaringan. Pastikan koneksi internet aktif lalu coba kembali.';
  }
  if (code === 'unauthenticated') {
    return 'Sesi masuk berakhir. Silakan masuk kembali dengan Google.';
  }
  return 'Terjadi kesalahan saat mengakses data. Silakan coba lagi.';
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  logFirestoreError(error, operationType, path);
  throw new Error(mapFirestoreErrorMessage(error));
}

function sanitizeDetail(ibadahId: IbadahId, detail: unknown): IbadahDetail {
  if (detail === undefined || detail === null) {
    return null;
  }

  switch (ibadahId) {
    case 'berdoa':
      return null;
    case 'dzikir':
    case 'quran':
    case 'sholat_malam':
    case 'sedekah': {
      if (typeof detail === 'number' && Number.isFinite(detail) && detail >= 0) {
        return Math.floor(detail);
      }
      return null;
    }
    case 'sholat_masjid': {
      if (!Array.isArray(detail)) {
        return null;
      }
      const allowed = new Set<string>(SHOLAT_WAKTU_LIST);
      const filtered = Array.from(
        new Set(
          detail.filter(
            (v): v is SholatWaktu => typeof v === 'string' && allowed.has(v)
          )
        )
      );
      return filtered.length > 0 ? filtered : null;
    }
    case 'silaturahmi':
    case 'majelis_ilmu': {
      if (typeof detail === 'string') {
        const trimmed = detail.slice(0, MAX_NOTE_LENGTH);
        return trimmed.length > 0 ? trimmed : null;
      }
      return null;
    }
    default:
      return null;
  }
}

export function sanitizeItemState(
  ibadahId: IbadahId,
  raw: unknown
): IbadahItemState {
  if (typeof raw !== 'object' || raw === null) {
    return { done: false, detail: null };
  }
  const obj = raw as { done?: unknown; detail?: unknown };
  return {
    done: Boolean(obj.done),
    detail: sanitizeDetail(ibadahId, obj.detail),
  };
}

export function sanitizeDayItems(rawItems: unknown): DayItemsMap {
  const result: DayItemsMap = {};
  if (typeof rawItems !== 'object' || rawItems === null) {
    return result;
  }
  const source = rawItems as Record<string, unknown>;
  for (const id of IBADAH_IDS) {
    if (Object.prototype.hasOwnProperty.call(source, id) && source[id] !== undefined) {
      result[id] = sanitizeItemState(id, source[id]);
    }
  }
  return result;
}

export function subscribeDays(
  uid: string,
  onData: (days: Record<string, DayRecord>, hasPendingWrites: boolean) => void,
  onError: (message: string) => void
): Unsubscribe {
  const colPath = `users/${uid}/days`;
  const q = query(
    collection(db, 'users', uid, 'days'),
    orderBy(documentId(), 'desc'),
    limit(DAYS_QUERY_LIMIT)
  );

  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      const nextDays: Record<string, DayRecord> = {};
      snapshot.forEach((docSnap) => {
        if (!isValidDateKey(docSnap.id)) {
          return;
        }
        const data = docSnap.data();
        nextDays[docSnap.id] = {
          date: docSnap.id,
          items: sanitizeDayItems(data.items),
          updatedAt: data.updatedAt ?? null,
        };
      });
      onData(nextDays, snapshot.metadata.hasPendingWrites);
    },
    (error) => {
      logFirestoreError(error, OperationType.LIST, colPath);
      onError(mapFirestoreErrorMessage(error));
    }
  );
}

export async function saveDayItems(
  uid: string,
  dateKey: string,
  itemsPatch: DayItemsMap
): Promise<void> {
  if (!isValidDateKey(dateKey)) {
    throw new Error('Format tanggal tidak valid.');
  }
  const docPath = `users/${uid}/days/${dateKey}`;
  const cleanPatch: DayItemsMap = {};
  for (const id of IBADAH_IDS) {
    const val = itemsPatch[id];
    if (val !== undefined) {
      cleanPatch[id] = sanitizeItemState(id, val);
    }
  }
  if (Object.keys(cleanPatch).length === 0) {
    return;
  }

  try {
    await setDoc(
      doc(db, 'users', uid, 'days', dateKey),
      {
        items: cleanPatch,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export function subscribeJurnal(
  uid: string,
  onData: (entries: JurnalEntry[], hasPendingWrites: boolean) => void,
  onError: (message: string) => void
): Unsubscribe {
  const colPath = `users/${uid}/jurnal`;
  const q = query(
    collection(db, 'users', uid, 'jurnal'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      const nextEntries: JurnalEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const date = typeof data.date === 'string' ? data.date : '';
        const text = typeof data.text === 'string' ? data.text : '';
        const createdAt =
          typeof data.createdAt === 'number' ? data.createdAt : Date.now();
        const updatedAt =
          typeof data.updatedAt === 'number' ? data.updatedAt : createdAt;

        if (isValidDateKey(date) && text.length > 0) {
          nextEntries.push({
            id: docSnap.id,
            date,
            text,
            createdAt,
            updatedAt,
          });
        }
      });
      onData(nextEntries, snapshot.metadata.hasPendingWrites);
    },
    (error) => {
      logFirestoreError(error, OperationType.LIST, colPath);
      onError(mapFirestoreErrorMessage(error));
    }
  );
}

export async function createJurnalEntry(
  uid: string,
  dateKey: string,
  rawText: string
): Promise<void> {
  if (!isValidDateKey(dateKey)) {
    throw new Error('Format tanggal tidak valid.');
  }
  const text = rawText.trim();
  if (text.length < 1 || text.length > MAX_JURNAL_LENGTH) {
    throw new Error(`Teks syukur harus antara 1 hingga ${MAX_JURNAL_LENGTH} karakter.`);
  }

  const colRef = collection(db, 'users', uid, 'jurnal');
  const newDocRef = doc(colRef);
  const docPath = `users/${uid}/jurnal/${newDocRef.id}`;
  const now = Date.now();

  try {
    await setDoc(newDocRef, {
      date: dateKey,
      text,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function updateJurnalEntry(
  uid: string,
  entryId: string,
  rawText: string
): Promise<void> {
  const text = rawText.trim();
  if (text.length < 1 || text.length > MAX_JURNAL_LENGTH) {
    throw new Error(`Teks syukur harus antara 1 hingga ${MAX_JURNAL_LENGTH} karakter.`);
  }

  const docPath = `users/${uid}/jurnal/${entryId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'jurnal', entryId), {
      text,
      updatedAt: Date.now(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function deleteJurnalEntry(
  uid: string,
  entryId: string
): Promise<void> {
  const docPath = `users/${uid}/jurnal/${entryId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'jurnal', entryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function fetchAllUserDataForExport(
  uid: string
): Promise<ExportPayload> {
  const daysPath = `users/${uid}/days`;
  const jurnalPath = `users/${uid}/jurnal`;

  try {
    const [daysSnap, jurnalSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'days')),
      getDocs(
        query(collection(db, 'users', uid, 'jurnal'), orderBy('createdAt', 'desc'))
      ),
    ]);

    const days: Record<string, DayItemsMap> = {};
    daysSnap.forEach((docSnap) => {
      if (isValidDateKey(docSnap.id)) {
        days[docSnap.id] = sanitizeDayItems(docSnap.data().items);
      }
    });

    const jurnal: ExportPayload['jurnal'] = [];
    jurnalSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (
        isValidDateKey(data.date) &&
        typeof data.text === 'string' &&
        data.text.trim().length >= 1 &&
        typeof data.createdAt === 'number' &&
        typeof data.updatedAt === 'number'
      ) {
        jurnal.push({
          id: docSnap.id,
          date: data.date,
          text: data.text,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      }
    });

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      days,
      jurnal,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${daysPath}, ${jurnalPath}`);
  }
}

const VALID_DOC_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export function validateImportPayload(
  raw: unknown
): { ok: true; data: ExportPayload } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'Format file JSON tidak valid. Harus berupa objek JSON.' };
  }

  const obj = raw as Record<string, unknown>;
  if (typeof obj.days !== 'object' || obj.days === null || Array.isArray(obj.days)) {
    return {
      ok: false,
      error: 'Struktur JSON tidak valid: properti "days" harus berupa objek.',
    };
  }
  if (!Array.isArray(obj.jurnal)) {
    return {
      ok: false,
      error: 'Struktur JSON tidak valid: properti "jurnal" harus berupa array.',
    };
  }

  const validatedDays: Record<string, DayItemsMap> = {};
  const rawDays = obj.days as Record<string, unknown>;
  for (const [dateKey, rawItems] of Object.entries(rawDays)) {
    if (!isValidDateKey(dateKey)) {
      return {
        ok: false,
        error: `Kunci tanggal tidak valid pada "days": "${dateKey}". Harus berformat YYYY-MM-DD.`,
      };
    }
    if (typeof rawItems !== 'object' || rawItems === null || Array.isArray(rawItems)) {
      return {
        ok: false,
        error: `Data ibadah pada tanggal "${dateKey}" harus berupa objek.`,
      };
    }
    const rawItemsObj = rawItems as Record<string, unknown>;
    const allowedSet = new Set<string>(IBADAH_IDS);
    for (const key of Object.keys(rawItemsObj)) {
      if (!allowedSet.has(key)) {
        return {
          ok: false,
          error: `ID ibadah tidak dikenal ("${key}") pada tanggal "${dateKey}".`,
        };
      }
    }
    validatedDays[dateKey] = sanitizeDayItems(rawItemsObj);
  }

  const validatedJurnal: ExportPayload['jurnal'] = [];
  const usedIds = new Set<string>();
  for (let i = 0; i < obj.jurnal.length; i++) {
    const entry = obj.jurnal[i];
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return {
        ok: false,
        error: `Entri jurnal indeks ke-${i} tidak valid.`,
      };
    }
    const e = entry as Record<string, unknown>;
    if (!isValidDateKey(e.date)) {
      return {
        ok: false,
        error: `Tanggal tidak valid pada entri jurnal ke-${i}.`,
      };
    }
    if (typeof e.text !== 'string') {
      return {
        ok: false,
        error: `Teks tidak valid pada entri jurnal ke-${i}.`,
      };
    }
    const trimmedText = e.text.trim();
    if (trimmedText.length < 1 || trimmedText.length > MAX_JURNAL_LENGTH) {
      return {
        ok: false,
        error: `Panjang teks entri jurnal ke-${i} harus 1–${MAX_JURNAL_LENGTH} karakter.`,
      };
    }
    if (
      typeof e.createdAt !== 'number' ||
      !Number.isFinite(e.createdAt) ||
      e.createdAt <= 0
    ) {
      return {
        ok: false,
        error: `Nilai createdAt tidak valid pada entri jurnal ke-${i}.`,
      };
    }
    if (
      typeof e.updatedAt !== 'number' ||
      !Number.isFinite(e.updatedAt) ||
      e.updatedAt <= 0
    ) {
      return {
        ok: false,
        error: `Nilai updatedAt tidak valid pada entri jurnal ke-${i}.`,
      };
    }

    let safeId =
      typeof e.id === 'string' && VALID_DOC_ID_REGEX.test(e.id)
        ? e.id
        : `imp_${i}_${Math.floor(e.createdAt)}`;
    while (usedIds.has(safeId)) {
      safeId = `${safeId}_${i}`;
    }
    usedIds.add(safeId);

    validatedJurnal.push({
      id: safeId,
      date: e.date,
      text: trimmedText,
      createdAt: Math.floor(e.createdAt),
      updatedAt: Math.floor(e.updatedAt),
    });
  }

  return {
    ok: true,
    data: {
      version: typeof obj.version === 'number' ? obj.version : 1,
      exportedAt:
        typeof obj.exportedAt === 'string'
          ? obj.exportedAt
          : new Date().toISOString(),
      days: validatedDays,
      jurnal: validatedJurnal,
    },
  };
}

async function commitInBatches(
  operations: Array<(batch: ReturnType<typeof writeBatch>) => void>,
  operationType: OperationType,
  path: string
): Promise<void> {
  for (let i = 0; i < operations.length; i += MAX_BATCH_OPS) {
    const chunk = operations.slice(i, i + MAX_BATCH_OPS);
    const batch = writeBatch(db);
    for (const op of chunk) {
      op(batch);
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, operationType, path);
    }
  }
}

export async function deleteAllUserData(uid: string): Promise<void> {
  const daysPath = `users/${uid}/days`;
  const jurnalPath = `users/${uid}/jurnal`;

  try {
    const [daysSnap, jurnalSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'days')),
      getDocs(collection(db, 'users', uid, 'jurnal')),
    ]);

    const deleteOps: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
    const addDeleteOp = (ref: DocumentReference) => {
      deleteOps.push((batch) => {
        batch.delete(ref);
      });
    };

    daysSnap.forEach((docSnap) => addDeleteOp(docSnap.ref));
    jurnalSnap.forEach((docSnap) => addDeleteOp(docSnap.ref));

    if (deleteOps.length > 0) {
      await commitInBatches(
        deleteOps,
        OperationType.DELETE,
        `${daysPath}, ${jurnalPath}`
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Izin ditolak')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.DELETE, `${daysPath}, ${jurnalPath}`);
  }
}

export async function importUserData(
  uid: string,
  payload: ExportPayload
): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(
      'Impor data memerlukan koneksi internet agar seluruh data tersinkron dengan aman.'
    );
  }

  await deleteAllUserData(uid);

  const writeOps: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  for (const [dateKey, items] of Object.entries(payload.days)) {
    const ref = doc(db, 'users', uid, 'days', dateKey);
    const cleanItems = sanitizeDayItems(items);
    writeOps.push((batch) => {
      batch.set(ref, {
        items: cleanItems,
        updatedAt: serverTimestamp(),
      });
    });
  }

  for (const entry of payload.jurnal) {
    const ref = doc(db, 'users', uid, 'jurnal', entry.id);
    writeOps.push((batch) => {
      batch.set(ref, {
        date: entry.date,
        text: entry.text,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      });
    });
  }

  if (writeOps.length > 0) {
    await commitInBatches(
      writeOps,
      OperationType.WRITE,
      `users/${uid}/import`
    );
  }
}

export async function mergeLocalDataToFirestore(
  uid: string,
  localDays: Record<string, DayRecord>,
  localJurnal: JurnalEntry[]
): Promise<number> {
  const dayEntries = Object.entries(localDays);
  if (dayEntries.length === 0 && localJurnal.length === 0) {
    return 0;
  }

  const writeOps: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  for (const [dateKey, record] of dayEntries) {
    if (!isValidDateKey(dateKey)) {
      continue;
    }
    const cleanItems = sanitizeDayItems(record.items);
    if (Object.keys(cleanItems).length === 0) {
      continue;
    }
    const ref = doc(db, 'users', uid, 'days', dateKey);
    writeOps.push((batch) => {
      batch.set(
        ref,
        {
          items: cleanItems,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });
  }

  for (const entry of localJurnal) {
    if (!isValidDateKey(entry.date) || !VALID_DOC_ID_REGEX.test(entry.id)) {
      continue;
    }
    const text = entry.text.trim().slice(0, MAX_JURNAL_LENGTH);
    if (text.length < 1) {
      continue;
    }
    const ref = doc(db, 'users', uid, 'jurnal', entry.id);
    writeOps.push((batch) => {
      batch.set(
        ref,
        {
          date: entry.date,
          text,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        },
        { merge: true }
      );
    });
  }

  if (writeOps.length > 0) {
    await commitInBatches(
      writeOps,
      OperationType.WRITE,
      `users/${uid}/mergeLocal`
    );
  }

  return writeOps.length;
}

