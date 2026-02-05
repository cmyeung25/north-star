import {
  Badge,
  Button,
  Card,
  Drawer,
  Modal,
  Paper,
  SegmentedControl,
  Table,
  createTheme,
  rem,
} from "@mantine/core";

const aurora = [
  "#F4FFFB",
  "#E9FFF7",
  "#D6FFF0",
  "#B6F7E4",
  "#86EAD2",
  "#4FDCC0",
  "#23D5AB",
  "#13B892",
  "#0D8E71",
  "#06624D",
 ] as const;

const polar = [
  "#F2F6FF",
  "#DDE7FF",
  "#B8CBFF",
  "#8EABFF",
  "#6B8FFF",
  "#4A74FF",
  "#2F5EEB",
  "#2148B8",
  "#17348A",
  "#0B1B3A",
 ] as const;

const ice = [
  "#F2FBFF",
  "#E3F6FF",
  "#C7EDFF",
  "#A3E0FF",
  "#79D1FF",
  "#4FC0F2",
  "#33AEE0",
  "#248BB4",
  "#1A6786",
  "#0F3D52",
 ] as const;

const neutral = [
  "#F8FAFC",
  "#F1F5F9",
  "#E2E8F0",
  "#CBD5E1",
  "#94A3B8",
  "#64748B",
  "#475569",
  "#334155",
  "#1E293B",
  "#0F172A",
 ] as const;

export const aurinTheme = createTheme({
  primaryColor: "aurora",
  primaryShade: 6,
  colors: {
    aurora,
    polar,
    ice,
    neutral,
    success: ["#ECFDF3", "#D1FADF", "#A6F4C5", "#6CE9A6", "#32D583", "#16A34A", "#15803D", "#166534", "#14532D", "#052E16"],
    warning: ["#FFFBEB", "#FEF3C7", "#FDE68A", "#FCD34D", "#FBBF24", "#F59E0B", "#D97706", "#B45309", "#92400E", "#78350F"],
    danger: ["#FEF2F2", "#FEE2E2", "#FECACA", "#FCA5A5", "#F87171", "#DC2626", "#B91C1C", "#991B1B", "#7F1D1D", "#450A0A"],
    info: ["#F0F9FF", "#E0F2FE", "#BAE6FD", "#7DD3FC", "#38BDF8", "#0EA5E9", "#0284C7", "#0369A1", "#075985", "#0C4A6E"],
  },
  fontFamily: "Inter, Noto Sans TC, system-ui, -apple-system, sans-serif",
  headings: {
    fontFamily: "Inter, Noto Sans TC, system-ui, -apple-system, sans-serif",
    sizes: {
      h1: { fontSize: rem(20), lineHeight: "1.3", fontWeight: "700" },
      h2: { fontSize: rem(18), lineHeight: "1.35", fontWeight: "700" },
      h3: { fontSize: rem(16), lineHeight: "1.4", fontWeight: "600" },
      h4: { fontSize: rem(14), lineHeight: "1.45", fontWeight: "600" },
      h5: { fontSize: rem(14), lineHeight: "1.45", fontWeight: "600" },
      h6: { fontSize: rem(14), lineHeight: "1.45", fontWeight: "600" },
    },
  },
  fontSizes: {
    xs: rem(12),
    sm: rem(13),
    md: rem(14),
    lg: rem(16),
    xl: rem(18),
  },
  lineHeights: {
    xs: "1.4",
    sm: "1.45",
    md: "1.5",
    lg: "1.55",
    xl: "1.6",
  },
  spacing: {
    xs: rem(8),
    sm: rem(12),
    md: rem(16),
    lg: rem(24),
    xl: rem(32),
  },
  radius: {
    sm: rem(8),
    md: rem(10),
    lg: rem(16),
  },
  defaultRadius: "md",
  shadows: {
    xs: "0 1px 2px rgba(11, 27, 58, 0.04)",
    sm: "0 2px 8px rgba(11, 27, 58, 0.08)",
    md: "0 6px 18px rgba(11, 27, 58, 0.12)",
    lg: "0 10px 24px rgba(11, 27, 58, 0.14)",
    xl: "0 16px 40px rgba(11, 27, 58, 0.16)",
  },
  other: {
    aurin: {
      primary900: "#0B1B3A",
      accent500: "#23D5AB",
      info500: "#5BC0EB",
      border200: "#E2E8F0",
      surface50: "#F8FAFC",
      card: "#FFFFFF",
      title: "#0F172A",
      body: "#334155",
      muted: "#64748B",
    },
  },
  components: {
    Button: Button.extend({
      defaultProps: {
        radius: "md",
      },
      styles: (theme, props) => ({
        root: {
          fontWeight: 600,
          paddingInline: rem(14),
          ...(props.variant === "filled"
            ? {
                color: "#052E16",
              }
            : {}),
          ...(props.variant === "outline"
            ? {
                borderColor: theme.colors.neutral[3],
                color: theme.colors.polar[9],
              }
            : {}),
          ...(props.color === "danger"
            ? {
                color: "#FFFFFF",
              }
            : {}),
        },
      }),
    }),
    Badge: Badge.extend({
      defaultProps: {
        radius: "xl",
      },
      styles: (theme, props) => ({
        root: {
          ...(props.variant === "light" && props.color === "aurora"
            ? {
                backgroundColor: theme.colors.aurora[1],
                color: theme.colors.aurora[8],
              }
            : {}),
        },
      }),
    }),
    Paper: Paper.extend({
      defaultProps: {
        withBorder: true,
        radius: "md",
        shadow: "xs",
      },
      styles: () => ({
        root: {
          borderColor: "#E2E8F0",
          backgroundColor: "#FFFFFF",
        },
      }),
    }),
    Card: Card.extend({
      defaultProps: {
        radius: "md",
        shadow: "xs",
        padding: "md",
        withBorder: true,
      },
      styles: () => ({
        root: {
          borderColor: "#E2E8F0",
          backgroundColor: "#FFFFFF",
        },
      }),
    }),
    SegmentedControl: SegmentedControl.extend({
      defaultProps: {
        radius: "md",
        size: "sm",
      },
      styles: (theme) => ({
        root: {
          backgroundColor: theme.colors.neutral[1],
        },
        indicator: {
          boxShadow: "none",
          border: `1px solid ${theme.colors.neutral[2]}`,
        },
        label: {
          fontWeight: 600,
        },
      }),
    }),
    Table: Table.extend({
      styles: (theme) => ({
        table: {
          borderCollapse: "separate",
          borderSpacing: 0,
        },
        th: {
          backgroundColor: theme.colors.neutral[0],
          color: theme.colors.neutral[7],
          fontWeight: 600,
          borderBottom: `1px solid ${theme.colors.neutral[2]}`,
        },
        td: {
          borderBottom: `1px solid ${theme.colors.neutral[1]}`,
          color: theme.colors.neutral[8],
        },
      }),
    }),
    Modal: Modal.extend({
      defaultProps: {
        radius: "lg",
        padding: "lg",
        shadow: "md",
      },
    }),
    Drawer: Drawer.extend({
      defaultProps: {
        radius: "lg",
        padding: "lg",
        shadow: "md",
      },
    }),
  },
});
