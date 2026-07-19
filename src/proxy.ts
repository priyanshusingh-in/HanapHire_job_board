import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const PROTECTED_PREFIXES = ["/dashboard", "/employer", "/admin"];

/**
 * Refreshes the Supabase session on (almost) every request and redirects
 * unauthenticated visitors away from protected areas. This is only the
 * cheap "are you logged in" gate — role-specific authorization (seeker vs
 * employer vs admin) is enforced per Next.js's own recommendation inside
 * each protected layout's requireRole() call (see src/lib/auth.ts), not
 * here, so a matcher mistake here can never silently grant access.
 */
export async function proxy(request: NextRequest) {
  const { supabaseResponse, userId } = await updateSession(request);

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );

  if (isProtected && !userId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
