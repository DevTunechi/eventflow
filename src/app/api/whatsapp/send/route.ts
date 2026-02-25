// ─────────────────────────────────────────────
// src/app/api/whatsapp/send/route.ts
//
// POST — send a WhatsApp message via the
//        Meta Cloud API (WhatsApp Business
//        API, hosted by Meta — free tier).
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-server"
import { decrypt, sendWhatsAppMessage } from "@/lib/whatsapp"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const user = await (prisma.user as any).findUnique({
      where:  { email: session.email },
      select: {
        id:              true,
        waAccessToken:   true,
        waPhoneNumberId: true,
        waMessagesSent:  true,
      },
    })

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    if (!user.waAccessToken || !user.waPhoneNumberId) {
      return NextResponse.json(
        { error: "WhatsApp not connected. Go to Settings → WhatsApp to set it up." },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { to, message, test } = body

    if (!to?.trim())      return NextResponse.json({ error: "Recipient phone number required" }, { status: 400 })
    if (!message?.trim()) return NextResponse.json({ error: "Message body required" },           { status: 400 })

    const accessToken = decrypt(user.waAccessToken)

    const result = await sendWhatsAppMessage({
      accessToken,
      phoneNumberId: user.waPhoneNumberId,
      to:            to.trim(),
      message:       message.trim(),
      previewUrl:    true,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 502 })
    }

    if (!test) {
      await (prisma.user as any).update({
        where: { id: user.id },
        data:  { waMessagesSent: { increment: 1 } },
      })
    }

    return NextResponse.json({ success: true, messageId: result.messageId })
  } catch (error) {
    console.error("WhatsApp send route error:", error)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}