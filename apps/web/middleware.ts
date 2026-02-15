import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "./src/lib/supabase/env";
import { defaultLocale, locales, type Locale } from "./src/i18n/routing";

const handleI18n = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
  localeDetection: false,
});

const mapLocale = (input?: string | null): Locale => {
  if (!input) {
    return defaultLocale;
  }

  const normalized = input.toLowerCase();

  if (normalized.startsWith("zh-hk") || normalized.startsWith("zh-tw") || normalized.startsWith("zh-hant")) {
    return "zh-Hant-HK";
  }

  if (normalized.startsWith("en")) {
    return "en";
  }

  return defaultLocale;
};

const hasLocalePrefix = (pathname: string) =>
  locales.some((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));

const updateSupabaseSession = async (request: NextRequest, response: NextResponse) => {
  const supabase = createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getUser();

  return response;
};

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response: NextResponse;

  if (!hasLocalePrefix(pathname)) {
    const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
    const acceptLanguage = request.headers.get("accept-language")?.split(",")[0]?.trim();
    const resolvedLocale = mapLocale(cookieLocale ?? acceptLanguage);
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = `/${resolvedLocale}${pathname}`;
    response = NextResponse.redirect(nextUrl);
  } else {
    response = handleI18n(request);
  }

  return updateSupabaseSession(request, response);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images|_vercel|.*\\..*).*)"],
};
