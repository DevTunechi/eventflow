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
      where: { id, plannerId: session.uid },
      include: {
        guestTiers: {
          include: { _count: { select: { guests: true } } },
          orderBy: { createdAt: "asc" },
        },
        menuItems: { orderBy: { sortOrder: "asc" } },
        vendors:   true,
        ushers:    true,
        _count: { select: { guests: true } },
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
      name, description, eventType,
      date, startTime, endTime,
      venueName, venueAddress, venueCapacity,
      inviteModel, requireOtp, rsvpDeadline,
      brandColor, brandLogo, invitationCard,
      status,
    } = body

    const VALID_STATUSES = ["DRAFT", "PUBLISHED", "ONGOING", "COMPLETED", "CANCELLED"]
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const updated = await prisma.event.update({
      where: { id },
      data: {
        ...(name           !== undefined && { name }),
        ...(description    !== undefined && { description }),
        ...(eventType      !== undefined && { eventType }),
        ...(date           !== undefined && { eventDate: new Date(date) }),
        ...(startTime      !== undefined && { startTime }),
        ...(endTime        !== undefined && { endTime }),
        ...(venueName      !== undefined && { venueName }),
        ...(venueAddress   !== undefined && { venueAddress }),
        ...(venueCapacity  !== undefined && { venueCapacity: venueCapacity ? Number(venueCapacity) : null }),
        ...(inviteModel    !== undefined && { inviteModel }),
        ...(requireOtp     !== undefined && { requireOtp }),
        ...(rsvpDeadline   !== undefined && { rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline) : null }),
        ...(brandColor     !== undefined && { brandColor }),
        ...(brandLogo      !== undefined && { brandLogo }),
        ...(invitationCard !== undefined && { invitationCard }),
        ...(status         !== undefined && { status }),
      },
      include: {
        guestTiers: {
          include: { _count: { select: { guests: true } } },
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