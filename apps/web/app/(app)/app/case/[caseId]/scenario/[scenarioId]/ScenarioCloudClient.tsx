"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { selectPersistedState, useScenarioStore } from "../../../../../../../src/store/scenarioStore";
import { importScenarioPayload } from "../../../../../../../src/persistence/scenarioPayload";
import { saveScenarioPayloadAction } from "./actions";

type Props = {
  caseId: string;
  scenarioId: string;
  initialPayload: Record<string, unknown>;
  initialRevision: number;
  title: string;
  updatedAt: string;
};

export default function ScenarioCloudClient(props: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [lastSavedAt, setLastSavedAt] = useState(props.updatedAt);
  const [revision, setRevision] = useState(props.initialRevision);

  const initialHash = useMemo(() => JSON.stringify(props.initialPayload), [props.initialPayload]);
  const currentHash = JSON.stringify(selectPersistedState(useScenarioStore.getState()));
  const dirty = currentHash !== initialHash;

  const openApp = () => {
    importScenarioPayload(props.initialPayload as never);
    router.push("/en/dashboard");
  };

  const save = async () => {
    try {
      setStatus("saving");
      const payload = selectPersistedState(useScenarioStore.getState()) as unknown as Record<string, unknown>;
      const result = await saveScenarioPayloadAction(props.caseId, props.scenarioId, payload, revision);
      setRevision(result.revision);
      setLastSavedAt(result.lastSavedAt);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <section>
      <h1>{props.title}</h1>
      <p>Cloud status: {dirty ? "dirty" : status}</p>
      <p>Last saved at: {lastSavedAt}</p>
      <button onClick={openApp}>Hydrate and open app</button>
      <button onClick={save}>Save to cloud</button>
    </section>
  );
}
