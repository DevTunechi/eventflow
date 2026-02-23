// ─────────────────────────────────────────────
// src/app/api/auth/overview/stats/route.ts
//
// Returns the 7 stat card counts for the
// Overview page. All counts are scoped to
// the currently authenticated planner's events.
// ─────────────────────────────────────────────

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-server"

export async function GET() {
  try {
    // Get the current planner's email from the
    // Firebase session cookie (server-side)
    const session = await auth()
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    // Find the planner in our DB by email
    const planner = await prisma.user.findUnique({
      where: { email: session.email },
      select: { id: true },
    })

    if (!planner) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const plannerId = planner.id
    const now       = new Date()

    // Run all counts in parallel for performance
    const [
      totalEvents,
      upcomingEvents,
      totalGuests,
      checkedIn,
      pendingRsvps,
      totalVendors,
      gateCrashers,
    ] = await Promise.all([

      // Total events this planner has created
      prisma.event.count({
        where: { plannerId },
      }),

      // Events whose date is in the future
      prisma.event.count({
        where: { plannerId, eventDate: { gte: now } },
      }),

      // Guests who have confirmed their RSVP
      prisma.guest.count({
        where: {
          event: { plannerId },
          rsvpStatus: "CONFIRMED",
        },
      }),

      // Guests who have physically checked in
      prisma.guest.count({
        where: {
          event: { plannerId },
          checkedIn: true,
        },
      }),

      // Guests who haven't responded yet
      prisma.guest.count({
        where: {
          event: { plannerId },
          rsvpStatus: "PENDING",
        },
      }),

      // Total vendors across all events
      prisma.vendor.count({
        where: { event: { plannerId } },
      }),

      // Gate crashers = guests flagged during entry
      // (checkedIn twice — QR code reuse attempt)
      // We track this by counting guests where
      // checkedIn is true but they were already
      // marked — for now this counts checked-in
      // guests not on the confirmed list
      prisma.guest.count({
        where: {
          event: { plannerId },
          checkedIn: true,
          rsvpStatus: { not: "CONFIRMED" },
          // A guest who checked in but wasn't
          // on the confirmed list = gate crasher
        },
      }),
    ])

    return NextResponse.json({
      totalEvents,
      upcomingEvents,
      totalGuests,
      checkedIn,
      pendingRsvps,
      totalVendors,
      gateCrashers,
    })

  } catch (error) {
    console.error("Stats fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}