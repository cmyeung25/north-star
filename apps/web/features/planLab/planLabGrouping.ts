export type PlanLabGroupBy = "domain" | "member" | "timeBucket";

export type BuildPlanLabGroupsOptions<T> = {
  resolveGroupLabel: (params: { groupBy: PlanLabGroupBy; item: T }) => string;
  resolveImpact?: (item: T) => number;
  resolveStableSortValue?: (item: T) => number;
  resolveTitle?: (item: T) => string;
  resolveStartMonth?: (item: T) => string | undefined;
};

export const buildPlanLabGroups = <T>(
  items: T[],
  mode: "edit" | "compare",
  groupBy: PlanLabGroupBy,
  options: BuildPlanLabGroupsOptions<T>
): Array<[string, T[]]> => {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    const groupKey = options.resolveGroupLabel({ groupBy, item });
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(item);
  });

  const sortTitle = options.resolveTitle ?? ((item: T) => String((item as { title?: string }).title ?? ""));
  const sortImpact = options.resolveImpact ?? (() => 0);
  const sortStable = options.resolveStableSortValue ?? (() => 0);

  const normalizeStartMonth = (item: T) => options.resolveStartMonth?.(item) ?? (item as { startMonth?: string }).startMonth;

  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([group, groupItems]) => {
      const sortedItems = [...groupItems].sort((left, right) => {
        if (mode === "compare") {
          const impactDiff = sortImpact(right) - sortImpact(left);
          if (impactDiff !== 0) {
            return impactDiff;
          }
        }

        if (groupBy === "timeBucket") {
          const leftMonth = normalizeStartMonth(left) ?? "9999-99";
          const rightMonth = normalizeStartMonth(right) ?? "9999-99";
          const monthCompare = leftMonth.localeCompare(rightMonth);
          if (monthCompare !== 0) {
            return monthCompare;
          }
        }

        const stableDiff = sortStable(right) - sortStable(left);
        if (stableDiff !== 0) {
          return stableDiff;
        }

        return sortTitle(left).localeCompare(sortTitle(right));
      });
      return [group, sortedItems] as [string, T[]];
    });
};
