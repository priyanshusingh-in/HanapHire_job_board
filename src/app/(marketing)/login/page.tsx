import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Log in" };

const ROLE_HOME: Record<string, string> = {
  SEEKER: "/dashboard",
  EMPLOYER: "/employer",
  ADMIN: "/admin",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; next?: string }>;
}) {
  const { role, next } = await searchParams;
  const defaultRole = role === "employer" ? "employer" : "seeker";

  // Revisiting the raw auth form while already signed in is confusing, not
  // useful — send them where they'd end up anyway.
  const profile = await getCurrentProfile();
  if (profile) redirect(ROLE_HOME[profile.role]);

  return (
    <main className="mx-auto max-w-[420px] px-8 py-30">
      <AuthForm mode="login" defaultRole={defaultRole} next={next} />
    </main>
  );
}
