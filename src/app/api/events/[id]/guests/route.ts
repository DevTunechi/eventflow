// ─────────────────────────────────────────────
// src/app/api/events/[id]/guests/route.ts
//
// GET  — list all guests for the event
// POST — add a single guest manually
//        Hard blocks: venue capacity, tier cap, table capacity
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-server"

async function getPlanner() {
  const session = await auth()
  if (!session?.email) return null
  return prisma.user.findUnique({ where: { email: session.email }, select: { id: true } })
}

async function verifyEventOwner(eventId: string, plannerId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, plannerId },
    select: {
      id:           true,
      inviteModel:  true,
      name:         true,
      slug:         true,
      venueCapacity: true,
      totalTables:  true,
      seatsPerTable: true,
      _count: { select: { guests: true } },
    },
  })
}

// ── GET /api/events/[id]/guests ───────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const planner = await getPlanner()
    if (!planner) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const event = await verifyEventOwner(id, planner.id)
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const guests = await prisma.guest.findMany({
      where:   { eventId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id:           true,
        firstName:    true,
        lastName:     true,
        phone:        true,
        email:        true,
        rsvpStatus:   true,
        rsvpAt:       true,
        checkedIn:    true,
        checkedInAt:  true,
        inviteSentAt: true,
        isFlagged:    true,
        tableNumber:  true,
        createdAt:    true,
        tier: {
          select: { id: true, name: true, color: true }
        },
      },
    })

    return NextResponse.json(guests)
  } catch (error) {
    console.error("GET guests error:", error)
    return NextResponse.json({ error: "Failed to fetch guests" }, { status: 500 })
  }
}

// ── POST /api/events/[id]/guests ──────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const planner = await getPlanner()
    if (!planner) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const event = await verifyEventOwner(id, planner.id)
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const body = await req.json()
    const { firstName, lastName, phone, tierId } = body

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json(
        { error: "First name and last name are required" },
        { status: 400 }
      )
    }

    // ── 1. Venue capacity hard block ──────────────
    if (event.venueCapacity && event._count.guests >= event.venueCapacity) {
      return NextResponse.json(
        {
          error: "Venue capacity reached",
          code:  "VENUE_CAPACITY_REACHED",
          detail: `This event has reached its venue capacity of ${event.venueCapacity} guests.`,
          limit: event.venueCapacity,
          current: event._count.guests,
        },
        { status: 409 }
      )
    }

    // ── 2. Tier cap hard block ────────────────────
    if (tierId) {
      const tier = await prisma.guestTier.findFirst({
        where: { id: tierId, eventId: id },
        select: {
          id:        true,
          name:      true,
          maxGuests: true,
          _count:    { select: { guests: true } },
        },
      })

      if (!tier) {
        return NextResponse.json({ error: "Tier not found" }, { status: 400 })
      }

      if (tier.maxGuests && tier._count.guests >= tier.maxGuests) {
        return NextResponse.json(
          {
            error: `${tier.name} tier is full`,
            code:  "TIER_CAPACITY_REACHED",
            detail: `The ${tier.name} tier has reached its maximum of ${tier.maxGuests} guests.`,
            tierName: tier.name,
            limit:    tier.maxGuests,
            current:  tier._count.guests,
          },
          { status: 409 }
        )
      }
    }

    // ── 3. Table capacity hard block ──────────────
    // Total seats = totalTables × seatsPerTable. Block if all seats are filled.
    if (event.totalTables && event.seatsPerTable) {
      const totalSeats = event.totalTables * event.seatsPerTable
      if (event._count.guests >= totalSeats) {
        return NextResponse.json(
          {
            error: "No seats remaining",
            code:  "TABLE_CAPACITY_REACHED",
            detail: `All ${totalSeats} seats across ${event.totalTables} tables are filled.`,
            limit:   totalSeats,
            current: event._count.guests,
          },
          { status: 409 }
        )
      }
    }

    // ── Create guest ──────────────────────────────
    const inviteToken = event.inviteModel === "CLOSED"
      ? `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
      : null

    const guest = await prisma.guest.create({
      data: {
        eventId:       id,
        firstName:     firstName.trim(),
        lastName:      lastName.trim(),
        phone:         phone?.trim() || null,
        tierId:        tierId || null,
        inviteToken,
        inviteChannel: "MANUAL",
        rsvpStatus:    "PENDING",
      },
      select: {
        id:           true,
        firstName:    true,
        lastName:     true,
        phone:        true,
        email:        true,
        rsvpStatus:   true,
        rsvpAt:       true,
        checkedIn:    true,
        checkedInAt:  true,
        inviteSentAt: true,
        isFlagged:    true,
        tableNumber:  true,
        createdAt:    true,
        tier: {
          select: { id: true, name: true, color: true }
        },
      },
    })

    return NextResponse.json({ guest }, { status: 201 })
  } catch (error) {
    console.error("POST guest error:", error)
    return NextResponse.json({ error: "Failed to add guest" }, { status: 500 })
  }
}