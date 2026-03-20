// ─────────────────────────────────────────────
// FILE: src/app/api/events/[id]/vendors/[vendorId]/route.ts
//
// AUTHENTICATED — planner only.
//
// PATCH  /api/events/[id]/vendors/[vendorId]
//   Updates any vendor field including the brief:
//   arriveTime, arriveLocation, instructions
//
// DELETE /api/events/[id]/vendors/[vendorId]
//   Removes the vendor from the event.
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth }   from "@/lib/auth-server"

// ── Shared helpers ────────────────────────────

async function getPlanner(email: string) {
  return prisma.user.findUnique({
    where:  { email },
    select: { id: true },
  })
}

async function checkEventOwner(eventId: string, plannerId: string) {
  return prisma.event.findFirst({
    where:  { id: eventId, plannerId },
    select: { id: true },
  })
}

async function checkVendorOwner(vendorId: string, eventId: string) {
  return prisma.vendor.findFirst({
    where:  { id: vendorId, eventId },
    select: { id: true },
  })
}

// ── PATCH — update vendor ─────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; vendorId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const { id: eventId, vendorId } = await params

    const planner = await getPlanner(session.email)
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const event = await checkEventOwner(eventId, planner.id)
    if (!event)  return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const vendor = await checkVendorOwner(vendorId, eventId)
    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 })

    const body = await req.json()

    const {
      name, contactName, email, phone, role,
      notes, staffCount, canOverrideCapacity,
      // ── Brief fields ────────────────────────
      arriveTime, arriveLocation, instructions,
    } = body

    if (name !== undefined && !name?.trim()) {
      return NextResponse.json({ error: "Vendor name cannot be empty" }, { status: 400 })
    }

    const updated = await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        // Only update fields that were sent — undefined fields are left unchanged
        ...(name               !== undefined && { name:                name.trim() }),
        ...(contactName        !== undefined && { contactName:         contactName?.trim() || null }),
        ...(email              !== undefined && { email:               email?.trim()       || null }),
        ...(phone              !== undefined && { phone:               phone?.trim()       || null }),
        ...(role               !== undefined && { role }),
        ...(notes              !== undefined && { notes:               notes?.trim()       || null }),
        ...(staffCount         !== undefined && { staffCount:          staffCount != null ? Number(staffCount) : null }),
        ...(canOverrideCapacity !== undefined && { canOverrideCapacity }),
        // ── Brief fields ──────────────────────
        ...(arriveTime     !== undefined && { arriveTime:     arriveTime?.trim()     || null }),
        ...(arriveLocation !== undefined && { arriveLocation: arriveLocation?.trim() || null }),
        ...(instructions   !== undefined && { instructions:   instructions?.trim()   || null }),
      },
    })

    return NextResponse.json({ vendor: updated })
  } catch (err) {
    console.error("PATCH vendor error:", err)
    return NextResponse.json({ error: "Failed to update vendor" }, { status: 500 })
  }
}

// ── DELETE — remove vendor ────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; vendorId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const { id: eventId, vendorId } = await params

    const planner = await getPlanner(session.email)
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const event = await checkEventOwner(eventId, planner.id)
    if (!event)  return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const vendor = await checkVendorOwner(vendorId, eventId)
    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 })

    await prisma.vendor.delete({ where: { id: vendorId } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE vendor error:", err)
    return NextResponse.json({ error: "Failed to delete vendor" }, { status: 500 })
  }
}