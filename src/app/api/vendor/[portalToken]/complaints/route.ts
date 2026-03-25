// src/app/api/vendor/[portalToken]/complaints/route.ts
// GET  — vendor fetches complaints for their vendor record
// POST — vendor raises a complaint against the planner

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ portalToken: string }> }
) {
  try {
    const { portalToken } = await params

    const vendor = await prisma.vendor.findUnique({
      where:  { portalToken },
      select: { id: true },
    })

    if (!vendor) return NextResponse.json({ error: "Invalid token" }, { status: 404 })

    const complaints = await prisma.vendorComplaint.findMany({
      where:   { vendorId: vendor.id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ complaints })
  } catch (err) {
    console.error("vendor complaints GET error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

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

    const { category, description, evidenceUrl } = await req.json()

    if (!category || !description?.trim()) {
      return NextResponse.json({ error: "Category and description are required" }, { status: 400 })
    }

    const complaint = await prisma.vendorComplaint.create({
      data: {
        vendorId:    vendor.id,
        eventId:     vendor.event.id,
        raisedBy:    "VENDOR",
        category,
        description: description.trim(),
        evidenceUrl: evidenceUrl || null,
        status:      "OPEN",
      },
    })

    return NextResponse.json({ complaint }, { status: 201 })
  } catch (err) {
    console.error("vendor complaint POST error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}