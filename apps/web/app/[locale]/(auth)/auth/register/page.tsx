import { redirect } from "next/navigation";

type LocaleAuthRegisterPageProps = {
  params: { locale: string };
};

export default function LocaleAuthRegisterPage({ params }: LocaleAuthRegisterPageProps) {
  const basePath = params.locale === "en" ? "/en/web" : "/web";
  redirect(`${basePath}?auth=register`);
}
