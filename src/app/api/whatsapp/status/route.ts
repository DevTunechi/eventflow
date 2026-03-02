// ─────────────────────────────────────────────
// src/app/api/whatsapp/status/route.ts
//
// GET — returns WhatsApp connection status.
//
// EventFlow owns the single platform WABA.
// Status is derived from env vars being set,
// not from per-planner DB credentials.
//
// Required env vars:
//   WA_ACCESS_TOKEN
//   WA_PHONE_NUMBER_ID
//   WA_WABA_ID          (optional, for display)
//   WA_DISPLAY_NAME     (optional, for display)
//   WA_PHONE_NUMBER     (optional, for display)
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const connected =
      !!process.env.WA_ACCESS_TOKEN?.trim() &&
      !!process.env.WA_PHONE_NUMBER_ID?.trim()

    return NextResponse.json({
      connected,
      // Display info only — never expose the token
      phoneNumber:   process.env.WA_PHONE_NUMBER   ?? null,
      displayName:   process.env.WA_DISPLAY_NAME   ?? "EventFlow",
      businessName:  process.env.WA_BUSINESS_NAME  ?? "EventFlow",
      wabaId:        process.env.WA_WABA_ID        ?? null,
      phoneNumberId: process.env.WA_PHONE_NUMBER_ID ?? null,
    })
  } catch (error) {
    console.error("WhatsApp status error:", error)
    return NextResponse.json({ error: "Failed to get status" }, { status: 500 })
  }
}