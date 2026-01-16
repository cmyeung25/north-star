import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { getFirestoreDb } from "../firebaseClient";
import { SCHEMA_VERSION } from "../../src/store/scenarioSchema";
import {
  exportScenarioState,
  importScenarioState,
  type ScenarioStatePayload,
} from "../../src/store/scenarioState";
import { saveToIndexedDB } from "../../src/store/scenarioPersistence";
import type { Scenario } from "../../src/store/scenarioStore";
import type { EventDefinition } from "../../src/domain/events/types";

const ensureFirestore = () => {
  const firestore = getFirestoreDb();
  if (!firestore) {
    throw new Error("Firestore is unavailable.");
  }

  return firestore;
};

export type CloudSummary = {
  hasData: boolean;
  scenarioCount: number;
  lastSyncedAt: number | null;
  schemaVersion: number | null;
};

type CloudScenarioDocument = {
  scenario: Scenario;
  revision: number;
  updatedAt: number;
};

type CloudMetaDocument = {
  lastSyncedAt?: number;
  schemaVersion?: number;
  eventLibrary?: EventDefinition[];
};

const getMetaRef = (uid: string) =>
  doc(ensureFirestore(), "users", uid, "meta");

const getScenariosRef = (uid: string) =>
  collection(ensureFirestore(), "users", uid, "scenarios");

const getScenarioDocRef = (uid: string, scenarioId: string) =>
  doc(ensureFirestore(), "users", uid, "scenarios", scenarioId);

const parseMeta = (value: CloudMetaDocument | undefined) => ({
  lastSyncedAt:
    typeof value?.lastSyncedAt === "number" ? value.lastSyncedAt : null,
  schemaVersion:
    typeof value?.schemaVersion === "number" ? value.schemaVersion : null,
  eventLibrary: Array.isArray(value?.eventLibrary) ? value?.eventLibrary : [],
});

export const fetchCloudSummary = async (uid: string): Promise<CloudSummary> => {
  const metaSnap = await getDoc(getMetaRef(uid));
  const meta = metaSnap.exists()
    ? parseMeta(metaSnap.data() as CloudMetaDocument)
    : { lastSyncedAt: null, schemaVersion: null };

  const scenariosSnap = await getDocs(getScenariosRef(uid));

  return {
    hasData: scenariosSnap.size > 0,
    scenarioCount: scenariosSnap.size,
    lastSyncedAt: meta.lastSyncedAt,
    schemaVersion: meta.schemaVersion,
  };
};

export const uploadLocalStateToCloud = async (uid: string) => {
  const snapshot = exportScenarioState();
  const scenariosSnap = await getDocs(getScenariosRef(uid));
  const existingRevisions = new Map<string, number>();
  const existingIds = new Set<string>();

  scenariosSnap.forEach((docSnap) => {
    existingIds.add(docSnap.id);
    const data = docSnap.data() as CloudScenarioDocument;
    if (typeof data.revision === "number") {
      existingRevisions.set(docSnap.id, data.revision);
    }
  });

  const batch = writeBatch(ensureFirestore());
  const now = Date.now();

  snapshot.scenarios.forEach((scenario) => {
    const previousRevision = existingRevisions.get(scenario.id) ?? 0;
    batch.set(getScenarioDocRef(uid, scenario.id), {
      scenario,
      revision: previousRevision + 1,
      updatedAt: now,
    } satisfies CloudScenarioDocument);
    existingIds.delete(scenario.id);
  });

  existingIds.forEach((scenarioId) => {
    batch.delete(getScenarioDocRef(uid, scenarioId));
  });

  batch.set(
    getMetaRef(uid),
    {
      lastSyncedAt: now,
      schemaVersion: snapshot.schemaVersion,
      eventLibrary: snapshot.eventLibrary,
    } satisfies CloudMetaDocument,
    { merge: true }
  );

  await batch.commit();

  return {
    lastSyncedAt: now,
    scenarioCount: snapshot.scenarios.length,
  };
};

export const downloadCloudStateToLocal = async (uid: string) => {
  const metaSnap = await getDoc(getMetaRef(uid));

  if (!metaSnap.exists()) {
    throw new Error("No cloud data found.");
  }

  const meta = parseMeta(metaSnap.data() as CloudMetaDocument);

  if (meta.schemaVersion === null || meta.schemaVersion !== SCHEMA_VERSION) {
    throw new Error("App update required before syncing.");
  }

  const scenariosSnap = await getDocs(getScenariosRef(uid));
  const scenarios: Scenario[] = [];

  scenariosSnap.forEach((docSnap) => {
    const data = docSnap.data() as CloudScenarioDocument;
    if (data?.scenario) {
      scenarios.push(data.scenario);
    }
  });

  const payload: ScenarioStatePayload = {
    schemaVersion: meta.schemaVersion,
    scenarios,
    eventLibrary: meta.eventLibrary,
    activeScenarioId: scenarios[0]?.id ?? "",
  };

  const normalized = importScenarioState(payload);
  await saveToIndexedDB(normalized);

  const now = Date.now();
  await setDoc(
    getMetaRef(uid),
    {
      lastSyncedAt: now,
      schemaVersion: meta.schemaVersion,
      eventLibrary: meta.eventLibrary,
    } satisfies CloudMetaDocument,
    { merge: true }
  );

  return {
    lastSyncedAt: now,
    scenarioCount: scenarios.length,
  };
};

export const requiresSchemaUpgrade = (summary: CloudSummary | null) => {
  if (!summary) {
    return false;
  }

  if (summary.hasData && summary.schemaVersion === null) {
    return true;
  }

  if (summary.schemaVersion === null) {
    return false;
  }

  return summary.schemaVersion !== SCHEMA_VERSION;
};
