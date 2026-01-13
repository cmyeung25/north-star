import { ActionIcon, Menu } from "@mantine/core";
import { t } from "../../../lib/i18n";

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
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          aria-label={t("scenariosActionsAria", { name: scenarioName })}
        >
          ⋮
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={onRename}>{t("scenariosRename")}</Menu.Item>
        <Menu.Item onClick={onDuplicate}>{t("scenariosDuplicate")}</Menu.Item>
        <Menu.Item color="red" onClick={onDelete}>
          {t("scenariosDelete")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
