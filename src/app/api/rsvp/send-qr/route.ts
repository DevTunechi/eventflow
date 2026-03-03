// src/app/api/rsvp/send-qr/route.ts
// POST — send QR confirmation to guest via WhatsApp or email

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail, qrEmailHtml } from "@/lib/resend"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://eventflowng.vercel.app"

export async function POST(req: NextRequest) {
  try {
    const { guestId, channel } = await req.json()
    if (!guestId || !channel) return NextResponse.json({ error: "Missing params" }, { status: 400 })

    const guest = await prisma.guest.findUnique({
      where:  { id: guestId },
      select: {
        id: true, firstName: true, lastName: true,
        phone: true, email: true, qrCode: true,
        event: {
          select: {
            id: true, name: true, eventDate: true, startTime: true,
            venueName: true, brandColor: true, plannerId: true, slug: true,
          },
        },
      },
    })

    if (!guest) return NextResponse.json({ error: "Guest not found" }, { status: 404 })

    const event     = guest.event
    const guestName = `${guest.firstName} ${guest.lastName}`
    const confirmationLink = `${APP_URL}/rsvp/confirmed/${guestId}`
    // QR image — we use a public QR generation service pointing at the guest's qrCode value
    // The actual QR scanning endpoint reads this code
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(guest.qrCode)}&bgcolor=ffffff&color=0a0a0a`

    const eventDate = new Date(event.eventDate).toLocaleDateString("en-NG", {
      weekday:"long", year:"numeric", month:"long", day:"numeric"
    })

    // ── WhatsApp ──────────────────────────────────────────
    if (channel === "whatsapp") {
      if (!guest.phone) return NextResponse.json({ error: "No phone number" }, { status: 400 })

      // Load planner WA credentials
      const user = await (prisma.user as any).findUnique({
        where:  { id: event.plannerId },
        select: { waAccessToken: true, waPhoneNumberId: true },
      })

      if (!user?.waAccessToken || !user?.waPhoneNumberId) {
        return NextResponse.json({ error: "WhatsApp not configured for this event" }, { status: 400 })
      }

      const { decrypt, sendWhatsAppMessage } = await import("@/lib/whatsapp")
      const accessToken = decrypt(user.waAccessToken)

      const message = [
        `Hello ${guest.firstName} 👋`,
        ``,
        `Your entry QR code for *${event.name}* is ready.`,
        ``,
        `📅 ${eventDate}${event.startTime ? ` · ${event.startTime}` : ""}`,
        event.venueName ? `📍 ${event.venueName}` : "",
        ``,
        `View your confirmation and QR code here:`,
        confirmationLink,
        ``,
        `Present this at the gate on arrival. Do not share your link.`,
      ].filter(Boolean).join("\n")

      const result = await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: user.waPhoneNumberId,
        to:            guest.phone,
        message,
      })

      if (!result.success) return NextResponse.json({ error: result.error ?? "Send failed" }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // ── Email ─────────────────────────────────────────────
    if (channel === "email") {
      if (!guest.email) return NextResponse.json({ error: "No email address" }, { status: 400 })

      const html = qrEmailHtml({
        guestName,
        eventName:        event.name,
        eventDate,
        venueName:        event.venueName,
        qrCodeUrl:        qrImageUrl,
        confirmationLink,
        brandColor:       event.brandColor,
      })

      const result = await sendEmail({
        to:      guest.email,
        subject: `Your entry pass for ${event.name}`,
        html,
      })

      if (!result.success) return NextResponse.json({ error: result.error ?? "Send failed" }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid channel" }, { status: 400 })
  } catch (error) {
    console.error("send-qr error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}