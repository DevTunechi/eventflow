// src/app/api/events/[id]/guests/send-invites/route.ts
// POST — send invite links to guests via WhatsApp or Email
//
// Body:
//   { guestIds: string[], channel: "whatsapp" | "email" }
//
// channel defaults to "whatsapp" if omitted (backwards-compatible)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-server"
import { decrypt, sendWhatsAppMessage } from "@/lib/whatsapp"
import { sendEmail, inviteEmailHtml } from "@/lib/resend"
import { whatsappVenueText } from "@/lib/emails"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://eventflowng.vercel.app"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const user = await (prisma.user as any).findUnique({
      where:  { email: session.email },
      select: {
        id:              true,
        name:            true,
        waAccessToken:   true,
        waPhoneNumberId: true,
      },
    })

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const event = await prisma.event.findFirst({
      where:  { id, plannerId: user.id },
      select: {
        id: true, name: true, slug: true, inviteModel: true,
        eventDate: true, startTime: true,
        venueName: true, venueAddress: true,
        venueLat: true, venueLng: true,           // ← map fields
        invitationCard: true, brandColor: true,
      },
    })
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const body = await req.json()
    const { guestIds, channel = "whatsapp" }: { guestIds: string[]; channel?: "whatsapp" | "email" } = body
    if (!guestIds?.length) return NextResponse.json({ error: "No guest IDs provided" }, { status: 400 })

    // Validate channel-specific requirements up front
    if (channel === "whatsapp") {
      if (!user.waAccessToken || !user.waPhoneNumberId) {
        return NextResponse.json(
          { error: "WhatsApp not connected. Go to Settings to connect WhatsApp Business." },
          { status: 400 }
        )
      }
    }

    const guests = await prisma.guest.findMany({
      where:  { id: { in: guestIds }, eventId: id },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, inviteToken: true },
    })

    const eventDate = new Date(event.eventDate).toLocaleDateString("en-NG", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    })

    let sent    = 0
    let failed  = 0
    let skipped = 0
    const errors: string[] = []

    // ── WhatsApp path ─────────────────────────────────────
    if (channel === "whatsapp") {
      const accessToken = decrypt(user.waAccessToken)

      console.log("[send-invites] channel: whatsapp")
      console.log("[send-invites] phoneNumberId:", user.waPhoneNumberId)
      console.log("[send-invites] token prefix:", accessToken.slice(0, 10))

      // Build venue line once — reused for every guest
      const venueText = whatsappVenueText({
        venueName:    event.venueName,
        venueAddress: event.venueAddress,
        venueLat:     event.venueLat,
        venueLng:     event.venueLng,
      })

      for (const guest of guests) {
        if (!guest.phone) {
          skipped++
          errors.push(`${guest.firstName} ${guest.lastName}: no phone number`)
          continue
        }

        const inviteLink = event.inviteModel === "CLOSED" && guest.inviteToken
          ? `${APP_URL}/rsvp/${event.slug}?invite=${guest.inviteToken}`
          : `${APP_URL}/rsvp/${event.slug}`

        const messageParts = [
          `Hello ${guest.firstName} 👋`,
          ``,
          `You're invited to *${event.name}*.`,
          ``,
          `📅 ${eventDate}`,
        ]

        if (venueText) {
          messageParts.push(``)
          messageParts.push(venueText)
        }

        messageParts.push(
          ``,
          `Click the link below to RSVP and confirm your attendance:`,
          inviteLink,
          ``,
          `We look forward to celebrating with you! 🎉`,
        )

        const message = messageParts.join("\n")

        try {
          const result = await sendWhatsAppMessage({
            accessToken,
            phoneNumberId: user.waPhoneNumberId,
            to:            guest.phone,
            message,
            previewUrl:    false,
          })

          if (result.success) {
            await prisma.guest.update({
              where: { id: guest.id },
              data:  { inviteSentAt: new Date(), inviteChannel: "WHATSAPP" },
            })
            sent++
          } else {
            console.error(`[send-invites] WA failed for ${guest.phone}:`, result.error)
            errors.push(`${guest.firstName}: ${result.error ?? "unknown"}`)
            failed++
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          console.error(`[send-invites] WA exception for ${guest.id}:`, msg)
          errors.push(`${guest.firstName}: ${msg}`)
          failed++
        }
      }

      // Increment planner's WA message counter
      if (sent > 0) {
        await (prisma.user as any).update({
          where: { id: user.id },
          data:  { waMessagesSent: { increment: sent } },
        })
      }
    }

    // ── Email path ────────────────────────────────────────
    if (channel === "email") {
      console.log("[send-invites] channel: email")

      for (const guest of guests) {
        if (!guest.email) {
          skipped++
          errors.push(`${guest.firstName} ${guest.lastName}: no email address`)
          continue
        }

        const inviteLink = event.inviteModel === "CLOSED" && guest.inviteToken
          ? `${APP_URL}/rsvp/${event.slug}?invite=${guest.inviteToken}`
          : `${APP_URL}/rsvp/${event.slug}`

        const html = inviteEmailHtml({
          guestName:      `${guest.firstName} ${guest.lastName}`,
          eventName:      event.name,
          eventDate,
          venueName:      event.venueName,
          inviteLink,
          invitationCard: event.invitationCard,
          brandColor:     event.brandColor,
        })

        try {
          const result = await sendEmail({
            to:      guest.email,
            subject: `You're invited to ${event.name}`,
            html,
          })

          if (result.success) {
            await prisma.guest.update({
              where: { id: guest.id },
              data:  { inviteSentAt: new Date(), inviteChannel: "EMAIL" },
            })
            sent++
          } else {
            console.error(`[send-invites] Email failed for ${guest.email}:`, result.error)
            errors.push(`${guest.firstName}: ${result.error ?? "unknown"}`)
            failed++
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          console.error(`[send-invites] Email exception for ${guest.id}:`, msg)
          errors.push(`${guest.firstName}: ${msg}`)
          failed++
        }
      }
    }

    return NextResponse.json({
      sent,
      failed,
      skipped,
      errors: errors.length ? errors : undefined,
    })

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[send-invites] Top-level error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}