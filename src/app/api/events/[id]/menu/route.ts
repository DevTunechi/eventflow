// src/app/api/events/[id]/menu/route.ts

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth }   from "@/lib/auth-server"

async function getPlanner(email: string) {
  return prisma.user.findUnique({ where: { email }, select: { id: true } })
}

async function checkEventOwner(eventId: string, plannerId: string) {
  return prisma.event.findFirst({ where: { id: eventId, plannerId }, select: { id: true } })
}

// GET /api/events/[id]/menu
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    const { id } = await params
    const planner = await getPlanner(session.email)
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })
    const event = await checkEventOwner(id, planner.id)
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const items = await prisma.menuItem.findMany({
      where:   { eventId: id },
      include: { _count: { select: { guestMeals: true } } },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    })

    return NextResponse.json(items)
  } catch (err) {
    console.error("GET menu error:", err)
    return NextResponse.json({ error: "Failed to load menu" }, { status: 500 })
  }
}

// POST /api/events/[id]/menu
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
    const { category, name, description } = body

    if (!name?.trim()) return NextResponse.json({ error: "Item name is required" }, { status: 400 })

    // Auto-increment sortOrder within category
    const last = await prisma.menuItem.findFirst({
      where:   { eventId: id, category },
      orderBy: { sortOrder: "desc" },
      select:  { sortOrder: true },
    })

    const item = await prisma.menuItem.create({
      data: {
        eventId:     id,
        category:    category ?? "MAIN",
        name:        name.trim(),
        description: description?.trim() || null,
        sortOrder:   (last?.sortOrder ?? 0) + 1,
      },
      include: { _count: { select: { guestMeals: true } } },
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (err) {
    console.error("POST menu item error:", err)
    return NextResponse.json({ error: "Failed to add menu item" }, { status: 500 })
  }
}