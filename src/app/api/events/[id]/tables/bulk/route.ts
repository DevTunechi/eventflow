// src/app/api/events/[id]/tables/bulk/route.ts

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth }   from "@/lib/auth-server"

// POST /api/events/[id]/tables/bulk
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    const { id } = await params
    const planner = await prisma.user.findUnique({ where: { email: session.email }, select: { id: true } })
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })
    const event = await prisma.event.findFirst({ where: { id, plannerId: planner.id }, select: { id: true } })
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const { count, seatsPerTable = 10 } = await req.json()
    if (!count || count < 1 || count > 100) {
      return NextResponse.json({ error: "Count must be between 1 and 100" }, { status: 400 })
    }

    // Find the highest existing table number
    const last = await prisma.table.findFirst({
      where:   { eventId: id },
      orderBy: { tableNumber: "desc" },
      select:  { tableNumber: true },
    })
    const startFrom = (last?.tableNumber ?? 0) + 1

    const data = Array.from({ length: count }, (_, i) => ({
      eventId:     id,
      tableNumber: startFrom + i,
      capacity:    seatsPerTable,
    }))

    await prisma.table.createMany({ data })

    return NextResponse.json({ created: count, startFrom })
  } catch (err) {
    console.error("POST tables/bulk error:", err)
    return NextResponse.json({ error: "Failed to create tables" }, { status: 500 })
  }
}