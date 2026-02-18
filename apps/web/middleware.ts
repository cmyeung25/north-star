import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, locales, type Locale } from "./src/i18n/routing";
import { getSupabasePublishableKey, getSupabaseUrl } from "./src/lib/supabase/env";

const handleI18n = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
  localeDetection: false,
});

const stripLocalePrefix = (pathname: string) => {
  const localePrefix = locales.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );

  if (!localePrefix) {
    return pathname;
  }

  const stripped = pathname.replace(`/${localePrefix}`, "");
  return stripped === "" ? "/" : stripped;
};

const resolveLocaleFromPath = (pathname: string): Locale => {
  const localePrefix = locales.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );

  return localePrefix ?? defaultLocale;
};

const isProtectedRoute = (pathname: string) =>
  ["/app", "/member"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const isLegacyUnlocalizedRoute = (pathname: string) =>
  ["/app", "/web", "/account", "/auth/logout", "/auth/callback"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

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
  const { pathname, search } = request.nextUrl;
  const locale = resolveLocaleFromPath(pathname);
  const pathnameWithoutLocale = stripLocalePrefix(pathname);

  const response = isLegacyUnlocalizedRoute(pathname) ? NextResponse.next() : handleI18n(request);
  const { response: updatedResponse, user } = await updateSupabaseSession(request, response);

  if (isProtectedRoute(pathnameWithoutLocale) && !user) {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = locale === defaultLocale ? "/auth/login" : `/${locale}/auth/login`;
    nextUrl.searchParams.set("redirectTo", `${pathname}${search}`);
    return NextResponse.redirect(nextUrl);
  }

  return updatedResponse;
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|assets|.*\\..*).*)"],
};
