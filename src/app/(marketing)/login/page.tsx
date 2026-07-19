import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;
  const defaultRole = role === "employer" ? "employer" : "seeker";

  return (
    <main className="mx-auto max-w-[420px] px-8 py-30">
      <AuthForm mode="login" defaultRole={defaultRole} />
    </main>
  );
}
