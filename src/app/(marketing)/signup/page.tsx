import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;
  const defaultRole = role === "employer" ? "employer" : "seeker";

  return (
    <main className="mx-auto max-w-[420px] px-8 py-30">
      <AuthForm mode="signup" defaultRole={defaultRole} />
    </main>
  );
}
