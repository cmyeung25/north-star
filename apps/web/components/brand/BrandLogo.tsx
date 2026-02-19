import { Group } from "@mantine/core";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "../../src/i18n/navigation";

type BrandLogoSize = "sm" | "md" | "lg";

type BrandLogoProps = {
  variant?: "icon" | "full";
  size?: BrandLogoSize;
  collapsed?: boolean;
  href?: string;
  className?: string;
  priority?: boolean;
  unoptimized?: boolean;
};

const iconSizeByScale: Record<BrandLogoSize, number> = {
  sm: 24,
  md: 32,
  lg: 40,
};

const wordmarkSizeByScale: Record<BrandLogoSize, { width: number; height: number }> = {
  sm: { width: 70, height: 42 },
  md: { width: 80, height: 52 },
  lg: { width: 94, height: 62 },
};

export default function BrandLogo({
  variant = "full",
  size = "md",
  collapsed = false,
  href = "/member/cases",
  className,
  priority = false,
  unoptimized = true,
}: BrandLogoProps) {
  const t = useTranslations("nav.brand");
  const iconSize = iconSizeByScale[size];
  const showWordmark = variant === "full" && !collapsed;
  const wordmarkSize = wordmarkSizeByScale[size];

  return (
    <Link
      href={href}
      className={className}
      aria-label={t("ariaLabel")}
      style={{ display: "inline-flex", alignItems: "center" }}
    >
      <Group gap="xs" wrap="nowrap">
        <Image
          src="/aurin-icon-square.png"
          alt=""
          width={iconSize}
          height={iconSize}
          priority={priority}
          unoptimized={unoptimized}
        />
        {showWordmark && false && (
          <Image
            src="/aurin-wordmark.png"
            alt="Aurin"
            width={wordmarkSize.width}
            height={wordmarkSize.height}
            priority={priority}
            unoptimized={unoptimized}
          />
        )}
      </Group>
    </Link>
  );
}