// ─────────────────────────────────────────────
// FILE: src/app/api/events/[id]/vendor-feedback/route.ts
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth }   from "@/lib/auth-server"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const { id: eventId } = await params

    // Verify planner owns this event
    const planner = await prisma.user.findUnique({
      where:  { email: session.email },
      select: { id: true },
    })
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const event = await prisma.event.findFirst({
      where:  { id: eventId, plannerId: planner.id },
      select: { id: true },
    })
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    // Fetch feedback using the correct schema fields: createdAt, plannerRating, vendorRating
    const feedback = await prisma.vendorFeedback.findMany({
      where:   { eventId },
      orderBy: { createdAt: "desc" },
      select: {
        id:              true,
        plannerRating:   true, // Corrected from 'rating'
        plannerComment:  true, // Corrected from 'message'
        vendorRating:    true,
        vendorComment:   true,
        createdAt:       true,
        vendor: {
          select: {
            id:          true,
            name:        true,
            role:        true,
            contactName: true,
          },
        },
      },
    })

    // Calculate the average based on the planner's ratings of vendors
    const ratedItems = feedback.filter(f => f.plannerRating !== null);
    const avgRating = ratedItems.length > 0
      ? Math.round((ratedItems.reduce((sum, f) => sum + (f.plannerRating || 0), 0) / ratedItems.length) * 10) / 10
      : null

    return NextResponse.json({
      feedback,
      summary: {
        total:     feedback.length,
        avgRating,
      },
    })
  } catch (err) {
    console.error("GET vendor-feedback error:", err)
    return NextResponse.json({ error: "Failed to load feedback" }, { status: 500 })
  }
}