import { NumberInput, Stack, Table, Text } from "@mantine/core";
import type { CashflowEvent } from "../../../../domain/scenarioV2/events";
import type { GeneratedItemMetadata } from "../../../../domain/scenarioDraft/types";

type Row = CashflowEvent & { metadata?: GeneratedItemMetadata };

type Props = {
  rows: Row[];
  onOverrideAmount: (eventId: string, amount: number) => void;
};

export default function ExpenseStep({ rows, onOverrideAmount }: Props) {
  return (
    <Stack>
      <Text size="sm">Auto-generated expenses (mortgage payment / holding cost) with source labels.</Text>
      <Table>
        <Table.Thead>
          <Table.Tr><Table.Th>Source</Table.Th><Table.Th>Rule</Table.Th><Table.Th>Amount</Table.Th><Table.Th>Editable</Table.Th></Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.id}>
              <Table.Td>{row.metadata?.originAssetId ?? "manual"}</Table.Td>
              <Table.Td>{row.metadata?.generatedByRule ?? "manual"}</Table.Td>
              <Table.Td><NumberInput value={row.amount} onChange={(value) => onOverrideAmount(row.id, typeof value === "number" ? value : 0)} /></Table.Td>
              <Table.Td>{row.metadata?.editableFields.join(", ") ?? "amount"}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
