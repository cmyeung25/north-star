import { notFound } from "next/navigation";
import MigrationDebugDashboard from "./MigrationDebugDashboard";

const isDebugEnabled =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ENABLE_DEBUG === "true";

export default function MigrationDebugPage() {
  if (!isDebugEnabled) {
    notFound();
  }

  return <MigrationDebugDashboard />;
}
