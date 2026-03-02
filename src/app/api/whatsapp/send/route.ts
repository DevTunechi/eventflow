// ─────────────────────────────────────────────
// src/app/api/whatsapp/send/route.ts
//
// POST — send a WhatsApp message via the
//        Meta Cloud API using EventFlow's
//        platform-level WABA credentials.
//
// Credentials are env-only — no per-planner
// WABA connection required or supported.
//
// Required env vars:
//   WA_ACCESS_TOKEN
//   WA_PHONE_NUMBER_ID
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-server"
import { sendWhatsAppMessage } from "@/lib/whatsapp"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    // Verify the planner exists
    const user = await prisma.user.findUnique({
      where:  { email: session.email },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    // Platform credentials — never from DB
    const accessToken   = process.env.WA_ACCESS_TOKEN    ?? ""
    const phoneNumberId = process.env.WA_PHONE_NUMBER_ID ?? ""

    if (!accessToken || !phoneNumberId) {
      console.error("WA_ACCESS_TOKEN or WA_PHONE_NUMBER_ID not set in environment")
      return NextResponse.json(
        { error: "WhatsApp is not configured. Contact support." },
        { status: 503 }
      )
    }

    const body = await req.json()
    const { to, message, test } = body

    if (!to?.trim())      return NextResponse.json({ error: "Recipient phone number required" }, { status: 400 })
    if (!message?.trim()) return NextResponse.json({ error: "Message body required" },           { status: 400 })

    const result = await sendWhatsAppMessage({
      accessToken,
      phoneNumberId,
      to:         to.trim(),
      message:    message.trim(),
      previewUrl: true,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 502 })
    }

    return NextResponse.json({ success: true, messageId: result.messageId })
  } catch (error) {
    console.error("WhatsApp send route error:", error)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}