"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import SaveStatusChip from "../../../../components/SaveStatusChip";
import { useScenarioCloudStore } from "../../../../../../../src/store/scenarioCloudStore";

type ScenarioAppShellProps = {
  title: string;
  children: ReactNode;
};

type WorkspaceTab = {
  href: string;
  label: string;
};

export default function ScenarioAppShell({ title, children }: ScenarioAppShellProps) {
  const pathname = usePathname();
  const params = useParams<{ caseId?: string; scenarioId?: string }>();
  const meta = useScenarioCloudStore((state) => state.active);

  const caseId = params.caseId ?? "";
  const scenarioId = params.scenarioId ?? "";

  const tabs: WorkspaceTab[] = [
    { href: `/app/case/${caseId}/scenario/${scenarioId}/dashboard`, label: "Dashboard" },
    { href: `/app/case/${caseId}/scenario/${scenarioId}/money`, label: "Money" },
    { href: `/app/case/${caseId}/scenario/${scenarioId}/planlab`, label: "Plan Lab" },
  ];

  return (
    <section style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: "calc(100vh - 6rem)" }}>
      <aside style={{ borderRight: "1px solid #e5e7eb", padding: "1rem" }}>
        <nav style={{ display: "grid", gap: "0.5rem" }}>
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  borderRadius: "0.5rem",
                  textDecoration: "none",
                  color: active ? "#0b355d" : "#334155",
                  fontWeight: active ? 600 : 500,
                  padding: "0.45rem 0.55rem",
                  background: active ? "#e8f2ff" : "transparent",
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minWidth: 0 }}>
        <header
          style={{
            borderBottom: "1px solid #e5e7eb",
            padding: "0.9rem 1.1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.8rem",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>{title}</h1>
          {meta ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <SaveStatusChip status={meta.saveStatus} />
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {meta.lastSavedAt ? `Updated ${new Date(meta.lastSavedAt).toLocaleString()}` : "Not saved yet"}
              </span>
            </div>
          ) : null}
        </header>
        <div style={{ padding: "1rem 1.1rem", minWidth: 0 }}>{children}</div>
      </div>
    </section>
  );
}
