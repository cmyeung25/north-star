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
  if (!input) return defaultLocale;
  const normalized = input.toLowerCase();
  if (normalized.startsWith("zh-hk") || normalized.startsWith("zh-tw") || normalized.startsWith("zh-hant")) {
    return "zh-Hant-HK";
  }
  if (normalized.startsWith("en")) return "en";
  return defaultLocale;
};

const hasLocalePrefix = (pathname: string) =>
  locales.some((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));

const isSegmentedRoute = (pathname: string) =>
  pathname === "/" || ["/web", "/app", "/auth", "/account", "/member"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const isProtectedRoute = (pathname: string) =>
  ["/app", "/member", "/account"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

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

  const { data } = await supabase.auth.getUser();
  return { response, user: data.user };
};

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response: NextResponse;
  if (isSegmentedRoute(pathname)) {
    response = NextResponse.next();
  } else if (!hasLocalePrefix(pathname)) {
    const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
    const acceptLanguage = request.headers.get("accept-language")?.split(",")[0]?.trim();
    const resolvedLocale = mapLocale(cookieLocale ?? acceptLanguage);
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = `/${resolvedLocale}${pathname}`;
    response = NextResponse.redirect(nextUrl);
  } else {
    response = handleI18n(request);
  }

  const { response: updatedResponse, user } = await updateSupabaseSession(request, response);

  if (isProtectedRoute(pathname) && !user) {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = "/auth/login";
    nextUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(nextUrl);
  }

  return updatedResponse;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images|_vercel|.*\..*).*)"],
};
