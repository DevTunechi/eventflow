// src/app/api/events/[id]/route.ts

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"

// ── GET /api/events/[id] ──────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth(req)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const event = await prisma.event.findFirst({
      where: {
        id:        params.id,
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
  { params }: { params: { id: string } }
) {
  const session = await auth(req)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Confirm ownership
    const existing = await prisma.event.findFirst({
      where: { id: params.id, plannerId: session.uid },
    })
    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const body = await req.json()

    // Whitelist updatable fields
    const {
      title, description, date, endDate,
      venue, city, state, country,
      coverImage, brandColor,
      inviteModel, requireOtp,
      status,
    } = body

    // Validate status transition
    const VALID_STATUSES = ["DRAFT", "PUBLISHED", "ONGOING", "COMPLETED", "CANCELLED"]
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const updated = await prisma.event.update({
      where: { id: params.id },
      data: {
        ...(title        !== undefined && { title }),
        ...(description  !== undefined && { description }),
        ...(date         !== undefined && { date: new Date(date) }),
        ...(endDate      !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(venue        !== undefined && { venue }),
        ...(city         !== undefined && { city }),
        ...(state        !== undefined && { state }),
        ...(country      !== undefined && { country }),
        ...(coverImage   !== undefined && { coverImage }),
        ...(brandColor   !== undefined && { brandColor }),
        ...(inviteModel  !== undefined && { inviteModel }),
        ...(requireOtp   !== undefined && { requireOtp }),
        ...(status       !== undefined && { status }),
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
  { params }: { params: { id: string } }
) {
  const session = await auth(req)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const existing = await prisma.event.findFirst({
      where: { id: params.id, plannerId: session.uid },
    })
    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    await prisma.event.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/events/[id]]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}