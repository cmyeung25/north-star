import { redirect } from "next/navigation";

type LocaleAuthLoginPageProps = {
  params: { locale: string };
};

export default function LocaleAuthLoginPage({ params }: LocaleAuthLoginPageProps) {
  const basePath = params.locale === "en" ? "/en/web" : "/web";
  redirect(`${basePath}?auth=login`);
}
