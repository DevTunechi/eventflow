// src/app/api/events/[id]/vendors/[vendorId]/feedback/route.ts
// POST — planner submits feedback for a vendor after event completes
// GET  — planner fetches feedback record for a vendor

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; vendorId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const { id: eventId, vendorId } = await params
    const { rating, comment, wouldHire } = await req.json()

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be 1–5" }, { status: 400 })
    }

    const feedback = await prisma.vendorFeedback.upsert({
      where:  { vendorId_eventId: { vendorId, eventId } },
      update: {
        plannerRating:    rating,
        plannerComment:   comment?.trim() || null,
        plannerWouldHire: wouldHire ?? null,
      },
      create: {
        vendorId,
        eventId,
        plannerRating:    rating,
        plannerComment:   comment?.trim() || null,
        plannerWouldHire: wouldHire ?? null,
      },
    })

    return NextResponse.json({ feedback }, { status: 201 })
  } catch (err) {
    console.error("planner feedback POST error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; vendorId: string }> }
) {
  try {
    const { id: eventId, vendorId } = await params

    const feedback = await prisma.vendorFeedback.findUnique({
      where: { vendorId_eventId: { vendorId, eventId } },
    })

    return NextResponse.json({ feedback })
  } catch (err) {
    console.error("planner feedback GET error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}