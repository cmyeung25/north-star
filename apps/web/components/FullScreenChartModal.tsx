"use client";

import { Modal } from "@mantine/core";
import type { TimeSeriesPoint, MilestoneMarker } from "../features/overview/types";
import ZoomableLineChart from "../features/overview/components/ZoomableLineChart";

export type FullScreenChartType = "cash" | "netWorth" | "netCashflow";

type FullScreenChartModalProps = {
  opened: boolean;
  onClose: () => void;
  type?: FullScreenChartType;
  data: TimeSeriesPoint[];
  markers: MilestoneMarker[],
  title: string;
};

const chartColors: Record<FullScreenChartType, string> = {
  cash: "#4c6ef5",
  netWorth: "#12b886",
  netCashflow: "#15aabf",
};

export default function FullScreenChartModal({
  opened,
  onClose,
  type = "cash",
  data,
  markers,
  title,
}: FullScreenChartModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} fullScreen centered title={title}>
      <ZoomableLineChart data={data} markers={markers} color={chartColors[type]} height={560} />
    </Modal>
  );
}
