"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

type BottomNavItem = {
  href: string;
  label: string;
};

type BottomNavProps = {
  items: BottomNavItem[];
};

export default function BottomNav({ items }: BottomNavProps) {
  const pathname = usePathname();
  const t = useTranslations("nav.bottom");

  return (
    <nav
      aria-label={t("ariaLabel")}
      style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: "0.5rem" }}
    >
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              borderRadius: "0.6rem",
              textDecoration: "none",
              color: active ? "var(--mantine-color-polar-0)" : "var(--mantine-color-polar-3)",
              fontWeight: active ? 700 : 500,
              padding: "0.5rem",
              textAlign: "center",
              background: active ? "rgba(35, 213, 171, 0.26)" : "transparent",
              border: active ? "1px solid rgba(35, 213, 171, 0.45)" : "1px solid transparent",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
