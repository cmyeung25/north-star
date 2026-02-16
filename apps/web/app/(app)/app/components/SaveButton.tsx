"use client";

type Props = {
  disabled?: boolean;
  onClick: () => void;
  title?: string;
};

export default function SaveButton({ disabled, onClick, title }: Props) {
  return (
    <button title={title} onClick={onClick} disabled={disabled} style={{ padding: "0.35rem 0.75rem" }}>
      保存到雲端
    </button>
  );
}
