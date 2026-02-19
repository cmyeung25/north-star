"use client";

import { useTranslations } from "next-intl";

type Props = {
  open: boolean;
  onReload: () => void;
  onSaveAsNew: () => void;
  onClose: () => void;
  busy?: boolean;
};

export default function RevisionConflictModal({
  open,
  onReload,
  onSaveAsNew,
  onClose,
  busy,
}: Props) {
  const t = useTranslations("app.conflict");

  if (!open) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "grid",
        placeItems: "center",
        zIndex: 50,
      }}
    >
      <div style={{ background: "white", borderRadius: 8, width: 460, padding: "1rem" }}>
        <h3>{t("title")}</h3>
        <p>{t("description")}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} disabled={busy}>{t("actions.cancel")}</button>
          <button onClick={onReload} disabled={busy}>{t("actions.reloadFromCloud")}</button>
          <button onClick={onSaveAsNew} disabled={busy}>{t("actions.saveAsNewScenario")}</button>
        </div>
      </div>
    </div>
  );
}
