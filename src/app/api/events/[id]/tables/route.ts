// src/app/api/events/[id]/tables/route.ts

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth }   from "@/lib/auth-server"

async function getPlanner(email: string) {
  return prisma.user.findUnique({ where: { email }, select: { id: true } })
}

async function checkEventOwner(eventId: string, plannerId: string) {
  return prisma.event.findFirst({ where: { id: eventId, plannerId }, select: { id: true } })
}

// GET /api/events/[id]/tables
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    const { id } = await params
    const planner = await getPlanner(session.email)
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })
    const event = await checkEventOwner(id, planner.id)
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const tables = await prisma.table.findMany({
      where:   { eventId: id },
      include: { reservedForTier: { select: { id: true, name: true, color: true } } },
      orderBy: { tableNumber: "asc" },
    })

    return NextResponse.json(tables)
  } catch (err) {
    console.error("GET tables error:", err)
    return NextResponse.json({ error: "Failed to load tables" }, { status: 500 })
  }
}

// POST /api/events/[id]/tables
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    const { id } = await params
    const planner = await getPlanner(session.email)
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })
    const event = await checkEventOwner(id, planner.id)
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const body = await req.json()
    const { tableNumber, label, capacity, reservedForTierId } = body

    if (!tableNumber) return NextResponse.json({ error: "Table number is required" }, { status: 400 })

    // Check for duplicate table number
    const existing = await prisma.table.findFirst({ where: { eventId: id, tableNumber: parseInt(tableNumber) } })
    if (existing) return NextResponse.json({ error: `Table ${tableNumber} already exists` }, { status: 409 })

    const table = await prisma.table.create({
      data: {
        eventId:           id,
        tableNumber:       parseInt(tableNumber),
        label:             label || null,
        capacity:          parseInt(capacity) || 10,
        reservedForTierId: reservedForTierId || null,
      },
      include: { reservedForTier: { select: { id: true, name: true, color: true } } },
    })

    return NextResponse.json({ table }, { status: 201 })
  } catch (err) {
    console.error("POST table error:", err)
    return NextResponse.json({ error: "Failed to add table" }, { status: 500 })
  }
}