import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/generated/prisma/client";

/**
 * Returns the signed-in user's profile row, or null if unauthenticated.
 * Always verifies the JWT (via getClaims) rather than trusting cookies blindly.
 */
export async function getCurrentProfile() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims.sub) return null;

  return prisma.profile.findUnique({ where: { id: data.claims.sub } });
}

/**
 * Server Component / Server Action guard: redirects to /login if unauthenticated,
 * or to / if authenticated but not one of the allowed roles. This is the
 * defense-in-depth check — proxy.ts also gates these routes, but Next.js
 * recommends never relying on Proxy alone (a matcher change could silently
 * remove coverage), so every protected server function re-checks here too.
 */
export async function requireRole(allowed: Role[]) {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");
  if (profile.suspended || !allowed.includes(profile.role)) redirect("/");

  return profile;
}
