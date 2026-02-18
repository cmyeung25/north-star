import { redirect } from "next/navigation";
import { memberCasesPath } from "../../../lib/routes/canonicalRoutes";

export default async function AppHomePage() {
  redirect(memberCasesPath());
}
