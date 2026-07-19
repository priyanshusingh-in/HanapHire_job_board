import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign up" };

const ROLE_HOME: Record<string, string> = {
  SEEKER: "/dashboard",
  EMPLOYER: "/employer",
  ADMIN: "/admin",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;
  const defaultRole = role === "employer" ? "employer" : "seeker";

  const profile = await getCurrentProfile();
  if (profile) redirect(ROLE_HOME[profile.role]);

  return (
    <main className="mx-auto max-w-[420px] px-8 py-30">
      <AuthForm mode="signup" defaultRole={defaultRole} />
    </main>
  );
}
