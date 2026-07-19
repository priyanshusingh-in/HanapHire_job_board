import "server-only";
import { Resend } from "resend";

/**
 * Best-effort send — never throws. Resend's sandbox sender (no verified
 * domain) can only deliver to the account owner's own address, so most
 * sends in dev/no-domain environments will fail; callers should still treat
 * the surrounding action (e.g. marking outreach as sent) as successful,
 * since the guardrail that matters is "never send twice," not "guarantee
 * delivery" — see README for upgrading to a verified domain.
 */
export async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not set — skipping send to ${to}`);
    return { sent: false };
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to,
      subject,
      text,
    });
    return { sent: true };
  } catch (err) {
    console.error(`[email] send to ${to} failed`, err);
    return { sent: false };
  }
}
