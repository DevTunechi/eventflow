// src/app/api/events/[id]/vendors/[vendorId]/complaints/route.ts
// GET  — planner fetches all complaints for a vendor
// POST — planner raises a complaint against a vendor
// PATCH — planner responds to or resolves a complaint

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; vendorId: string }> }
) {
  try {
    const { id: eventId, vendorId } = await params

    const complaints = await prisma.vendorComplaint.findMany({
      where:   { vendorId, eventId },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ complaints })
  } catch (err) {
    console.error("planner complaints GET error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; vendorId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const { id: eventId, vendorId } = await params
    const { category, description, evidenceUrl } = await req.json()

    if (!category || !description?.trim()) {
      return NextResponse.json({ error: "Category and description are required" }, { status: 400 })
    }

    const complaint = await prisma.vendorComplaint.create({
      data: {
        vendorId,
        eventId,
        raisedBy:    "PLANNER",
        category,
        description: description.trim(),
        evidenceUrl: evidenceUrl || null,
        status:      "OPEN",
      },
    })

    return NextResponse.json({ complaint }, { status: 201 })
  } catch (err) {
    console.error("planner complaint POST error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; vendorId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const { id: eventId, vendorId } = await params
    const { complaintId, status, response } = await req.json()

    if (!complaintId) return NextResponse.json({ error: "complaintId required" }, { status: 400 })

    const updated = await prisma.vendorComplaint.update({
      where: { id: complaintId },
      data: {
        status:     status || undefined,
        response:   response?.trim() || undefined,
        resolvedAt: status === "RESOLVED" ? new Date() : undefined,
      },
    })

    return NextResponse.json({ complaint: updated })
  } catch (err) {
    console.error("planner complaint PATCH error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}