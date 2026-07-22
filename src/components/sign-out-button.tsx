"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ className }: { className?: string }) {
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Hard navigation, not router.push: the session cookie clear needs to
    // land before proxy.ts sees the next request — same reasoning as the
    // login/signup hard-navigation fix in auth-form.tsx.
    window.location.href = "/";
  }

  return (
    <button type="button" onClick={handleSignOut} disabled={pending} className={className}>
      {pending ? "Signing out…" : "Log out"}
    </button>
  );
}
