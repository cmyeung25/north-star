import { Button, Group, Paper } from "@mantine/core";
import { useTranslations } from "next-intl";

type StickyActionBarProps = {
  onSave: () => void;
  onRevert: () => void;
};

export default function StickyActionBar({
  onSave,
  onRevert,
}: StickyActionBarProps) {
  const t = useTranslations("stress");
  const common = useTranslations("common");
  return (
    <Paper
      withBorder
      shadow="md"
      radius={0}
      p="md"
      style={{ position: "sticky", bottom: 0, zIndex: 10 }}
    >
      <Group grow>
        <Button size="md" onClick={onSave}>
          {t("saveScenario")}
        </Button>
        <Button size="md" variant="light" onClick={onRevert}>
          {common("actionRevert")}
        </Button>
      </Group>
    </Paper>
  );
}
