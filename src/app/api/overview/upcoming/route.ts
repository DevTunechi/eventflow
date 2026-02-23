// ─────────────────────────────────────────────
// src/app/api/overview/upcoming/route.ts
//
// Returns the next 5 upcoming events for the
// planner, ordered by date ascending.
// ─────────────────────────────────────────────

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-server"

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

    // Fetch next 5 upcoming events, soonest first
    const events = await prisma.event.findMany({
      where: {
        plannerId: planner.id,
        eventDate: { gte: new Date() }, // only future events
        status: { not: "CANCELLED" },
      },
      orderBy: { eventDate: "asc" },
      take: 5,
      select: {
        id:        true,
        name:      true,
        eventDate: true,
        status:    true,
        _count: {
          select: { guests: true }, // guest count per event
        },
      },
    })

    return NextResponse.json(events)

  } catch (error) {
    console.error("Upcoming events error:", error)
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
  }
}