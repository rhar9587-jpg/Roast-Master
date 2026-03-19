/**
 * Minimal email sender abstraction. V1: Resend only.
 * Set RESEND_API_KEY in env. From address uses Resend's default or RESEND_FROM.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM || "Fantasy Roast <onboarding@resend.dev>";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/** Send a single email. Returns { ok, messageId } or { ok: false, error }. */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { to, subject, html, text } = options;
  if (!RESEND_API_KEY) {
    return { ok: false, error: "Email is not configured (missing RESEND_API_KEY)." };
  }
  if (!to?.trim()) {
    return { ok: false, error: "Recipient email is required." };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [to.trim()],
        subject,
        html,
        text: text || undefined,
      }),
    });
    const data = (await res.json()) as { id?: string; message?: string; name?: string };
    if (!res.ok) {
      const raw = data?.message || data?.name || `Resend error ${res.status}`;
      const error = mapResendError(raw, res.status);
      return { ok: false, error };
    }
    return { ok: true, messageId: data.id };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to send email.";
    return { ok: false, error: message };
  }
}

function mapResendError(message: string, status: number): string {
  const lower = message.toLowerCase();
  if (!RESEND_API_KEY) return "Email is not configured (missing RESEND_API_KEY).";
  if (status === 403 || lower.includes("invalid api key") || lower.includes("api key")) return "Invalid Resend API key. Check RESEND_API_KEY.";
  if (status === 422 || lower.includes("from") || lower.includes("domain") || lower.includes("verified")) return "From address not verified. Add and verify your domain in Resend, or use RESEND_FROM.";
  if (status === 429 || lower.includes("rate")) return "Send rate limit exceeded. Try again in a few minutes.";
  if (lower.includes("validation") || lower.includes("invalid")) return message.length > 80 ? "Invalid request to email service." : message;
  return message.length > 120 ? "Email service error. Check your Resend dashboard." : message;
}
