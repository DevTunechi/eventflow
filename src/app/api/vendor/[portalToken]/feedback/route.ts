// ─────────────────────────────────────────────
// FILE: src/app/api/vendor/[portalToken]/feedback/route.ts
//
// PUBLIC API — token is the auth mechanism.
//
// POST /api/vendor/[portalToken]/feedback
//   Body: { rating: number (1-5), message?: string }
//   Submits or updates vendor's post-event feedback.
//   Only allowed during the 24hr feedback window.
//   Uses upsert — vendor can update their feedback
//   within the window.
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isInFeedbackWindow, isPortalExpired } from "@/lib/event-expiry"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ portalToken: string }> }
) {
  try {
    const { portalToken } = await params

    // 1. Look up vendor and event date
    const vendor = await prisma.vendor.findUnique({
      where:  { portalToken },
      select: {
        id:      true,
        eventId: true,
        name:    true,
        event:   { select: { eventDate: true, name: true } },
      },
    })

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
    }

    const eventDate = new Date(vendor.event.eventDate)

    // 2. Only allow feedback during the 24hr post-event window
    if (isPortalExpired(eventDate)) {
      return NextResponse.json(
        { error: "The feedback window has closed. This portal has expired." },
        { status: 410 }
      )
    }

    if (!isInFeedbackWindow(eventDate)) {
      return NextResponse.json(
        { error: "Feedback can only be submitted after the event has taken place." },
        { status: 403 }
      )
    }

    // 3. Validate input
    const { rating, message } = await req.json()

    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be a number between 1 and 5." },
        { status: 400 }
      )
    }

    // 4. Upsert — create or update the vendor's feedback
    //    vendorId is @unique so there's always max one per vendor
    const feedback = await prisma.vendorFeedback.upsert({
      where:  { vendorId: vendor.id },
      create: {
        vendorId: vendor.id,
        eventId:  vendor.eventId,
        rating,
        message:  message?.trim() || null,
      },
      update: {
        rating,
        message:  message?.trim() || null,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ feedback })
  } catch (err) {
    console.error("POST vendor feedback error:", err)
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 })
  }
}