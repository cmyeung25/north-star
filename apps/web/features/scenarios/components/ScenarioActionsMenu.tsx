import { ActionIcon, Menu } from "@mantine/core";
import { useTranslations } from "next-intl";

type ScenarioActionsMenuProps = {
  scenarioName: string;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export default function ScenarioActionsMenu({
  scenarioName,
  onRename,
  onDuplicate,
  onDelete,
}: ScenarioActionsMenuProps) {
  const t = useTranslations("scenarios");
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          aria-label={t("actionsAria", { name: scenarioName })}
        >
          ⋮
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={onRename}>{t("rename")}</Menu.Item>
        <Menu.Item onClick={onDuplicate}>{t("duplicate")}</Menu.Item>
        <Menu.Item color="red" onClick={onDelete}>
          {t("delete")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
