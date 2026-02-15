"use client";

import { Badge } from "@mantine/core";

type DiffBadgeProps = {
  delta: number;
  base?: number;
  polarity: "higherIsBetter" | "lowerIsBetter";
  showPercent?: boolean;
  compact?: boolean;
  formatter: (n: number) => string;
  className?: string;
};

const EPSILON = 1e-6;

export default function DiffBadge({
  delta,
  base,
  polarity,
  showPercent = true,
  compact = true,
  formatter,
  className,
}: DiffBadgeProps) {
  const normalizedDelta = Math.abs(delta) < EPSILON ? 0 : delta;
  const direction = normalizedDelta > 0 ? "up" : normalizedDelta < 0 ? "down" : "flat";
  const tone =
    normalizedDelta === 0
      ? "neutral"
      : polarity === "higherIsBetter"
        ? normalizedDelta > 0
          ? "good"
          : "bad"
        : normalizedDelta < 0
          ? "good"
          : "bad";

  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  const deltaText = normalizedDelta > 0 ? `+${formatter(normalizedDelta)}` : formatter(normalizedDelta);

  const percentText = (() => {
    if (!showPercent) return null;
    if (typeof base !== "number" || Math.abs(base) < EPSILON) return "(—)";
    const pct = normalizedDelta / Math.abs(base);
    const pctRounded = Math.abs(pct) < EPSILON ? 0 : pct;
    const sign = pctRounded > 0 ? "+" : "";
    return `(${sign}${(pctRounded * 100).toFixed(1)}%)`;
  })();

  const color = tone === "good" ? "teal" : tone === "bad" ? "red" : "gray";

  return (
    <Badge
      variant="light"
      color={color}
      radius="sm"
      className={className}
      style={{
        textTransform: "none",
        whiteSpace: "normal",
        lineHeight: 1.2,
        maxWidth: "100%",
        display: "inline-flex",
      }}
      aria-label={[arrow, deltaText, percentText].filter(Boolean).join(" ")}
      size={compact ? "sm" : "md"}
    >
      <span style={{ overflowWrap: "anywhere" }}>
        {arrow} {deltaText}
        {percentText ? ` ${percentText}` : ""}
      </span>
    </Badge>
  );
}
