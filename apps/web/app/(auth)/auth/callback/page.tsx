"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const t = useTranslations("auth.callback");
  const router = useRouter();

  useEffect(() => {
    router.replace("/member/cases");
  }, [router]);

  return <p>{t("redirecting")}</p>;
}
