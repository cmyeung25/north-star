import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanSnapshot } from "../../domain/planLab/types";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

const localStorageMock = new MemoryStorage();
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  configurable: true,
});
Object.defineProperty(globalThis, "window", {
  value: { localStorage: localStorageMock },
  configurable: true,
});

const buildSnapshot = (): PlanSnapshot => ({
  id: "snapshot-1",
  name: "Plan Alpha",
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
  baselineScenarioId: "scenario-1",
  baselineSignature: "sig-1",
  payload: { eventsPatch: { add: [], update: [], remove: [] } },
  snapshot: {},
});

describe("planLibrary storage", () => {
  beforeEach(() => {
    localStorageMock.clear();
    (vi as unknown as { resetModules: () => void }).resetModules();
  });

  it("PlanLab snapshots persist and load", async () => {
    const { loadSnapshots, saveSnapshot } = await import("../planLibrary");
    saveSnapshot(buildSnapshot());

    const loaded = loadSnapshots();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({
      id: "snapshot-1",
      baselineScenarioId: "scenario-1",
      baselineSignature: "sig-1",
    });
  });

  it("supports update and delete roundtrip", async () => {
    const { PLAN_LIBRARY_KEY, deleteSnapshot, loadSnapshots, saveSnapshot, updateSnapshot } =
      await import("../planLibrary");

    saveSnapshot(buildSnapshot());
    updateSnapshot("snapshot-1", { name: "Plan Beta", updatedAt: 1700000001000 });

    let loaded = loadSnapshots();
    expect(loaded[0]?.name).toBe("Plan Beta");

    deleteSnapshot("snapshot-1");
    loaded = loadSnapshots();
    expect(loaded).toEqual([]);
    expect(localStorageMock.getItem(PLAN_LIBRARY_KEY)).toBe("[]");
  });
});
