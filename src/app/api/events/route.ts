// src/app/api/events/route.ts

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"

// ── GET /api/events — list planner's events ───
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const events = await prisma.event.findMany({
      where: { plannerId: session.uid },
      orderBy: { createdAt: "desc" },
      include: {
        guestTiers: { select: { id: true, name: true, color: true } },
        _count: { select: { guests: true } },
      },
    })

    return NextResponse.json(events)
  } catch (err) {
    console.error("[GET /api/events]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// ── POST /api/events — create event ───────────
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()

    const {
      name, eventType, eventDate, startTime, endTime,
      venueName, venueAddress, venueCapacity,
      description, invitationCard,
      inviteModel, requireOtp, rsvpDeadline,
      brandColor,
      tiers = [],
      totalTables, seatsPerTable, releaseReservedAfter,
      menuItems = [],
      status = "DRAFT",
    } = body

    if (!name || !eventDate) {
      return NextResponse.json({ error: "Name and date are required" }, { status: 400 })
    }

    // Generate slug from name + timestamp
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      + "-" + Date.now().toString(36)

    const event = await prisma.event.create({
      data: {
        plannerId:            session.uid,
        name,
        slug,
        description:          description          || null,
        eventType:            eventType            || "WEDDING",
        eventDate:            new Date(eventDate),
        startTime:            startTime            || null,
        endTime:              endTime              || null,
        venueName:            venueName            || null,
        venueAddress:         venueAddress         || null,
        venueCapacity:        venueCapacity        ? Number(venueCapacity)        : null,
        invitationCard:       invitationCard       || null,
        inviteModel:          inviteModel          || "OPEN",
        requireOtp:           requireOtp           ?? false,
        rsvpDeadline:         rsvpDeadline         ? new Date(rsvpDeadline)       : null,
        brandColor:           brandColor           || "#C9A84C",
        totalTables:          totalTables          ? Number(totalTables)          : null,
        seatsPerTable:        seatsPerTable        ? Number(seatsPerTable)        : null,
        releaseReservedAfter: releaseReservedAfter ? Number(releaseReservedAfter) : null,
        status,

        // Create tiers
        guestTiers: tiers.length > 0 ? {
          create: tiers.map((t: {
            name: string; color?: string; seatingType?: string;
            menuAccess?: string; maxGuests?: string; tablePrefix?: string;
          }) => ({
            name:        t.name,
            color:       t.color       || "#b48c3c",
            seatingType: t.seatingType || "DYNAMIC",
            menuAccess:  t.menuAccess  || "AT_EVENT",
            maxGuests:   t.maxGuests   ? Number(t.maxGuests) : null,
            tablePrefix: t.tablePrefix || null,
          })),
        } : undefined,

        // Create menu items
        menuItems: menuItems.length > 0 ? {
          create: menuItems.map((m: {
            category: string; name: string; description?: string;
          }, i: number) => ({
            category:    m.category,
            name:        m.name,
            description: m.description || null,
            sortOrder:   i,
          })),
        } : undefined,
      },
    })

    return NextResponse.json(event, { status: 201 })
  } catch (err) {
    console.error("[POST /api/events]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}