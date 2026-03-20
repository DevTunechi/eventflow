// ─────────────────────────────────────────────
// FILE: src/app/api/vendor/[portalToken]/staff/route.ts
//
// PUBLIC API — token is the auth mechanism.
//
// GET /api/vendor/[portalToken]/staff
//   Returns all staff registered by this vendor.
//
// POST /api/vendor/[portalToken]/staff
//   Body: { name: string, phone?: string }
//   Adds a new staff member.
//   Enforces cap: rejects if staff.length >= staffCount.
//
// DELETE /api/vendor/[portalToken]/staff?staffId=[id]
//   Removes a staff member (before event only).
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isPortalExpired } from "@/lib/event-expiry"

// ── Shared lookup ─────────────────────────────

async function getVendorWithEvent(portalToken: string) {
  return prisma.vendor.findUnique({
    where:  { portalToken },
    select: {
      id:         true,
      eventId:    true,
      staffCount: true,
      _count:     { select: { staff: true } },
      event:      { select: { eventDate: true } },
    },
  })
}

// ── GET — list staff ──────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ portalToken: string }> }
) {
  try {
    const { portalToken } = await params
    const vendor = await getVendorWithEvent(portalToken)
    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 })

    const staff = await prisma.vendorStaff.findMany({
      where:   { vendorId: vendor.id },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({ staff })
  } catch (err) {
    console.error("GET vendor staff error:", err)
    return NextResponse.json({ error: "Failed to load staff" }, { status: 500 })
  }
}

// ── POST — add staff member ───────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ portalToken: string }> }
) {
  try {
    const { portalToken } = await params
    const vendor = await getVendorWithEvent(portalToken)
    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 })

    // Block registration after portal expires
    if (isPortalExpired(new Date(vendor.event.eventDate))) {
      return NextResponse.json(
        { error: "This portal has expired. Staff registration is closed." },
        { status: 410 }
      )
    }

    // Enforce staffCount cap set by planner
    const currentCount = vendor._count.staff
    const cap          = vendor.staffCount ?? 0

    if (cap === 0) {
      return NextResponse.json(
        { error: "No staff slots have been allocated for this vendor. Contact the event planner." },
        { status: 403 }
      )
    }

    if (currentCount >= cap) {
      return NextResponse.json(
        { error: `Staff limit reached. You can register a maximum of ${cap} staff members.` },
        { status: 403 }
      )
    }

    const { name, phone } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: "Staff name is required." }, { status: 400 })
    }

    const staff = await prisma.vendorStaff.create({
      data: {
        vendorId: vendor.id,
        eventId:  vendor.eventId,
        name:     name.trim(),
        phone:    phone?.trim() || null,
        // qrToken is auto-generated as @default(cuid())
      },
    })

    return NextResponse.json({ staff }, { status: 201 })
  } catch (err) {
    console.error("POST vendor staff error:", err)
    return NextResponse.json({ error: "Failed to add staff member" }, { status: 500 })
  }
}

// ── DELETE — remove staff member ─────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ portalToken: string }> }
) {
  try {
    const { portalToken } = await params
    const { searchParams } = new URL(req.url)
    const staffId = searchParams.get("staffId")

    if (!staffId) {
      return NextResponse.json({ error: "staffId is required" }, { status: 400 })
    }

    const vendor = await getVendorWithEvent(portalToken)
    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 })

    // Confirm this staff member belongs to this vendor
    const member = await prisma.vendorStaff.findFirst({
      where: { id: staffId, vendorId: vendor.id },
    })
    if (!member) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
    }

    // Prevent removing staff who have already checked in
    if (member.checkedIn) {
      return NextResponse.json(
        { error: "Cannot remove a staff member who has already checked in." },
        { status: 403 }
      )
    }

    await prisma.vendorStaff.delete({ where: { id: staffId } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE vendor staff error:", err)
    return NextResponse.json({ error: "Failed to remove staff member" }, { status: 500 })
  }
}