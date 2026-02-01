"use client";

import React from "react";
import { CloseButton, TextInput, type TextInputProps } from "@mantine/core";

type MonthFieldProps = Omit<TextInputProps, "type" | "value" | "onChange"> & {
  value?: string | null;
  onChange: (value: string) => void;
  allowClear?: boolean;
};

export default function MonthField({
  value,
  onChange,
  allowClear = true,
  rightSection,
  ...props
}: MonthFieldProps) {
  const resolvedValue = value ?? "";
  const showClear = allowClear && resolvedValue !== "";

  return (
    <TextInput
      {...props}
      type="month"
      value={resolvedValue}
      onChange={(event) => onChange(event.currentTarget.value)}
      rightSection={
        showClear ? <CloseButton onClick={() => onChange("")} /> : rightSection
      }
    />
  );
}
