// src/app/api/events/[id]/route.ts

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"

// ── GET /api/events/[id] ──────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const event = await prisma.event.findFirst({
      where: {
        id,
        plannerId: session.uid,
      },
      include: {
        guestTiers: {
          include: {
            _count: { select: { guests: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: { guests: true },
        },
      },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    return NextResponse.json({ event })
  } catch (err) {
    console.error("[GET /api/events/[id]]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// ── PATCH /api/events/[id] ────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const existing = await prisma.event.findFirst({
      where: { id, plannerId: session.uid },
    })
    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const body = await req.json()

    const {
      name, title, description,
      date, endDate,
      venueName, venue, city, state, country,
      venueCapacity,
      invitationCard,   // ← was incorrectly named coverImage in old handler
      brandColor,
      inviteModel, requireOtp,
      status,
      totalTables, seatsPerTable, releaseReservedAfter,
    } = body

    const VALID_STATUSES = ["DRAFT", "PUBLISHED", "ONGOING", "COMPLETED", "CANCELLED"]
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const updated = await prisma.event.update({
      where: { id },
      data: {
        // Accept both name and title for backwards compat
        ...((name  !== undefined) && { name:  name  }),
        ...((title !== undefined) && { name:  title }),
        ...(description       !== undefined && { description }),
        ...(date              !== undefined && (date ? { eventDate: new Date(date) } : {})),
        ...(endDate           !== undefined && (endDate ? { endDate: new Date(endDate) } : {})),
        // Accept both venueName and venue
        ...((venueName !== undefined) && { venueName }),
        ...((venue     !== undefined) && { venueName: venue }),
        ...(city              !== undefined && { city }),
        ...(state             !== undefined && { state }),
        ...(country           !== undefined && { country }),
        ...(venueCapacity     !== undefined && { venueCapacity: venueCapacity ? parseInt(venueCapacity) : null }),
        ...(invitationCard    !== undefined && { invitationCard }),   // ← fixed
        ...(brandColor        !== undefined && { brandColor }),
        ...(inviteModel       !== undefined && { inviteModel }),
        ...(requireOtp        !== undefined && { requireOtp }),
        ...(status            !== undefined && { status }),
        ...(totalTables       !== undefined && { totalTables:        totalTables ? parseInt(totalTables) : null }),
        ...(seatsPerTable     !== undefined && { seatsPerTable:      seatsPerTable ? parseInt(seatsPerTable) : null }),
        ...(releaseReservedAfter !== undefined && { releaseReservedAfter: releaseReservedAfter ? parseInt(releaseReservedAfter) : null }),
      },
      include: {
        guestTiers: {
          include: {
            _count: { select: { guests: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { guests: true } },
      },
    })

    return NextResponse.json({ event: updated })
  } catch (err) {
    console.error("[PATCH /api/events/[id]]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// ── DELETE /api/events/[id] ───────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const existing = await prisma.event.findFirst({
      where: { id, plannerId: session.uid },
    })
    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    await prisma.event.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/events/[id]]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}