import { ActionIcon, Menu } from "@mantine/core";

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
        <ActionIcon variant="subtle" aria-label={`Actions for ${scenarioName}`}>
          ⋮
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={onRename}>Rename</Menu.Item>
        <Menu.Item onClick={onDuplicate}>Duplicate</Menu.Item>
        <Menu.Item color="red" onClick={onDelete}>
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
