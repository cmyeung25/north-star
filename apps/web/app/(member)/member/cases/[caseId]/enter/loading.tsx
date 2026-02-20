import { RouteLoadingOverlay } from '../../../../../../src/components/loading/route-loading-overlay';

export default function CaseEnterLoading() {
  return (
    <RouteLoadingOverlay
      opened
      title="Opening case…"
      description="Loading your planning data…"
    />
  );
}
