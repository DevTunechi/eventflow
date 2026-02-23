// ─────────────────────────────────────────────
// src/app/api/auth/overview/recent-rsvps/route.ts
//
// Returns the 8 most recent RSVP submissions
// across all of the planner's events.
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

    // Most recent RSVPs across all planner events
    const rsvps = await prisma.guest.findMany({
      where: {
        event: { plannerId: planner.id },
        rsvpAt: { not: null }, // only guests who have actually RSVPd
      },
      orderBy: { rsvpAt: "desc" }, // most recent first
      take: 8,
      select: {
        id:         true,
        firstName:  true,
        lastName:   true,
        rsvpAt:     true,
        rsvpStatus: true,
        event: {
          select: { name: true }, // event name for context in the feed
        },
      },
    })

    return NextResponse.json(rsvps)

  } catch (error) {
    console.error("Recent RSVPs error:", error)
    return NextResponse.json({ error: "Failed to fetch RSVPs" }, { status: 500 })
  }
}