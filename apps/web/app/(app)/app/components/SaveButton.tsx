"use client";

type Props = {
  disabled?: boolean;
  onClick: () => void;
};

export default function SaveButton({ disabled, onClick }: Props) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: "0.35rem 0.75rem" }}>
      保存到雲端
    </button>
  );
}
