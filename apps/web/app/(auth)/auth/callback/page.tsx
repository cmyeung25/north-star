"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/member/cases");
  }, [router]);

  return <p>Signed in. Redirecting to cases…</p>;
}
