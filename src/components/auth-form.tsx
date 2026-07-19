"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type RoleTab = "seeker" | "employer";
type Mode = "login" | "signup";

// Routing hint only — never an authorization decision. app_metadata is
// checked first since that's the trusted source the handle_new_user trigger
// itself prefers (see prisma/migrations/*_harden_handle_new_user_role);
// user_metadata is the fallback for publicly self-signed-up seeker/employer
// accounts. The actual gate is requireRole() reading profiles.role from the
// database server-side, so a stale or tampered client value here only ever
// sends someone to the wrong page — it can't grant access to one.
function roleHome(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null | undefined) {
  const role = (user?.app_metadata?.role ?? user?.user_metadata?.role) as string | undefined;
  if (role === "EMPLOYER") return "/employer";
  if (role === "ADMIN") return "/admin";
  return "/dashboard";
}

export function AuthForm({ mode, defaultRole }: { mode: Mode; defaultRole: RoleTab }) {
  const router = useRouter();
  const supabase = createClient();

  const [roleTab, setRoleTab] = useState<RoleTab>(defaultRole);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (mode === "login") {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setSubmitting(false);
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push(roleHome(data.user));
      router.refresh();
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: roleTab.toUpperCase() },
      },
    });
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (!data.session) {
      // Email confirmation required — no session yet.
      setConfirmationSent(true);
      return;
    }
    router.push(roleHome(data.user));
    router.refresh();
  }

  if (confirmationSent) {
    return (
      <div className="border border-text-primary/14 bg-white p-9 text-center">
        <h1 className="mb-2 font-serif text-2xl font-medium tracking-tight">
          Check your email
        </h1>
        <p className="text-sm text-text-muted">
          We sent a confirmation link to <strong>{email}</strong>. Click it
          to activate your account, then come back and log in.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-text-primary/14 bg-white p-9">
      <h1 className="mb-1.5 text-center font-serif text-[28px] font-medium tracking-tight">
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mb-7 text-center text-sm text-text-muted">
        {mode === "login"
          ? "Log in to continue to HanapHire"
          : "Free for job seekers. Free to post your first job."}
      </p>

      <div className="mb-6.5 flex border-b border-text-primary/14">
        <button
          type="button"
          onClick={() => setRoleTab("seeker")}
          className={`-mb-px flex-1 border-b-2 py-2.5 font-serif text-sm ${
            roleTab === "seeker"
              ? "border-accent font-medium text-text-primary"
              : "border-transparent text-text-faint"
          }`}
        >
          Job Seeker
        </button>
        <button
          type="button"
          onClick={() => setRoleTab("employer")}
          className={`-mb-px flex-1 border-b-2 py-2.5 font-serif text-sm ${
            roleTab === "employer"
              ? "border-accent font-medium text-text-primary"
              : "border-transparent text-text-faint"
          }`}
        >
          Employer
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        {mode === "signup" && (
          <input
            required
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-text-primary/20 px-3.5 py-3 text-[14.5px]"
          />
        )}
        <input
          required
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-text-primary/20 px-3.5 py-3 text-[14.5px]"
        />
        <input
          required
          type="password"
          minLength={8}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-text-primary/20 px-3.5 py-3 text-[14.5px]"
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-accent py-3.5 text-[15px] font-semibold text-white disabled:opacity-60"
        >
          {submitting
            ? "Please wait…"
            : mode === "login"
              ? "Log in"
              : "Create account"}
        </button>
      </form>

      <div className="mt-5.5 text-center text-[13.5px] text-text-muted">
        {mode === "login" ? (
          <>
            No account? <Link href="/signup">Sign up</Link>
          </>
        ) : (
          <>
            Already have an account? <Link href="/login">Log in</Link>
          </>
        )}
      </div>
    </div>
  );
}
