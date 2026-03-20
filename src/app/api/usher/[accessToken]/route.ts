// ─────────────────────────────────────────────
// FILE: src/app/api/usher/[accessToken]/route.ts
//
// PUBLIC API — no authentication required.
// Called by the usher portal page on load.
//
// GET /api/usher/[accessToken]
//   Looks up an Usher by their accessToken (cuid),
//   returns their name, role, event details,
//   and live check-in stats for the event.
//
// The accessToken is the value stored in
// Usher.accessToken — generated as @default(cuid())
// in schema.prisma. It is what appears in the URL:
//   /usher/cmmy1b8rb000bl704g32vpob5
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/usher/[accessToken]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ accessToken: string }> }
) {
  try {
    const { accessToken } = await params

    // 1. Look up the usher by their unique access token
    const usher = await prisma.usher.findUnique({
      where:  { accessToken },
      select: {
        id:       true,
        name:     true,
        role:     true,
        phone:    true,
        isActive: true,
        eventId:  true,
        // Include core event details needed by the portal
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

    // 2. Return 404 if token doesn't match any usher
    if (!usher) {
      return NextResponse.json(
        { error: "Usher not found. This link may be invalid or expired." },
        { status: 404 }
      )
    }

    // 3. Block access if usher has been deactivated by planner
    if (!usher.isActive) {
      return NextResponse.json(
        { error: "This usher account has been deactivated." },
        { status: 403 }
      )
    }

    // 4. Pull live check-in stats for the event
    //    These counts update in real time as guests are scanned
    const [totalGuests, checkedIn, flagged] = await Promise.all([
      // Total confirmed RSVPs for this event
      prisma.guest.count({
        where: { eventId: usher.eventId, rsvpStatus: "CONFIRMED" },
      }),
      // How many have been scanned in so far
      prisma.guest.count({
        where: { eventId: usher.eventId, checkedIn: true },
      }),
      // Gate crashers / double-scans flagged
      prisma.guest.count({
        where: { eventId: usher.eventId, isFlagged: true },
      }),
    ])

    // 5. Return usher info + event + live stats
    return NextResponse.json({
      usher: {
        id:       usher.id,
        name:     usher.name,
        role:     usher.role,
        phone:    usher.phone,
        isActive: usher.isActive,
      },
      event: usher.event,
      stats: {
        totalGuests,
        checkedIn,
        pending: totalGuests - checkedIn, // Guests not yet arrived
        flagged,
      },
    })
  } catch (err) {
    console.error("GET /api/usher/[accessToken] error:", err)
    return NextResponse.json(
      { error: "Failed to load usher portal" },
      { status: 500 }
    )
  }
}