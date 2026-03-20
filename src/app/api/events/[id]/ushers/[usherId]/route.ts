// ─────────────────────────────────────────────
// FILE: src/app/api/events/[id]/ushers/[usherId]/route.ts
//
// Authenticated — planner only.
// Handles edit and delete for a single usher.
//
// PATCH  /api/events/[id]/ushers/[usherId] — update name, phone, role, isActive
// DELETE /api/events/[id]/ushers/[usherId] — remove usher from event
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth }   from "@/lib/auth-server"

async function getPlanner(email: string) {
  return prisma.user.findUnique({ where: { email }, select: { id: true } })
}

async function checkEventOwner(eventId: string, plannerId: string) {
  return prisma.event.findFirst({ where: { id: eventId, plannerId }, select: { id: true } })
}

// Verify the usher belongs to this event
async function checkUsherOwner(usherId: string, eventId: string) {
  return prisma.usher.findFirst({ where: { id: usherId, eventId }, select: { id: true } })
}

// ── PATCH — update usher ──────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; usherId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const { id: eventId, usherId } = await params

    const planner = await getPlanner(session.email)
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const event = await checkEventOwner(eventId, planner.id)
    if (!event)  return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const usher = await checkUsherOwner(usherId, eventId)
    if (!usher)  return NextResponse.json({ error: "Usher not found" }, { status: 404 })

    const { name, phone, role, isActive } = await req.json()

    if (name !== undefined && !name?.trim()) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 })
    }

    const updated = await prisma.usher.update({
      where: { id: usherId },
      data: {
        ...(name     !== undefined && { name:     name.trim() }),
        ...(phone    !== undefined && { phone:    phone?.trim() || null }),
        ...(role     !== undefined && { role }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({ usher: updated })
  } catch (err) {
    console.error("PATCH usher error:", err)
    return NextResponse.json({ error: "Failed to update usher" }, { status: 500 })
  }
}

// ── DELETE — remove usher ─────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; usherId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const { id: eventId, usherId } = await params

    const planner = await getPlanner(session.email)
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const event = await checkEventOwner(eventId, planner.id)
    if (!event)  return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const usher = await checkUsherOwner(usherId, eventId)
    if (!usher)  return NextResponse.json({ error: "Usher not found" }, { status: 404 })

    await prisma.usher.delete({ where: { id: usherId } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE usher error:", err)
    return NextResponse.json({ error: "Failed to delete usher" }, { status: 500 })
  }
}