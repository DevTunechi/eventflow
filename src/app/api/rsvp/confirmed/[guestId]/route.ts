// src/app/api/rsvp/confirmed/[guestId]/route.ts
// GET — returns guest + event data for confirmation page
//
// Added vs previous:
//   - rsvpDeadline so confirmation page can show meal edit button
//   - venueMapUrl, venueLat, venueLng for maps link on confirmation
//   - endTime for full event time display

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ guestId: string }> }
) {
  const { guestId } = await params

  try {
    const guest = await prisma.guest.findUnique({
      where:  { id: guestId },
      select: {
        id: true, firstName: true, lastName: true,
        qrCode: true, rsvpStatus: true,
        phone: true, email: true,
        tableNumber: true,
        tier:  { select: { name: true, color: true } },
        meals: {
          select: {
            menuItem: { select: { id: true, name: true, category: true } },
          },
        },
        event: {
          select: {
            id: true, name: true, slug: true,
            eventDate: true, startTime: true, endTime: true,
            venueName: true, venueAddress: true,
            // Map fields — used for directions link on confirmation page
            venueLat: true, venueLng: true, venueMapUrl: true,
            invitationCard: true, brandColor: true,
            // RSVP deadline — used to decide if meal edit is allowed
            rsvpDeadline: true,
            // Menu items for the meal edit form
            menuItems: {
              where:   { isAvailable: true },
              select:  { id: true, name: true, description: true, category: true },
              orderBy: { sortOrder: "asc" },
            },
            guestTiers: {
              where:  { id: { not: undefined } },
              select: { id: true, menuAccess: true },
            },
          },
        },
      },
    })

    if (!guest) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json({ guest, event: guest.event })
  } catch (error) {
    console.error("confirmed route error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}