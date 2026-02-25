// src/app/api/events/[id]/ushers/route.ts

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth }   from "@/lib/auth-server"

async function getPlanner(email: string) {
  return prisma.user.findUnique({ where: { email }, select: { id: true } })
}

async function checkEventOwner(eventId: string, plannerId: string) {
  return prisma.event.findFirst({ where: { id: eventId, plannerId }, select: { id: true } })
}

// GET /api/events/[id]/ushers
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    const { id } = await params
    const planner = await getPlanner(session.email)
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })
    const event = await checkEventOwner(id, planner.id)
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const ushers = await prisma.usher.findMany({
      where:   { eventId: id },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    })

    return NextResponse.json(ushers)
  } catch (err) {
    console.error("GET ushers error:", err)
    return NextResponse.json({ error: "Failed to load ushers" }, { status: 500 })
  }
}

// POST /api/events/[id]/ushers
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
    const { name, phone, role } = body

    if (!name?.trim()) return NextResponse.json({ error: "Usher name is required" }, { status: 400 })

    const usher = await prisma.usher.create({
      data: {
        eventId: id,
        name:    name.trim(),
        phone:   phone?.trim() || null,
        role:    role ?? "FLOOR",
      },
    })

    return NextResponse.json({ usher }, { status: 201 })
  } catch (err) {
    console.error("POST usher error:", err)
    return NextResponse.json({ error: "Failed to add usher" }, { status: 500 })
  }
}