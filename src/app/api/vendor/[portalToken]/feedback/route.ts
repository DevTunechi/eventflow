// src/app/api/vendor/[portalToken]/feedback/route.ts
// POST — vendor submits feedback to planner
//        (planner feedback submitted via dashboard API)
// Already exists for star rating — this extends it
// to include the planner→vendor direction too.

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ portalToken: string }> }
) {
  try {
    const { portalToken } = await params

    const vendor = await prisma.vendor.findUnique({
      where:  { portalToken },
      select: { id: true, event: { select: { id: true } } },
    })

    if (!vendor) return NextResponse.json({ error: "Invalid token" }, { status: 404 })

    const { rating, message, wouldWork } = await req.json()

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be 1–5" }, { status: 400 })
    }

    const feedback = await prisma.vendorFeedback.upsert({
      where:  { vendorId_eventId: { vendorId: vendor.id, eventId: vendor.event.id } },
      update: {
        vendorRating:    rating,
        vendorComment:   message?.trim() || null,
        vendorWouldWork: wouldWork ?? null,
      },
      create: {
        vendorId:        vendor.id,
        eventId:         vendor.event.id,
        vendorRating:    rating,
        vendorComment:   message?.trim() || null,
        vendorWouldWork: wouldWork ?? null,
      },
    })

    return NextResponse.json({ feedback }, { status: 201 })
  } catch (err) {
    console.error("vendor feedback POST error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ portalToken: string }> }
) {
  try {
    const { portalToken } = await params

    const vendor = await prisma.vendor.findUnique({
      where:  { portalToken },
      select: { id: true, event: { select: { id: true } } },
    })

    if (!vendor) return NextResponse.json({ error: "Invalid token" }, { status: 404 })

    const feedback = await prisma.vendorFeedback.findUnique({
      where: { vendorId_eventId: { vendorId: vendor.id, eventId: vendor.event.id } },
    })

    return NextResponse.json({ feedback })
  } catch (err) {
    console.error("vendor feedback GET error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}