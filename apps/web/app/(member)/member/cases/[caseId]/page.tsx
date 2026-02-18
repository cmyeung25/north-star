import { redirect } from "next/navigation";
import { caseEnterPath } from "../../../../../lib/routes/canonicalRoutes";

export default function LegacyCaseScenariosPage({ params }: { params: { caseId: string } }) {
  redirect(caseEnterPath(params.caseId));
}
