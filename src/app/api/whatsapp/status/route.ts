// ─────────────────────────────────────────────
// src/app/api/whatsapp/status/route.ts
//
// GET — return current WhatsApp Business
//       connection status for the planner.
//
// Returns whether connected, the display
// name, phone number, and total messages sent.
// Never returns the raw access token.
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-server"

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const user = await (prisma.user as any).findUnique({
      where:  { email: session.email },
      select: {
        waAccessToken:   true,
        waPhoneNumberId: true,
        waWabaId:        true,
        waDisplayName:   true,
        waPhoneNumber:   true,
        waBusinessName:  true,
        waConnectedAt:   true,
        waMessagesSent:  true,
      },
    })

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const connected = !!user.waAccessToken && !!user.waPhoneNumberId

    return NextResponse.json({
      connected,
      phoneNumber:       connected ? user.waPhoneNumber   : null,
      displayName:       connected ? user.waDisplayName   : null,
      businessName:      connected ? user.waBusinessName  : null,
      wabaId:            connected ? user.waWabaId        : null,
      phoneNumberId:     connected ? user.waPhoneNumberId : null,
      connectedAt:       connected ? user.waConnectedAt   : null,
      messagesSentTotal: user.waMessagesSent ?? 0,
    })
  } catch (error) {
    console.error("WhatsApp status error:", error)
    return NextResponse.json({ error: "Failed to get status" }, { status: 500 })
  }
}