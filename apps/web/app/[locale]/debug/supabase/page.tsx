import { notFound } from "next/navigation";
import DebugSupabasePanel from "./DebugSupabasePanel";

const isDebugEnabled =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ENABLE_DEBUG === "true";

export default function SupabaseDebugPage() {
  if (!isDebugEnabled) {
    notFound();
  }

  return <DebugSupabasePanel />;
}
