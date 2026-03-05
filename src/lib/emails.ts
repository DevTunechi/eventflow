// src/lib/emails.ts
// Central email dispatch for EventFlow.
// All emails go through Resend.
// Sandbox: from must be onboarding@resend.dev
//          and to must be your verified email.

import { resend } from "@/lib/resend"

const FROM     = process.env.RESEND_FROM                     ?? "onboarding@resend.dev"
const APP_URL  = process.env.NEXT_PUBLIC_APP_URL             ?? "http://localhost:3000"
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

// ─────────────────────────────────────────────
// MAP HELPERS (internal)
// ─────────────────────────────────────────────

function staticMapUrl(lat: number, lng: number): string {
  const marker = `color:red|${lat},${lng}`
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=600x200&markers=${marker}&key=${MAPS_KEY}`
}

function directionsUrl(lat: number, lng: number, label?: string | null): string {
  const dest = label
    ? `${encodeURIComponent(label)}/@${lat},${lng}`
    : `${lat},${lng}`
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`
}

// Renders venue name, address, a clickable static
// map image, and a Get Directions button.
// Omitted entirely when lat/lng are absent.
function venueBlock({
  venueName,
  venueAddress,
  venueLat,
  venueLng,
}: {
  venueName:    string | null
  venueAddress: string | null
  venueLat:     number | null | undefined
  venueLng:     number | null | undefined
}): string {
  const hasMap = !!(venueLat && venueLng)
  const dirUrl = hasMap ? directionsUrl(venueLat!, venueLng!, venueName) : ""

  return `
    ${venueName    ? `<p style="margin:4px 0 2px"><strong>Venue:</strong> ${venueName}</p>`      : ""}
    ${venueAddress ? `<p style="margin:2px 0 8px"><strong>Address:</strong> ${venueAddress}</p>` : ""}
    ${hasMap && MAPS_KEY ? `
      <a href="${dirUrl}" target="_blank" rel="noopener noreferrer" style="display:block;margin:14px 0 6px;">
        <img
          src="${staticMapUrl(venueLat!, venueLng!)}"
          alt="Venue location map"
          width="600"
          style="width:100%;max-width:600px;border-radius:8px;border:1px solid #e5e7eb;display:block;"
        />
      </a>
      <p style="margin:6px 0 20px;">
        <a
          href="${dirUrl}"
          target="_blank"
          rel="noopener noreferrer"
          style="display:inline-block;padding:9px 20px;background:#b48c3c;color:#ffffff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;font-family:sans-serif;"
        >
          📍 Get Directions
        </a>
      </p>
    ` : hasMap ? `
      <p style="margin:6px 0 20px;">
        <a
          href="${dirUrl}"
          target="_blank"
          rel="noopener noreferrer"
          style="display:inline-block;padding:9px 20px;background:#b48c3c;color:#ffffff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;font-family:sans-serif;"
        >
          📍 Get Directions
        </a>
      </p>
    ` : ""}
  `
}

// ─────────────────────────────────────────────
// WHATSAPP VENUE TEXT
// Used when building WhatsApp invite messages.
// Images can't be embedded — sends a plain
// Maps link instead.
// ─────────────────────────────────────────────
export function whatsappVenueText({
  venueName,
  venueAddress,
  venueLat,
  venueLng,
}: {
  venueName:    string | null
  venueAddress: string | null
  venueLat:     number | null | undefined
  venueLng:     number | null | undefined
}): string {
  const lines: string[] = []
  if (venueName)    lines.push(`📍 *${venueName}*`)
  if (venueAddress) lines.push(venueAddress)
  if (venueLat && venueLng) {
    lines.push(`🗺 Directions: ${directionsUrl(venueLat, venueLng, venueName)}`)
  }
  return lines.join("\n")
}

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
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111;">
        <p>Hi ${hostName},</p>
        <p>You've been given host access to <strong>${eventName}</strong>.</p>
        <p>Use the link below to track RSVPs, check-in progress, gifts, and tributes in real time:</p>
        <p><a href="${hostLink}">${hostLink}</a></p>
        <p style="font-size:12px;color:#6b7280;">This link is private — do not share it.</p>
      </div>
    `,
  })
}

// ─────────────────────────────────────────────
// 2. GUEST INVITE (Closed model)
// Personalised invite link per guest.
// Now includes static map image + directions.
// ─────────────────────────────────────────────
export async function sendGuestInviteEmail({
  guestName,
  guestEmail,
  eventName,
  eventDate,
  venueName,
  venueAddress,
  venueLat,
  venueLng,
  inviteLink,
}: {
  guestName:    string
  guestEmail:   string
  eventName:    string
  eventDate:    string
  venueName:    string | null
  venueAddress: string | null
  venueLat:     number | null | undefined
  venueLng:     number | null | undefined
  inviteLink:   string
}) {
  return resend.emails.send({
    from:    FROM,
    to:      guestEmail,
    subject: `You're invited to ${eventName}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111;">
        <p>Dear ${guestName},</p>
        <p>You are cordially invited to <strong>${eventName}</strong>.</p>
        ${eventDate ? `<p style="margin:4px 0"><strong>Date:</strong> ${eventDate}</p>` : ""}
        ${venueBlock({ venueName, venueAddress, venueLat, venueLng })}
        <p style="margin-top:16px;">Please RSVP using your personal link:</p>
        <p>
          <a
            href="${inviteLink}"
            style="display:inline-block;padding:10px 22px;background:#b48c3c;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;"
          >
            RSVP Now
          </a>
        </p>
        <p style="font-size:12px;color:#6b7280;">This link is unique to you — please do not share it.</p>
      </div>
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
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111;">
        <p>Hi ${guestName},</p>
        <p>Your verification code for <strong>${eventName}</strong> is:</p>
        <h2 style="letter-spacing:0.3em;font-size:2rem;margin:16px 0;">${otpCode}</h2>
        <p style="font-size:12px;color:#6b7280;">This code expires in 10 minutes. Do not share it with anyone.</p>
      </div>
    `,
  })
}

// ─────────────────────────────────────────────
// 4. RSVP CONFIRMATION
// Sent to guest after successful RSVP.
// Now includes static map image + directions + QR.
// ─────────────────────────────────────────────
export async function sendRsvpConfirmationEmail({
  guestEmail,
  guestName,
  eventName,
  eventDate,
  venueName,
  venueAddress,
  venueLat,
  venueLng,
  qrCodeUrl,
}: {
  guestEmail:   string
  guestName:    string
  eventName:    string
  eventDate:    string
  venueName:    string | null
  venueAddress: string | null
  venueLat:     number | null | undefined
  venueLng:     number | null | undefined
  qrCodeUrl:    string
}) {
  return resend.emails.send({
    from:    FROM,
    to:      guestEmail,
    subject: `RSVP Confirmed — ${eventName}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111;">
        <p>Hi ${guestName},</p>
        <p>Your RSVP for <strong>${eventName}</strong> is confirmed. 🎉</p>
        ${eventDate ? `<p style="margin:4px 0"><strong>Date:</strong> ${eventDate}</p>` : ""}
        ${venueBlock({ venueName, venueAddress, venueLat, venueLng })}
        <p style="margin-top:16px;">Present your QR code at the gate on the day:</p>
        <p>
          <a
            href="${qrCodeUrl}"
            style="display:inline-block;padding:10px 22px;background:#111;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;"
          >
            View QR Code
          </a>
        </p>
        <p style="font-size:12px;color:#6b7280;">We look forward to seeing you!</p>
      </div>
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
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111;">
        <p>Hi ${plannerName},</p>
        <p>Your event <strong>${eventName}</strong> has been created successfully.</p>
        <p><strong>Date:</strong> ${eventDate}</p>
        <p>Manage your event from your dashboard:</p>
        <p><a href="${eventLink}">${eventLink}</a></p>
        <p style="font-size:12px;color:#6b7280;">Publish your event when you're ready to start accepting RSVPs.</p>
      </div>
    `,
  })
}