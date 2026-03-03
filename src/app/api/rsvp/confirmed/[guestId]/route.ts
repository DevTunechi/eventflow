// src/app/api/rsvp/confirmed/[guestId]/route.ts
// GET — returns guest + event data for confirmation page

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
        meals: { select: { menuItem: { select: { name: true, category: true } } } },
        event: {
          select: {
            id: true, name: true, slug: true,
            eventDate: true, startTime: true,
            venueName: true, venueAddress: true,
            invitationCard: true, brandColor: true,
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