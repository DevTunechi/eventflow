// src/lib/emails.ts
// Central email dispatch for EventFlow.
// All emails go through Resend.
// Sandbox: from must be onboarding@resend.dev
//          and to must be your verified email.

import { resend } from "@/lib/resend"

const FROM    = process.env.RESEND_FROM    ?? "onboarding@resend.dev"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

// ─────────────────────────────────────────────
// 1. HOST LINK
// Sent when planner sends a host access link.
// ─────────────────────────────────────────────
export async function sendHostLinkEmail({
  hostName,
  hostEmail,
  eventName,
  hostLink,
}: {
  hostName:  string
  hostEmail: string
  eventName: string
  hostLink:  string
}) {
  return resend.emails.send({
    from:    FROM,
    to:      hostEmail,
    subject: `Your host access link — ${eventName}`,
    html: `
      <p>Hi ${hostName},</p>
      <p>You've been given host access to <strong>${eventName}</strong>.</p>
      <p>Use the link below to track RSVPs, check-in progress, gifts, and tributes in real time:</p>
      <p><a href="${hostLink}">${hostLink}</a></p>
      <p>This link is private — do not share it.</p>
    `,
  })
}

// ─────────────────────────────────────────────
// 2. GUEST INVITE (Closed model)
// Personalised invite link per guest.
// ─────────────────────────────────────────────
export async function sendGuestInviteEmail({
  guestName,
  guestEmail,
  eventName,
  eventDate,
  venueName,
  inviteLink,
}: {
  guestName:  string
  guestEmail: string
  eventName:  string
  eventDate:  string
  venueName:  string | null
  inviteLink: string
}) {
  return resend.emails.send({
    from:    FROM,
    to:      guestEmail,
    subject: `You're invited to ${eventName}`,
    html: `
      <p>Dear ${guestName},</p>
      <p>You are cordially invited to <strong>${eventName}</strong>.</p>
      ${eventDate ? `<p><strong>Date:</strong> ${eventDate}</p>` : ""}
      ${venueName ? `<p><strong>Venue:</strong> ${venueName}</p>` : ""}
      <p>Please RSVP using your personal link below:</p>
      <p><a href="${inviteLink}">${inviteLink}</a></p>
      <p>This link is unique to you — please do not share it.</p>
    `,
  })
}

// ─────────────────────────────────────────────
// 3. OTP VERIFICATION
// 6-digit code sent to guest during RSVP.
// ─────────────────────────────────────────────
export async function sendOtpEmail({
  guestEmail,
  guestName,
  otpCode,
  eventName,
}: {
  guestEmail: string
  guestName:  string
  otpCode:    string
  eventName:  string
}) {
  return resend.emails.send({
    from:    FROM,
    to:      guestEmail,
    subject: `Your verification code — ${eventName}`,
    html: `
      <p>Hi ${guestName},</p>
      <p>Your verification code for <strong>${eventName}</strong> is:</p>
      <h2 style="letter-spacing:0.3em;font-size:2rem;">${otpCode}</h2>
      <p>This code expires in 10 minutes. Do not share it with anyone.</p>
    `,
  })
}

// ─────────────────────────────────────────────
// 4. RSVP CONFIRMATION
// Sent to guest after successful RSVP.
// Includes QR code link.
// ─────────────────────────────────────────────
export async function sendRsvpConfirmationEmail({
  guestEmail,
  guestName,
  eventName,
  eventDate,
  venueName,
  venueAddress,
  qrCodeUrl,
}: {
  guestEmail:   string
  guestName:    string
  eventName:    string
  eventDate:    string
  venueName:    string | null
  venueAddress: string | null
  qrCodeUrl:    string
}) {
  return resend.emails.send({
    from:    FROM,
    to:      guestEmail,
    subject: `RSVP Confirmed — ${eventName}`,
    html: `
      <p>Hi ${guestName},</p>
      <p>Your RSVP for <strong>${eventName}</strong> is confirmed.</p>
      ${eventDate    ? `<p><strong>Date:</strong> ${eventDate}</p>`          : ""}
      ${venueName    ? `<p><strong>Venue:</strong> ${venueName}</p>`         : ""}
      ${venueAddress ? `<p><strong>Address:</strong> ${venueAddress}</p>`    : ""}
      <p>Please present your QR code at the gate on the day:</p>
      <p><a href="${qrCodeUrl}">View your QR code</a></p>
      <p>We look forward to seeing you!</p>
    `,
  })
}

// ─────────────────────────────────────────────
// 5. EVENT CREATED
// Sent to planner after creating a new event.
// ─────────────────────────────────────────────
export async function sendEventCreatedEmail({
  plannerEmail,
  plannerName,
  eventName,
  eventDate,
  eventLink,
}: {
  plannerEmail: string
  plannerName:  string
  eventName:    string
  eventDate:    string
  eventLink:    string
}) {
  return resend.emails.send({
    from:    FROM,
    to:      plannerEmail,
    subject: `Event created — ${eventName}`,
    html: `
      <p>Hi ${plannerName},</p>
      <p>Your event <strong>${eventName}</strong> has been created successfully.</p>
      <p><strong>Date:</strong> ${eventDate}</p>
      <p>Manage your event from your dashboard:</p>
      <p><a href="${eventLink}">${eventLink}</a></p>
      <p>Publish your event when you're ready to start accepting RSVPs.</p>
    `,
  })
}