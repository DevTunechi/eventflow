// src/lib/resend.ts
// Email sending via Resend
// Swap FROM_EMAIL to your domain once verified

import { Resend } from "resend"

export const resend = new Resend(process.env.RESEND_API_KEY)


const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ""
const FROM_EMAIL     = process.env.FROM_EMAIL ?? "EventFlow <onboarding@resend.dev>"
const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? "https://eventflowng.vercel.app"

interface SendEmailOptions {
  to:      string
  subject: string
  html:    string
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error("[resend] RESEND_API_KEY not set")
    return { success: false, error: "Email service not configured" }
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    })
    if (!res.ok) {
      const d = await res.json()
      return { success: false, error: d.message ?? "Send failed" }
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
  }
}

// ── Email Templates ───────────────────────────────────────

export function inviteEmailHtml({
  guestName, eventName, eventDate, venueName,
  inviteLink, invitationCard, brandColor,
}: {
  guestName:      string
  eventName:      string
  eventDate:      string
  venueName?:     string | null
  inviteLink:     string
  invitationCard?: string | null
  brandColor?:    string | null
}): string {
  const gold = brandColor ?? "#b48c3c"
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Georgia',serif;">
  <div style="max-width:560px;margin:0 auto;background:#111111;border:1px solid rgba(180,140,60,0.2);">
    ${invitationCard ? `<img src="${invitationCard}" alt="${eventName}" style="width:100%;display:block;max-height:280px;object-fit:cover;">` : `<div style="height:8px;background:${gold};"></div>`}
    <div style="padding:2rem 2rem 1.5rem;">
      <p style="margin:0 0 0.5rem;font-size:0.75rem;letter-spacing:0.15em;text-transform:uppercase;color:${gold};">You're invited</p>
      <h1 style="margin:0 0 1.5rem;font-size:1.75rem;font-weight:400;color:#f0ece4;line-height:1.2;">${eventName}</h1>
      <p style="margin:0 0 0.375rem;font-size:0.875rem;color:rgba(240,236,228,0.6);">Dear <strong style="color:#f0ece4;">${guestName}</strong>,</p>
      <p style="margin:0 0 1.5rem;font-size:0.875rem;color:rgba(240,236,228,0.6);line-height:1.7;">
        You are cordially invited to join us for <strong style="color:#f0ece4;">${eventName}</strong>${eventDate ? ` on <strong style="color:#f0ece4;">${eventDate}</strong>` : ""}${venueName ? ` at <strong style="color:#f0ece4;">${venueName}</strong>` : ""}.
      </p>
      <a href="${inviteLink}" style="display:inline-block;padding:0.75rem 2rem;background:${gold};color:#0a0a0a;text-decoration:none;font-family:'Arial',sans-serif;font-size:0.8rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">
        RSVP Now →
      </a>
      <p style="margin:1.5rem 0 0;font-size:0.75rem;color:rgba(240,236,228,0.3);line-height:1.6;">
        Or copy this link: <span style="color:${gold};">${inviteLink}</span>
      </p>
    </div>
    <div style="padding:1rem 2rem;border-top:1px solid rgba(180,140,60,0.12);text-align:center;">
      <p style="margin:0;font-size:0.7rem;color:rgba(240,236,228,0.25);">Powered by EventFlow</p>
    </div>
  </div>
</body>
</html>`
}

export function qrEmailHtml({
  guestName, eventName, eventDate, venueName,
  qrCodeUrl, confirmationLink, brandColor,
}: {
  guestName:        string
  eventName:        string
  eventDate:        string
  venueName?:       string | null
  qrCodeUrl:        string
  confirmationLink: string
  brandColor?:      string | null
}): string {
  const gold = brandColor ?? "#b48c3c"
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Georgia',serif;">
  <div style="max-width:560px;margin:0 auto;background:#111111;border:1px solid rgba(180,140,60,0.2);">
    <div style="height:4px;background:${gold};"></div>
    <div style="padding:2rem 2rem 1.5rem;text-align:center;">
      <p style="margin:0 0 0.5rem;font-size:0.75rem;letter-spacing:0.15em;text-transform:uppercase;color:${gold};">Your Entry Pass</p>
      <h1 style="margin:0 0 0.375rem;font-size:1.5rem;font-weight:400;color:#f0ece4;">${eventName}</h1>
      <p style="margin:0 0 1.5rem;font-size:0.8rem;color:rgba(240,236,228,0.5);">${eventDate}${venueName ? ` · ${venueName}` : ""}</p>
      <p style="margin:0 0 1rem;font-size:0.875rem;color:rgba(240,236,228,0.7);">Your QR code for <strong style="color:#f0ece4;">${guestName}</strong></p>
      <img src="${qrCodeUrl}" alt="Entry QR Code" style="width:200px;height:200px;border:3px solid ${gold};padding:8px;background:#fff;display:inline-block;">
      <p style="margin:1rem 0 0;font-size:0.75rem;color:rgba(240,236,228,0.4);line-height:1.6;">Present this QR code at the gate for entry.<br>Do not share this code with anyone.</p>
      <a href="${confirmationLink}" style="display:inline-block;margin-top:1.25rem;padding:0.625rem 1.5rem;background:transparent;border:1px solid ${gold};color:${gold};text-decoration:none;font-family:'Arial',sans-serif;font-size:0.75rem;letter-spacing:0.06em;text-transform:uppercase;">
        View Confirmation →
      </a>
    </div>
    <div style="padding:1rem 2rem;border-top:1px solid rgba(180,140,60,0.12);text-align:center;">
      <p style="margin:0;font-size:0.7rem;color:rgba(240,236,228,0.25);">Powered by EventFlow</p>
    </div>
  </div>
</body>
</html>`
}

export function hostLinkEmailHtml({
  hostName, eventName, eventDate, venueName,
  hostPortalLink, plannerName,
}: {
  hostName:       string
  eventName:      string
  eventDate:      string
  venueName?:     string | null
  hostPortalLink: string
  plannerName:    string
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Georgia',serif;">
  <div style="max-width:560px;margin:0 auto;background:#111111;border:1px solid rgba(180,140,60,0.2);">
    <div style="height:4px;background:#b48c3c;"></div>
    <div style="padding:2rem 2rem 1.5rem;">
      <p style="margin:0 0 0.5rem;font-size:0.75rem;letter-spacing:0.15em;text-transform:uppercase;color:#b48c3c;">Event Access</p>
      <h1 style="margin:0 0 1.5rem;font-size:1.5rem;font-weight:400;color:#f0ece4;">${eventName}</h1>
      <p style="margin:0 0 1rem;font-size:0.875rem;color:rgba(240,236,228,0.7);line-height:1.7;">
        Dear <strong style="color:#f0ece4;">${hostName}</strong>,<br><br>
        <strong style="color:#f0ece4;">${plannerName}</strong> has given you access to the live event dashboard for <strong style="color:#f0ece4;">${eventName}</strong> on ${eventDate}${venueName ? ` at ${venueName}` : ""}.
      </p>
      <p style="margin:0 0 1.5rem;font-size:0.8rem;color:rgba(240,236,228,0.5);line-height:1.7;">
        You can view the guest list, RSVPs, check-in progress, gifts, and tributes in real time.
      </p>
      <a href="${hostPortalLink}" style="display:inline-block;padding:0.75rem 2rem;background:#b48c3c;color:#0a0a0a;text-decoration:none;font-family:'Arial',sans-serif;font-size:0.8rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">
        Open Event Dashboard →
      </a>
      <p style="margin:1.5rem 0 0;font-size:0.75rem;color:rgba(240,236,228,0.3);">
        Or copy: <span style="color:#b48c3c;">${hostPortalLink}</span>
      </p>
    </div>
    <div style="padding:1rem 2rem;border-top:1px solid rgba(180,140,60,0.12);text-align:center;">
      <p style="margin:0;font-size:0.7rem;color:rgba(240,236,228,0.25);">Powered by EventFlow</p>
    </div>
  </div>
</body>
</html>`
}

export { APP_URL }