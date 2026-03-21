import { notFound } from "next/navigation";
import WeeklyProductAnalyticsDashboard from "./WeeklyProductAnalyticsDashboard";

const isDebugEnabled =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ENABLE_DEBUG === "true";

export default function WeeklyProductAnalyticsDashboardPage() {
  if (!isDebugEnabled) {
    notFound();
  }

  return <WeeklyProductAnalyticsDashboard />;
}
