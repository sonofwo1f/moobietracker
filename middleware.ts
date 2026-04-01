import { NextRequest, NextResponse } from "next/server";

const SITE_AUTH_COOKIE = "moobie_access";

function isProtectedPath(pathname: string) {
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap")
  ) {
    return false;
  }
  if (pathname === "/login" || pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/auth/logout")) {
    return false;
  }
  return true;
}

export function middleware(request: NextRequest) {
  const sitePassword = process.env.SITE_PASSWORD?.trim();
  if (!sitePassword || !isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const authenticated = request.cookies.get(SITE_AUTH_COOKIE)?.value === "1";
  if (authenticated) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  if (request.nextUrl.pathname !== "/") {
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!.*\\.[\\w]+$).*)"],
};
