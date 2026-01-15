import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
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

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!hasLocalePrefix(pathname)) {
    const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
    const acceptLanguage = request.headers.get("accept-language")?.split(",")[0]?.trim();
    const resolvedLocale = mapLocale(cookieLocale ?? acceptLanguage);
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = `/${resolvedLocale}${pathname}`;
    return NextResponse.redirect(nextUrl);
  }

  return handleI18n(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
