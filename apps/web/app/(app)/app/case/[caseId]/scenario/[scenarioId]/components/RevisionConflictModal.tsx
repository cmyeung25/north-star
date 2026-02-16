"use client";

type Props = {
  open: boolean;
  onReload: () => void;
  onSaveAsNew: () => void;
  onClose: () => void;
  busy?: boolean;
};

export default function RevisionConflictModal({ open, onReload, onSaveAsNew, onClose, busy }: Props) {
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
        <h3>Revision conflict</h3>
        <p>The cloud revision changed. Reload from cloud or save your work as a new scenario.</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} disabled={busy}>Cancel</button>
          <button onClick={onReload} disabled={busy}>Reload from cloud</button>
          <button onClick={onSaveAsNew} disabled={busy}>Save as new scenario</button>
        </div>
      </div>
    </div>
  );
}
