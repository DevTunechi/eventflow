// ─────────────────────────────────────────────
// FILE: src/app/api/usher/[accessToken]/route.ts
//
// PUBLIC API — no authentication required.
// Token is the auth mechanism.
//
// GET /api/usher/[accessToken]
//   Returns usher + event + live stats.
//   Returns 410 Gone if now > eventDate + 24hrs.
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getExpiryInfo } from "@/lib/event-expiry"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ accessToken: string }> }
) {
  try {
    const { accessToken } = await params

    // 1. Look up usher by their unique access token
    const usher = await prisma.usher.findUnique({
      where:  { accessToken },
      select: {
        id:       true,
        name:     true,
        role:     true,
        phone:    true,
        isActive: true,
        eventId:  true,
        event: {
          select: {
            id:             true,
            name:           true,
            eventDate:      true,
            startTime:      true,
            venueName:      true,
            venueAddress:   true,
            status:         true,
            invitationCard: true,
          },
        },
      },
    })

    // 2. 404 if token is invalid
    if (!usher) {
      return NextResponse.json(
        { error: "Usher not found. This link may be invalid." },
        { status: 404 }
      )
    }

    // 3. Check expiry — 410 Gone after eventDate + 24hrs
    const expiry = getExpiryInfo(new Date(usher.event.eventDate))
    if (expiry.isExpired) {
      return NextResponse.json(
        {
          error:     "This portal has expired.",
          eventName: usher.event.name,
          expiredAt: expiry.expiresAt,
        },
        { status: 410 }
      )
    }

    // 4. Block deactivated ushers
    if (!usher.isActive) {
      return NextResponse.json(
        { error: "This usher account has been deactivated." },
        { status: 403 }
      )
    }

    // 5. Live check-in stats
    const [totalGuests, checkedIn, flagged] = await Promise.all([
      prisma.guest.count({
        where: { eventId: usher.eventId, rsvpStatus: "CONFIRMED" },
      }),
      prisma.guest.count({
        where: { eventId: usher.eventId, checkedIn: true },
      }),
      prisma.guest.count({
        where: { eventId: usher.eventId, isFlagged: true },
      }),
    ])

    return NextResponse.json({
      usher: {
        id:       usher.id,
        name:     usher.name,
        role:     usher.role,
        phone:    usher.phone,
        isActive: usher.isActive,
      },
      event:  usher.event,
      stats: {
        totalGuests,
        checkedIn,
        pending: totalGuests - checkedIn,
        flagged,
      },
      expiry, // { isExpired, isInFeedbackWindow, expiresAt }
    })
  } catch (err) {
    console.error("GET /api/usher/[accessToken] error:", err)
    return NextResponse.json(
      { error: "Failed to load usher portal" },
      { status: 500 }
    )
  }
}