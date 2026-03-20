// ─────────────────────────────────────────────
// FILE: src/app/api/events/[id]/vendor-feedback/route.ts
//
// AUTHENTICATED — planner only.
//
// GET /api/events/[id]/vendor-feedback
//   Returns all vendor feedback submitted for
//   this event. Shown on the event detail page
//   once the event has ended.
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

    // Fetch all feedback with vendor details
    const feedback = await prisma.vendorFeedback.findMany({
      where:   { eventId },
      orderBy: { submittedAt: "desc" },
      select: {
        id:          true,
        rating:      true,
        message:     true,
        submittedAt: true,
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

    // Calculate average rating for the event summary
    const avgRating = feedback.length > 0
      ? Math.round((feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length) * 10) / 10
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