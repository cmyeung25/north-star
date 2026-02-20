import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const resolveMarketingBasePath = () => {
  const locale = cookies().get("aurin_locale")?.value;
  return locale === "en" ? "/en/web" : "/web";
};

export default function LegacyAuthRegisterPage() {
  redirect(`${resolveMarketingBasePath()}?auth=register`);
}
