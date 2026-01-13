import type { ScenarioRiskLevel } from "./types";

export const riskColorMap: Record<ScenarioRiskLevel, string> = {
  Low: "teal",
  Medium: "yellow",
  High: "red",
};

export const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

export const formatRelativeTime = (updatedAt: number) => {
  const diffMs = Date.now() - updatedAt;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return "Today";
  }

  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  if (diffDays < 30) {
    const weeks = Math.round(diffDays / 7);
    return `${weeks}w ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(updatedAt));
};
