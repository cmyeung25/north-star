"use client";

import { Box } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "../../../lib/i18n";
import type { TimeSeriesPoint } from "../types";

const MIN_WINDOW = 6;

type DragState = {
  startX: number;
  startIndex: number;
  endIndex: number;
};

type ZoomableLineChartProps = {
  data: TimeSeriesPoint[];
  color?: string;
  height?: number;
};

export default function ZoomableLineChart({
  data,
  color = "#4c6ef5",
  height = 520,
}: ZoomableLineChartProps) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(Math.max(0, data.length - 1));
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setStartIndex(0);
    setEndIndex(Math.max(0, data.length - 1));
  }, [data]);

  const clampRange = (nextStart: number, windowSize: number) => {
    const clampedStart = Math.max(0, Math.min(nextStart, data.length - windowSize));
    return {
      start: clampedStart,
      end: clampedStart + windowSize - 1,
    };
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (data.length <= 1) {
      return;
    }
    event.preventDefault();
    const direction = event.deltaY < 0 ? -1 : 1;
    const windowSize = endIndex - startIndex + 1;
    const minWindow = Math.min(MIN_WINDOW, data.length);
    const scale = direction < 0 ? 0.9 : 1.1;
    let nextWindow = Math.round(windowSize * scale);
    nextWindow = Math.max(minWindow, Math.min(data.length, nextWindow));
    const center = startIndex + windowSize / 2;
    const nextStart = Math.round(center - nextWindow / 2);
    const { start, end } = clampRange(nextStart, nextWindow);
    setStartIndex(start);
    setEndIndex(end);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (data.length <= 1) {
      return;
    }
    if (event.button !== 0 && event.button !== 2) {
      return;
    }
    dragRef.current = {
      startX: event.clientX,
      startIndex,
      endIndex,
    };
    setIsDragging(true);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current || data.length <= 1) {
      return;
    }
    const { startX, startIndex: dragStart, endIndex: dragEnd } = dragRef.current;
    const containerWidth = containerRef.current?.offsetWidth ?? 1;
    const windowSize = dragEnd - dragStart + 1;
    const deltaPoints = Math.round(((event.clientX - startX) * windowSize) / containerWidth);
    const nextStart = dragStart - deltaPoints;
    const { start, end } = clampRange(nextStart, windowSize);
    setStartIndex(start);
    setEndIndex(end);
  };

  const handleMouseUp = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  const visibleData = useMemo(
    () => data.slice(startIndex, endIndex + 1),
    [data, endIndex, startIndex]
  );

  return (
    <Box
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(event) => event.preventDefault()}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
    >
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <LineChart data={visibleData} margin={{ left: 16, right: 24 }}>
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 12 }}
              width={80}
              tickFormatter={(value) => formatCurrency(Number(value), undefined, locale)}
            />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value), undefined, locale)}
              labelFormatter={(label) => t("monthLabel", { month: label })}
            />
            <ReferenceLine y={0} stroke="#ced4da" />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Box>
  );
}
