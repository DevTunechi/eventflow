// ─────────────────────────────────────────────
// src/app/api/events/[id]/guests/[guestId]/route.ts
//
// DELETE — remove a guest from the event
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-server"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; guestId: string } }
) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const planner = await prisma.user.findUnique({
      where: { email: session.email },
      select: { id: true },
    })
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })

    // Verify the event belongs to this planner
    const event = await prisma.event.findFirst({
      where: { id: params.id, plannerId: planner.id },
      select: { id: true },
    })
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    // Verify the guest belongs to this event
    const guest = await prisma.guest.findFirst({
      where: { id: params.guestId, eventId: params.id },
      select: { id: true },
    })
    if (!guest) return NextResponse.json({ error: "Guest not found" }, { status: 404 })

    await prisma.guest.delete({ where: { id: params.guestId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE guest error:", error)
    return NextResponse.json({ error: "Failed to delete guest" }, { status: 500 })
  }
}