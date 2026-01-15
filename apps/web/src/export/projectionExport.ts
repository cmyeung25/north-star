import type { ProjectionResult } from "@north-star/engine";
import type { Scenario } from "../store/scenarioStore";

export type Projection = ProjectionResult;

type ProjectionCsvOptions = {
  includeHeader?: boolean;
};

const csvEscape = (value: string) => {
  const needsQuotes = /[",\n\r]/.test(value);
  if (!needsQuotes) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
};

export const projectionToCSV = (
  projection: Projection,
  options: ProjectionCsvOptions = {}
) => {
  const includeHeader = options.includeHeader ?? true;
  const header = ["month", "cash", "assetsTotal", "liabilitiesTotal", "netWorth"];
  const rows = projection.months.map((month, index) => {
    const row = [
      month,
      projection.cashBalance[index] ?? 0,
      projection.assets.total[index] ?? 0,
      projection.liabilities.total[index] ?? 0,
      projection.netWorth[index] ?? 0,
    ];
    return row
      .map((value) =>
        csvEscape(typeof value === "number" ? String(value) : String(value))
      )
      .join(",");
  });

  if (includeHeader) {
    return [header.join(","), ...rows].join("\n");
  }

  return rows.join("\n");
};

export const downloadTextFile = (filename: string, mime: string, content: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const sanitizeFilenamePart = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "");

const formatTimestamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace(/Z$/, "Z");

export const buildExportFilename = (
  scenario: Scenario,
  kind: "projection" | "projection_raw",
  ext: "csv" | "json"
) => {
  const scenarioName = sanitizeFilenamePart(scenario.name || "scenario");
  const baseMonth = scenario.assumptions.baseMonth ?? "unknown-month";
  const timestamp = formatTimestamp(new Date());
  return `${scenarioName}_${kind}_${baseMonth}_${timestamp}.${ext}`;
};
