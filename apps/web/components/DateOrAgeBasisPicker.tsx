"use client";

import { SegmentedControl } from "@mantine/core";

export type DateOrAgeBasis = "month" | "age";

type DateOrAgeBasisPickerProps = {
  value: DateOrAgeBasis;
  onChange: (value: DateOrAgeBasis) => void;
  monthLabel: string;
  ageLabel: string;
  disableAge?: boolean;
};

export default function DateOrAgeBasisPicker({
  value,
  onChange,
  monthLabel,
  ageLabel,
  disableAge = false,
}: DateOrAgeBasisPickerProps) {
  return (
    <SegmentedControl
      value={value}
      onChange={(nextValue) => onChange(nextValue as DateOrAgeBasis)}
      data={[
        { value: "month", label: monthLabel },
        { value: "age", label: ageLabel, disabled: disableAge },
      ]}
    />
  );
}
