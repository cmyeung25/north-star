import { nanoid } from "nanoid";
import {
  PERSISTED_SCHEMA_VERSION,
  validatePersistedState,
  type PersistedDocument,
  type StorePersistedState,
} from "./validate";

export const AUTOSAVE_KEY = "northstar.autosave.v1";
export const SNAPSHOTS_KEY = "northstar.snapshots.v1";

const MAX_SNAPSHOT_COUNT = 20;
const MAX_PAYLOAD_BYTES = 2_000_000;

export type SnapshotEntry = {
  id: string;
  name?: string;
  savedAt: string;
  schemaVersion: number;
  appVersion?: string;
  payload: StorePersistedState;
};

type StorageSuccess<T> = {
  ok: true;
  value: T;
};

type StorageFailure = {
  ok: false;
  error: string;
};

export type StorageResult<T> = StorageSuccess<T> | StorageFailure;

const isBrowser =
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const measureBytes = (value: unknown) => new Blob([JSON.stringify(value)]).size;

const formatTimestamp = (value: Date) => value.toISOString();

const buildDocument = (payload: StorePersistedState): PersistedDocument => ({
  schemaVersion: PERSISTED_SCHEMA_VERSION,
  savedAt: formatTimestamp(new Date()),
  payload,
});

const buildSnapshot = (payload: StorePersistedState, name?: string): SnapshotEntry => ({
  id: `snapshot-${nanoid(8)}`,
  name: name?.trim() ? name.trim() : undefined,
  savedAt: formatTimestamp(new Date()),
  schemaVersion: PERSISTED_SCHEMA_VERSION,
  payload,
});

const writeToStorage = (key: string, value: unknown): StorageResult<void> => {
  if (!isBrowser) {
    return { ok: false, error: "Local storage is unavailable." };
  }

  const sizeBytes = measureBytes(value);
  if (sizeBytes > MAX_PAYLOAD_BYTES) {
    return { ok: false, error: "Payload is too large to save locally." };
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true, value: undefined };
  } catch {
    return { ok: false, error: "Local storage is full or unavailable." };
  }
};

const parseJson = <T>(raw: string): StorageResult<T> => {
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch {
    return { ok: false, error: "Invalid JSON." };
  }
};

const normalizeSnapshot = (value: unknown): SnapshotEntry | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as SnapshotEntry;
  if (typeof record.id !== "string") {
    return null;
  }

  const schemaVersion =
    typeof record.schemaVersion === "number"
      ? record.schemaVersion
      : PERSISTED_SCHEMA_VERSION;

  const validated = validatePersistedState({
    schemaVersion,
    savedAt: record.savedAt,
    payload: record.payload,
    appVersion: record.appVersion,
  });

  if (!validated.ok) {
    return null;
  }

  return {
    id: record.id,
    name: typeof record.name === "string" ? record.name : undefined,
    savedAt: validated.value.savedAt,
    schemaVersion: validated.value.schemaVersion,
    appVersion: validated.value.appVersion,
    payload: validated.value.payload,
  };
};

export const loadAutosave = (): StorageResult<PersistedDocument | null> => {
  if (!isBrowser) {
    return { ok: false, error: "Local storage is unavailable." };
  }

  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) {
    return { ok: true, value: null };
  }

  const parsed = parseJson<unknown>(raw);
  if (!parsed.ok) {
    return { ok: false, error: "Autosave data is corrupted." };
  }

  const validated = validatePersistedState(parsed.value);
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  return { ok: true, value: validated.value };
};

export const saveAutosave = (payload: StorePersistedState): StorageResult<void> => {
  return writeToStorage(AUTOSAVE_KEY, buildDocument(payload));
};

export const listSnapshots = (): SnapshotEntry[] => {
  if (!isBrowser) {
    return [];
  }

  const raw = localStorage.getItem(SNAPSHOTS_KEY);
  if (!raw) {
    return [];
  }

  const parsed = parseJson<unknown>(raw);
  if (!parsed.ok || !Array.isArray(parsed.value)) {
    return [];
  }

  return parsed.value
    .map((entry) => normalizeSnapshot(entry))
    .filter((entry): entry is SnapshotEntry => Boolean(entry));
};

export const saveSnapshot = (
  name: string | undefined,
  payload: StorePersistedState
): StorageResult<SnapshotEntry> => {
  const snapshot = buildSnapshot(payload, name);
  const current = listSnapshots();
  const next = [snapshot, ...current];
  if (next.length > MAX_SNAPSHOT_COUNT) {
    next.splice(MAX_SNAPSHOT_COUNT);
  }

  const result = writeToStorage(SNAPSHOTS_KEY, next);
  if (!result.ok) {
    return result;
  }

  return { ok: true, value: snapshot };
};

export const loadSnapshot = (id: string): StorageResult<SnapshotEntry> => {
  const snapshot = listSnapshots().find((entry) => entry.id === id);
  if (!snapshot) {
    return { ok: false, error: "Snapshot not found." };
  }
  return { ok: true, value: snapshot };
};

export const deleteSnapshot = (id: string): StorageResult<void> => {
  const next = listSnapshots().filter((entry) => entry.id !== id);
  return writeToStorage(SNAPSHOTS_KEY, next);
};

export const clearLocalData = (): StorageResult<void> => {
  if (!isBrowser) {
    return { ok: false, error: "Local storage is unavailable." };
  }

  try {
    localStorage.removeItem(AUTOSAVE_KEY);
    localStorage.removeItem(SNAPSHOTS_KEY);
    return { ok: true, value: undefined };
  } catch {
    return { ok: false, error: "Failed to clear local data." };
  }
};

const formatExportFilename = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate()
  )}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `northstar-backup-${date}-${time}.json`;
};

export const exportJSON = (payload: StorePersistedState): StorageResult<string> => {
  if (!isBrowser) {
    return { ok: false, error: "Local storage is unavailable." };
  }

  const payloadDocument = buildDocument(payload);
  const data = JSON.stringify(payloadDocument, null, 2);
  const filename = formatExportFilename();

  try {
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return { ok: true, value: filename };
  } catch {
    return { ok: false, error: "Export failed." };
  }
};

export const importJSON = async (
  file: File
): Promise<StorageResult<PersistedDocument>> => {
  if (!isBrowser) {
    return { ok: false, error: "Local storage is unavailable." };
  }

  try {
    const text = await file.text();
    const parsed = parseJson<unknown>(text);
    if (!parsed.ok) {
      return { ok: false, error: "Invalid JSON file." };
    }

    const validated = validatePersistedState(parsed.value);
    if (!validated.ok) {
      return { ok: false, error: validated.error };
    }

    return { ok: true, value: validated.value };
  } catch {
    return { ok: false, error: "Failed to read file." };
  }
};
