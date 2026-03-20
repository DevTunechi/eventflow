// ─────────────────────────────────────────────
// FILE: src/app/api/events/[id]/timeline/route.ts
//
// AUTHENTICATED — planner only.
// Manages the structured event schedule that
// all vendors can see on their portal.
//
// GET    /api/events/[id]/timeline         — list all items
// POST   /api/events/[id]/timeline         — create item
// PATCH  /api/events/[id]/timeline?itemId= — update item
// DELETE /api/events/[id]/timeline?itemId= — delete item
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth }   from "@/lib/auth-server"

// ── Shared auth helpers ───────────────────────

async function getPlanner(email: string) {
  return prisma.user.findUnique({ where: { email }, select: { id: true } })
}

async function checkEventOwner(eventId: string, plannerId: string) {
  return prisma.event.findFirst({
    where:  { id: eventId, plannerId },
    select: { id: true },
  })
}

// ── GET — list timeline ───────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const { id: eventId } = await params
    const planner = await getPlanner(session.email)
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const event = await checkEventOwner(eventId, planner.id)
    if (!event)  return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const items = await prisma.eventTimeline.findMany({
      where:   { eventId },
      orderBy: { sortOrder: "asc" },
    })

    return NextResponse.json(items)
  } catch (err) {
    console.error("GET timeline error:", err)
    return NextResponse.json({ error: "Failed to load timeline" }, { status: 500 })
  }
}

// ── POST — add timeline item ──────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const { id: eventId } = await params
    const planner = await getPlanner(session.email)
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const event = await checkEventOwner(eventId, planner.id)
    if (!event)  return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const { time, title, description, sortOrder } = await req.json()

    if (!time?.trim())  return NextResponse.json({ error: "Time is required" },  { status: 400 })
    if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 })

    // Default sortOrder to end of list
    const lastItem = await prisma.eventTimeline.findFirst({
      where:   { eventId },
      orderBy: { sortOrder: "desc" },
      select:  { sortOrder: true },
    })

    const item = await prisma.eventTimeline.create({
      data: {
        eventId,
        time:        time.trim(),
        title:       title.trim(),
        description: description?.trim() || null,
        sortOrder:   sortOrder ?? (lastItem ? lastItem.sortOrder + 1 : 0),
      },
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (err) {
    console.error("POST timeline error:", err)
    return NextResponse.json({ error: "Failed to add timeline item" }, { status: 500 })
  }
}

// ── PATCH — update timeline item ─────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const { id: eventId } = await params
    const { searchParams } = new URL(req.url)
    const itemId = searchParams.get("itemId")

    if (!itemId) return NextResponse.json({ error: "itemId is required" }, { status: 400 })

    const planner = await getPlanner(session.email)
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const event = await checkEventOwner(eventId, planner.id)
    if (!event)  return NextResponse.json({ error: "Event not found" }, { status: 404 })

    // Confirm item belongs to this event
    const existing = await prisma.eventTimeline.findFirst({
      where: { id: itemId, eventId },
    })
    if (!existing) return NextResponse.json({ error: "Timeline item not found" }, { status: 404 })

    const { time, title, description, sortOrder } = await req.json()

    const updated = await prisma.eventTimeline.update({
      where: { id: itemId },
      data: {
        ...(time        !== undefined && { time:        time?.trim() }),
        ...(title       !== undefined && { title:       title?.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(sortOrder   !== undefined && { sortOrder }),
      },
    })

    return NextResponse.json({ item: updated })
  } catch (err) {
    console.error("PATCH timeline error:", err)
    return NextResponse.json({ error: "Failed to update timeline item" }, { status: 500 })
  }
}

// ── DELETE — remove timeline item ────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const { id: eventId } = await params
    const { searchParams } = new URL(req.url)
    const itemId = searchParams.get("itemId")

    if (!itemId) return NextResponse.json({ error: "itemId is required" }, { status: 400 })

    const planner = await getPlanner(session.email)
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const event = await checkEventOwner(eventId, planner.id)
    if (!event)  return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const existing = await prisma.eventTimeline.findFirst({
      where: { id: itemId, eventId },
    })
    if (!existing) return NextResponse.json({ error: "Timeline item not found" }, { status: 404 })

    await prisma.eventTimeline.delete({ where: { id: itemId } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE timeline error:", err)
    return NextResponse.json({ error: "Failed to delete timeline item" }, { status: 500 })
  }
}