import { NextResponse, type NextRequest } from "next/server";

const publicRoutes = ["/login", "/forgot-password", "/reset-password", "/mfa/enroll", "/mfa/verify", "/account-recovery", "/session-expired", "/access-denied"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (publicRoutes.some((route) => path === route || path.startsWith(`${route}/`))) return NextResponse.next();
  const sessionCookie = process.env.BILLGENIE_COOKIE_SECURE === "1" ? "__Host-bg_session" : "bg_session";
  const cookie = request.cookies.get(sessionCookie)?.value;
  if (!cookie) return NextResponse.redirect(new URL("/login", request.url));
  try {
    const api = process.env.BILLGENIE_API_URL ?? "http://127.0.0.1:8000";
    const response = await fetch(`${api}/auth/me`, { headers: { cookie: `${sessionCookie}=${cookie}` }, cache: "no-store", signal: AbortSignal.timeout(2000) });
    if (response.status === 401) return NextResponse.redirect(new URL("/session-expired", request.url));
    if (response.status === 403) return NextResponse.redirect(new URL("/access-denied", request.url));
  } catch {
    return NextResponse.next();
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"] };
