import { Group, ScrollArea } from "@mantine/core";
import KpiCard from "./KpiCard";

interface KpiItem {
  label: string;
  value: string;
  helper?: string;
  badgeLabel?: string;
  badgeColor?: string;
  onDetails?: () => void;
  detailsLabel?: string;
}

interface KpiCarouselProps {
  items: KpiItem[];
}

export default function KpiCarousel({ items }: KpiCarouselProps) {
  return (
    <ScrollArea scrollbarSize={4} offsetScrollbars>
      <Group gap="sm" wrap="nowrap">
        {items.map((item) => (
          <div key={item.label} style={{ minWidth: 220, flex: "0 0 auto" }}>
            <KpiCard {...item} />
          </div>
        ))}
      </Group>
    </ScrollArea>
  );
}
