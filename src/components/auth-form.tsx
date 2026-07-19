"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolvePostLoginRedirect } from "@/lib/actions/auth";

type RoleTab = "seeker" | "employer";
type Mode = "login" | "signup";

export function AuthForm({ mode, defaultRole, next }: { mode: Mode; defaultRole: RoleTab; next?: string }) {
  const supabase = createClient();

  const [roleTab, setRoleTab] = useState<RoleTab>(defaultRole);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function completeAuth(accessToken: string) {
    // Resolves the destination server-side (real DB role, suspended check,
    // validated `next`) and only then hard-navigates. `submitting` stays
    // true the whole way through — clearing it early re-enables the submit
    // button while a hard navigation is still pending, which briefly
    // re-arms it for an accidental duplicate submit.
    const result = await resolvePostLoginRedirect(accessToken, next);
    if (!result.path) {
      // The server already tries to sign out a suspended account, but that
      // only clears cookies — the client-side supabase-js instance still
      // holds the session in memory/localStorage until told to drop it too.
      await supabase.auth.signOut();
      setSubmitting(false);
      setError(result.error ?? "Something went wrong — please try again.");
      return;
    }
    // Hard navigation, not router.push(): the session cookie is written
    // client-side (via document.cookie, triggered by Supabase's auth state
    // listener) slightly after signInWithPassword()/signUp() resolves. A
    // client-side route change can beat that write to the server, so
    // proxy.ts sees no session yet and bounces back to /login. A full page
    // load always waits for the cookie to exist first.
    window.location.href = result.path;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (mode === "login") {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !data.session) {
        setSubmitting(false);
        setError(signInError?.message ?? "Something went wrong — please try again.");
        return;
      }
      await completeAuth(data.session.access_token);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: roleTab.toUpperCase() },
      },
    });
    if (signUpError) {
      setSubmitting(false);
      setError(signUpError.message);
      return;
    }
    if (!data.session) {
      // Email confirmation required — no session yet.
      setSubmitting(false);
      setConfirmationSent(true);
      return;
    }
    await completeAuth(data.session.access_token);
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

      {/* Role only matters at signup — an existing account's role is fixed
          server-side, so showing a selectable tab here would falsely imply
          it affects which kind of account you log into. */}
      {mode === "signup" && (
        <div role="tablist" aria-label="Account type" className="mb-6.5 flex border-b border-text-primary/14">
          <button
            type="button"
            role="tab"
            aria-selected={roleTab === "seeker"}
            onClick={() => setRoleTab("seeker")}
            className={`-mb-px flex-1 border-b-2 py-2.5 font-serif text-sm ${
              roleTab === "seeker"
                ? "border-accent font-medium text-text-primary"
                : "border-transparent text-text-muted"
            }`}
          >
            Job Seeker
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={roleTab === "employer"}
            onClick={() => setRoleTab("employer")}
            className={`-mb-px flex-1 border-b-2 py-2.5 font-serif text-sm ${
              roleTab === "employer"
                ? "border-accent font-medium text-text-primary"
                : "border-transparent text-text-muted"
            }`}
          >
            Employer
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        {mode === "signup" && (
          <div>
            <label htmlFor="name" className="sr-only">
              Full name
            </label>
            <input
              id="name"
              required
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-text-primary/20 px-3.5 py-3 text-[14.5px]"
            />
          </div>
        )}
        <div>
          <label htmlFor="email" className="sr-only">
            Email address
          </label>
          <input
            id="email"
            required
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-text-primary/20 px-3.5 py-3 text-[14.5px]"
          />
        </div>
        <div>
          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <input
            id="password"
            required
            type="password"
            minLength={8}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-text-primary/20 px-3.5 py-3 text-[14.5px]"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

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
