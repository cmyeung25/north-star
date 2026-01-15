import type { ProjectionResult } from "@north-star/engine";
import type { Scenario } from "../store/scenarioStore";

export type Projection = ProjectionResult;

type ProjectionCsvOptions = {
  includeHeader?: boolean;
};

const escapeCsvValue = (value: string) => {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
};

const toCsvRow = (values: (string | number)[]) =>
  values.map((value) => escapeCsvValue(String(value))).join(",");

export function projectionToCSV(
  projection: Projection,
  options: ProjectionCsvOptions = {}
): string {
  const includeHeader = options.includeHeader ?? true;
  const rows: string[] = [];

  if (includeHeader) {
    rows.push(toCsvRow(["month", "cash", "assetsTotal", "liabilitiesTotal", "netWorth"]));
  }

  projection.months.forEach((month, index) => {
    rows.push(
      toCsvRow([
        month,
        projection.cashBalance[index] ?? 0,
        projection.assets.total[index] ?? 0,
        projection.liabilities.total[index] ?? 0,
        projection.netWorth[index] ?? 0,
      ])
    );
  });

  return rows.join("\n");
}

export function downloadTextFile(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const normalizeFilename = (value: string) =>
  value.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");

export function buildExportFilename(
  scenario: Scenario,
  kind: "projection" | "projection_raw",
  ext: "csv" | "json"
): string {
  const baseMonth = scenario.assumptions.baseMonth ?? "unknown";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const scenarioSlug = normalizeFilename(scenario.name) || "scenario";
  return `${scenarioSlug}-${kind}-${baseMonth}-${timestamp}.${ext}`;
}
