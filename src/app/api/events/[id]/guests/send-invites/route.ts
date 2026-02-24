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
import { sendWhatsAppMessage } from "@/app/api/whatsapp/send/route"
import crypto from "crypto"

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? ""

function decrypt(ciphertext: string): string {
  if (!ENCRYPTION_KEY || !ciphertext.includes(":")) return ciphertext
  try {
    const [ivHex, tagHex, dataHex] = ciphertext.split(":")
    const key      = Buffer.from(ENCRYPTION_KEY, "hex")
    const iv       = Buffer.from(ivHex,  "hex")
    const tag      = Buffer.from(tagHex, "hex")
    const data     = Buffer.from(dataHex,"hex")
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(data).toString("utf8") + decipher.final("utf8")
  } catch {
    return ciphertext
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
        { error: "WhatsApp not connected. Go to Settings → WhatsApp to connect your business number first." },
        { status: 400 }
      )
    }

    const event = await prisma.event.findFirst({
      where:  { id: params.id, plannerId: user.id },
      select: { id: true, name: true, slug: true, inviteModel: true },
    })
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const body = await req.json()
    const { guestIds }: { guestIds: string[] } = body

    if (!guestIds?.length) return NextResponse.json({ error: "No guest IDs provided" }, { status: 400 })

    const guests = await prisma.guest.findMany({
      where: { id: { in: guestIds }, eventId: params.id },
      select: { id: true, firstName: true, lastName: true, phone: true, inviteToken: true },
    })

    const baseUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "https://eventflowng.vercel.app"
    const accessToken = decrypt(user.waAccessToken)
    let sent   = 0
    let failed = 0
    let noPhone = 0

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
          console.error(`Failed to send to ${guest.phone}:`, result.error)
          failed++
        }
      } catch (e) {
        console.error(`Exception sending to ${guest.id}:`, e)
        failed++
      }
    }

    // Increment total messages sent counter
    if (sent > 0) {
      await (prisma.user as any).update({
        where: { id: user.id },
        data:  { waMessagesSent: { increment: sent } },
      })
    }

    return NextResponse.json({ sent, failed, noPhone })
  } catch (error) {
    console.error("Send invites error:", error)
    return NextResponse.json({ error: "Failed to send invites" }, { status: 500 })
  }
}