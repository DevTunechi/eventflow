// ─────────────────────────────────────────────
// src/app/api/events/[id]/guests/send-invites/route.ts
//
// POST — send WhatsApp invite messages to
//        a list of guest IDs.
//
// Now wired to real Meta Cloud API via
// /api/whatsapp/send internals.
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-server"
import { decrypt, sendWhatsAppMessage } from "@/lib/whatsapp"

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
        waAccessToken:   true,
        waPhoneNumberId: true,
      },
    })

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    if (!user.waAccessToken || !user.waPhoneNumberId) {
      return NextResponse.json(
        { error: "WhatsApp not connected." },
        { status: 400 }
      )
    }

    const event = await prisma.event.findFirst({
      where:  { id, plannerId: user.id },
      select: { id: true, name: true, slug: true, inviteModel: true },
    })
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const body = await req.json()
    const { guestIds }: { guestIds: string[] } = body
    if (!guestIds?.length) return NextResponse.json({ error: "No guest IDs provided" }, { status: 400 })

    const guests = await prisma.guest.findMany({
      where:  { id: { in: guestIds }, eventId: id },
      select: { id: true, firstName: true, lastName: true, phone: true, inviteToken: true },
    })

    const baseUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "https://eventflowng.vercel.app"
    const accessToken = decrypt(user.waAccessToken)

    // ── Debug: log decrypted token prefix and phoneNumberId ──
    console.log("[send-invites] phoneNumberId:", user.waPhoneNumberId)
    console.log("[send-invites] token prefix:", accessToken.slice(0, 10))

    let sent    = 0
    let failed  = 0
    let noPhone = 0
    const errors: string[] = []

    for (const guest of guests) {
      if (!guest.phone) { noPhone++; continue }

      const inviteLink = event.inviteModel === "CLOSED" && guest.inviteToken
        ? `${baseUrl}/rsvp/${event.slug}?invite=${guest.inviteToken}`
        : `${baseUrl}/rsvp/${event.slug}`

      const message = [
        `Hello ${guest.firstName} 👋`,
        ``,
        `You're invited to *${event.name}*.`,
        ``,
        `Click the link below to RSVP and confirm your attendance:`,
        inviteLink,
        ``,
        `We look forward to celebrating with you! 🎉`,
      ].join("\n")

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
          console.error(`[send-invites] Failed for ${guest.phone}:`, result.error)
          errors.push(result.error ?? "unknown")
          failed++
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[send-invites] Exception for ${guest.id}:`, msg)
        errors.push(msg)
        failed++
      }
    }

    if (sent > 0) {
      await (prisma.user as any).update({
        where: { id: user.id },
        data:  { waMessagesSent: { increment: sent } },
      })
    }

    // Return errors array so we can see what Meta said
    return NextResponse.json({ sent, failed, noPhone, errors })

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[send-invites] Top-level error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}