"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const ROLE_HOME: Record<string, string> = {
  SEEKER: "/dashboard",
  EMPLOYER: "/employer",
  ADMIN: "/admin",
};

function safeNextPath(next: string | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) return null;
  return next;
}

type PostLoginResult = { path: string; error?: undefined } | { path?: undefined; error: string };

/**
 * Called right after a successful Supabase sign-in/sign-up, before the
 * client hard-navigates away. Two things a client-only redirect can't do:
 * reject a suspended account with a real message (Supabase Auth has no
 * concept of `profiles.suspended` — a suspended user's credentials still
 * work, they'd otherwise land on a page that just silently bounces them
 * back to "/"), and compute the destination from the real DB role instead
 * of the JWT's (routing-hint-only) metadata.
 *
 * Takes the access token explicitly and validates it with a plain,
 * cookie-free client — not the cookies()-backed SSR server client. This
 * runs as a fetch immediately after signInWithPassword()/signUp()
 * resolves, in parallel with the browser's own cookie write (triggered by
 * Supabase's client-side auth-state listener). Validating via the SSR
 * client here would make it write its own session cookie from this
 * request, racing the client's write with a possibly different value —
 * empirically this produced exactly the symptom the hard-navigation fix
 * exists to prevent: the browser would land on the destination page and
 * then immediately bounce back to /login, because the two writes left the
 * cookie jar in an inconsistent state. A plain token check has no cookie
 * side effects to race.
 */
export async function resolvePostLoginRedirect(accessToken: string, next?: string): Promise<PostLoginResult> {
  const tokenClient = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error: authError } = await tokenClient.auth.getUser(accessToken);
  if (authError || !data.user) return { error: "Something went wrong — please try logging in again." };

  const profile = await prisma.profile.findUnique({ where: { id: data.user.id } });
  if (!profile) return { error: "Something went wrong — please try logging in again." };

  if (profile.suspended) {
    // This one *does* need the cookie-aware client — an actual sign-out
    // has to clear the session cookie that will otherwise get written
    // moments later by the client's own listener.
    const supabase = await createClient();
    await supabase.auth.signOut();
    return { error: "This account has been suspended. Contact support for help." };
  }

  return { path: safeNextPath(next) ?? ROLE_HOME[profile.role] };
}
