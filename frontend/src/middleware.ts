import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Gates access based on presence of the aivis_auth_present cookie set by the Zustand auth
 * store (src/store/auth-store.ts) on login/signup. This only proves a token exists client-side
 * -- it does not validate the JWT (middleware runs on the edge without the backend's secret).
 * Every protected API call is still authorized server-side regardless of this check; this is
 * a UX redirect, not the security boundary.
 */
const PROTECTED_PREFIXES = ["/projects", "/datasets", "/studio"];
const AUTH_COOKIE_NAME = "aivis_auth_present";

export function middleware(request: NextRequest) {
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix)
  );
  if (!isProtected) return NextResponse.next();

  const hasAuthCookie = request.cookies.has(AUTH_COOKIE_NAME);
  if (!hasAuthCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/projects/:path*", "/datasets/:path*", "/studio/:path*"],
};
