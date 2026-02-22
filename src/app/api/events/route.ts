// ─────────────────────────────────────────────
// src/app/api/events/route.ts
//
// GET  /api/events        — list planner's events
// POST /api/events        — create a new event
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-server"

// ── GET — list all events for this planner ────
export async function GET() {
  try {
    const session = await auth()
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const planner = await prisma.user.findUnique({
      where: { email: session.email },
      select: { id: true },
    })

    if (!planner) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const events = await prisma.event.findMany({
      where: { plannerId: planner.id },
      orderBy: { eventDate: "asc" },
      select: {
        id:             true,
        name:           true,
        slug:           true,
        eventType:      true,
        eventDate:      true,
        status:         true,
        inviteModel:    true,
        invitationCard: true,
        venueName:      true,
        venueCapacity:  true,
        _count: {
          select: {
            guests:  true,
            vendors: true,
          },
        },
      },
    })

    return NextResponse.json(events)

  } catch (error) {
    console.error("Events list error:", error)
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
  }
}

// ── POST — create a new event ─────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const planner = await prisma.user.findUnique({
      where: { email: session.email },
      select: { id: true },
    })

    if (!planner) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const body = await req.json()

    const {
      name,
      slug,
      description,
      eventType,
      eventDate,
      startTime,
      endTime,
      venueName,
      venueAddress,
      venueCapacity,
      inviteModel,
      requireOtp,
      rsvpDeadline,
      invitationCard,
      totalTables,
      seatsPerTable,
      releaseReservedAfter,
      brandColor,
    } = body

    // Validate required fields
    if (!name || !eventDate) {
      return NextResponse.json(
        { error: "Event name and date are required" },
        { status: 400 }
      )
    }

    // Generate slug from name if not provided
    // e.g. "Tunde & Amaka's Wedding" → "tunde-amakas-wedding"
    const finalSlug = slug ?? name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")  // remove special chars
      .replace(/\s+/g, "-")           // spaces to hyphens
      .replace(/-+/g, "-")            // deduplicate hyphens
      .trim()

    // Ensure slug is unique — append random suffix if taken
    const existing = await prisma.event.findUnique({ where: { slug: finalSlug } })
    const uniqueSlug = existing
      ? `${finalSlug}-${Math.random().toString(36).slice(2, 6)}`
      : finalSlug

    const event = await prisma.event.create({
      data: {
        plannerId:           planner.id,
        name,
        slug:                uniqueSlug,
        description:         description ?? null,
        eventType:           eventType   ?? "OTHER",
        eventDate:           new Date(eventDate),
        startTime:           startTime   ?? null,
        endTime:             endTime     ?? null,
        venueName:           venueName   ?? null,
        venueAddress:        venueAddress ?? null,
        venueCapacity:       venueCapacity ? Number(venueCapacity) : null,
        inviteModel:         inviteModel  ?? "OPEN",
        requireOtp:          requireOtp   ?? false,
        rsvpDeadline:        rsvpDeadline ? new Date(rsvpDeadline) : null,
        invitationCard:      invitationCard ?? null,
        totalTables:         totalTables   ? Number(totalTables)   : null,
        seatsPerTable:       seatsPerTable ? Number(seatsPerTable) : null,
        releaseReservedAfter: releaseReservedAfter ? Number(releaseReservedAfter) : null,
        brandColor:          brandColor ?? "#C9A84C",
        status:              "DRAFT",
      },
    })

    return NextResponse.json(event, { status: 201 })

  } catch (error) {
    console.error("Event create error:", error)
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 })
  }
}