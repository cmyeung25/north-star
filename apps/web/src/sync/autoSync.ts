import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import { getFirestoreDb } from "../../lib/firebaseClient";
import { SCHEMA_VERSION } from "../store/scenarioSchema";
import { saveToIndexedDB } from "../store/scenarioPersistence";
import { useScenarioStore, type Scenario } from "../store/scenarioStore";
import { useSettingsStore } from "../store/settingsStore";

type CloudScenarioDocument = {
  scenario: Scenario;
  revision: number;
  updatedAt: number;
};

type CloudMetaDocument = {
  lastSyncedAt?: number;
  schemaVersion?: number;
};

type SyncCacheEntry = {
  updatedAt: number;
  revision: number;
};

type SyncState = {
  active: boolean;
  uid: string | null;
  online: boolean;
  hasInitialSnapshot: boolean;
  unsubscribeSnapshot: (() => void) | null;
  unsubscribeStore: (() => void) | null;
  unsubscribeOnline: (() => void) | null;
  uploadTimeout: ReturnType<typeof setTimeout> | null;
};

const SYNC_DEBOUNCE_MS = 1000;

const syncState: SyncState = {
  active: false,
  uid: null,
  online: true,
  hasInitialSnapshot: false,
  unsubscribeSnapshot: null,
  unsubscribeStore: null,
  unsubscribeOnline: null,
  uploadTimeout: null,
};

const lastSyncedMap = new Map<string, SyncCacheEntry>();

const ensureFirestore = (): Firestore => {
  const firestore = getFirestoreDb();
  if (!firestore) {
    throw new Error("Firestore is unavailable.");
  }

  return firestore;
};

const getScenariosRef = (uid: string) =>
  collection(ensureFirestore(), "users", uid, "scenarios");

const getScenarioDocRef = (uid: string, scenarioId: string) =>
  doc(ensureFirestore(), "users", uid, "scenarios", scenarioId);

const getMetaRef = (uid: string) => doc(ensureFirestore(), "users", uid, "meta");

const compareLww = (
  localUpdatedAt: number,
  localRevision: number,
  remoteUpdatedAt: number,
  remoteRevision: number
) => {
  if (localUpdatedAt > remoteUpdatedAt) {
    return 1;
  }

  if (localUpdatedAt < remoteUpdatedAt) {
    return -1;
  }

  if (localRevision > remoteRevision) {
    return 1;
  }

  if (localRevision < remoteRevision) {
    return -1;
  }

  return 0;
};

const updateAutoSyncError = (message: string | null) => {
  useSettingsStore.getState().setAutoSyncError(message);
};

const updateLastAutoSyncAt = (timestamp: number) => {
  useSettingsStore.getState().setLastAutoSyncAt(timestamp);
};

const persistScenarioSnapshot = async () => {
  const snapshot = useScenarioStore.getState();
  await saveToIndexedDB({
    scenarios: snapshot.scenarios,
    eventLibrary: snapshot.eventLibrary,
    activeScenarioId: snapshot.activeScenarioId,
  });
};

const applyRemoteScenario = async (
  scenario: Scenario,
  metadata: SyncCacheEntry
) => {
  useScenarioStore.getState().replaceScenario(scenario);
  lastSyncedMap.set(scenario.id, metadata);
  updateLastAutoSyncAt(Date.now());
  await persistScenarioSnapshot();
};

const scheduleUpload = () => {
  if (!syncState.active || !syncState.online || !syncState.hasInitialSnapshot) {
    return;
  }

  if (syncState.uploadTimeout) {
    clearTimeout(syncState.uploadTimeout);
  }

  syncState.uploadTimeout = setTimeout(() => {
    void flushUploads();
  }, SYNC_DEBOUNCE_MS);
};

const flushUploads = async () => {
  if (!syncState.active || !syncState.uid || !syncState.online) {
    return;
  }

  const snapshot = useScenarioStore.getState();
  const now = Date.now();

  for (const scenario of snapshot.scenarios) {
    const cached = lastSyncedMap.get(scenario.id);
    const cachedUpdatedAt = cached?.updatedAt ?? 0;
    const cachedRevision = cached?.revision ?? 0;
    const localUpdatedAt = scenario.updatedAt ?? 0;
    const localRevision = cachedRevision;

    if (
      compareLww(localUpdatedAt, localRevision, cachedUpdatedAt, cachedRevision) <= 0
    ) {
      continue;
    }

    const nextRevision = cachedRevision + 1;

    try {
      await setDoc(getScenarioDocRef(syncState.uid, scenario.id), {
        scenario,
        revision: nextRevision,
        updatedAt: now,
      } satisfies CloudScenarioDocument);

      await setDoc(
        getMetaRef(syncState.uid),
        {
          lastSyncedAt: now,
          schemaVersion: SCHEMA_VERSION,
        } satisfies CloudMetaDocument,
        { merge: true }
      );

      lastSyncedMap.set(scenario.id, { updatedAt: now, revision: nextRevision });
      updateLastAutoSyncAt(now);
      updateAutoSyncError(null);
    } catch (error) {
      updateAutoSyncError(
        error instanceof Error
          ? error.message
          : "Auto-sync failed. Data stays on this device."
      );
      return;
    }
  }
};

const handleSnapshotUpdate = async (docs: CloudScenarioDocument[]) => {
  for (const docData of docs) {
    if (!docData?.scenario) {
      continue;
    }

    const scenarioId = docData.scenario.id;
    const remoteUpdatedAt =
      typeof docData.updatedAt === "number"
        ? docData.updatedAt
        : docData.scenario.updatedAt ?? 0;
    const remoteRevision =
      typeof docData.revision === "number" ? docData.revision : 0;
    const cached = lastSyncedMap.get(scenarioId);
    const localScenario = useScenarioStore
      .getState()
      .scenarios.find((scenario) => scenario.id === scenarioId);
    const localUpdatedAt = localScenario?.updatedAt ?? 0;
    const localRevision = cached?.revision ?? 0;

    if (
      cached &&
      cached.updatedAt === remoteUpdatedAt &&
      cached.revision === remoteRevision
    ) {
      continue;
    }

    if (!localScenario) {
      await applyRemoteScenario(docData.scenario, {
        updatedAt: remoteUpdatedAt,
        revision: remoteRevision,
      });
      continue;
    }

    const comparison = compareLww(
      localUpdatedAt,
      localRevision,
      remoteUpdatedAt,
      remoteRevision
    );

    if (comparison < 0) {
      await applyRemoteScenario(docData.scenario, {
        updatedAt: remoteUpdatedAt,
        revision: remoteRevision,
      });
    } else if (comparison > 0) {
      scheduleUpload();
    } else {
      lastSyncedMap.set(scenarioId, {
        updatedAt: remoteUpdatedAt,
        revision: remoteRevision,
      });
    }
  }
};

const startSnapshotListener = () => {
  if (!syncState.uid || syncState.unsubscribeSnapshot) {
    return;
  }

  syncState.hasInitialSnapshot = false;

  syncState.unsubscribeSnapshot = onSnapshot(
    getScenariosRef(syncState.uid),
    async (snapshot) => {
      const docs = snapshot.docs
        .map((docSnap) => docSnap.data() as CloudScenarioDocument)
        .filter(Boolean);

      await handleSnapshotUpdate(docs);

      if (!syncState.hasInitialSnapshot) {
        syncState.hasInitialSnapshot = true;
        scheduleUpload();
      }
    },
    (error) => {
      updateAutoSyncError(
        error instanceof Error
          ? error.message
          : "Auto-sync listener failed."
      );
    }
  );
};

const stopSnapshotListener = () => {
  if (syncState.unsubscribeSnapshot) {
    syncState.unsubscribeSnapshot();
    syncState.unsubscribeSnapshot = null;
  }
  syncState.hasInitialSnapshot = false;
};

const startOnlineListener = () => {
  if (syncState.unsubscribeOnline) {
    return;
  }

  const handleOnlineChange = () => {
    syncState.online =
      typeof navigator === "undefined" ? true : navigator.onLine;

    if (!syncState.active) {
      return;
    }

    if (syncState.online) {
      startSnapshotListener();
      scheduleUpload();
    } else {
      stopSnapshotListener();
    }
  };

  window.addEventListener("online", handleOnlineChange);
  window.addEventListener("offline", handleOnlineChange);
  syncState.unsubscribeOnline = () => {
    window.removeEventListener("online", handleOnlineChange);
    window.removeEventListener("offline", handleOnlineChange);
  };

  handleOnlineChange();
};

export const startAutoSync = (uid: string) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!uid) {
    return;
  }

  if (syncState.active && syncState.uid === uid) {
    return;
  }

  stopAutoSync();

  syncState.active = true;
  syncState.uid = uid;
  syncState.online = typeof navigator === "undefined" ? true : navigator.onLine;

  syncState.unsubscribeStore = useScenarioStore.subscribe((state) => {
    if (!syncState.active) {
      return;
    }

    if (!state.activeScenarioId) {
      return;
    }

    scheduleUpload();
  });

  startOnlineListener();
};

export const stopAutoSync = () => {
  syncState.active = false;
  syncState.uid = null;

  stopSnapshotListener();

  if (syncState.unsubscribeStore) {
    syncState.unsubscribeStore();
    syncState.unsubscribeStore = null;
  }

  if (syncState.unsubscribeOnline) {
    syncState.unsubscribeOnline();
    syncState.unsubscribeOnline = null;
  }

  if (syncState.uploadTimeout) {
    clearTimeout(syncState.uploadTimeout);
    syncState.uploadTimeout = null;
  }

  lastSyncedMap.clear();
  updateAutoSyncError(null);
};
