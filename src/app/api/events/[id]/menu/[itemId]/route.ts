// src/app/api/events/[id]/menu/[itemId]/route.ts

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth }   from "@/lib/auth-server"

// PATCH /api/events/[id]/menu/[itemId]  — toggle availability
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    const { id, itemId } = await params
    const planner = await prisma.user.findUnique({ where: { email: session.email }, select: { id: true } })
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })
    const event = await prisma.event.findFirst({ where: { id, plannerId: planner.id }, select: { id: true } })
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const body = await req.json()
    const item = await prisma.menuItem.update({
      where: { id: itemId },
      data:  {
        ...(body.isAvailable !== undefined && { isAvailable: body.isAvailable }),
        ...(body.name        !== undefined && { name:        body.name.trim()  }),
        ...(body.description !== undefined && { description: body.description  }),
        ...(body.sortOrder   !== undefined && { sortOrder:   body.sortOrder    }),
      },
      include: { _count: { select: { guestMeals: true } } },
    })

    return NextResponse.json({ item })
  } catch (err) {
    console.error("PATCH menu item error:", err)
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 })
  }
}

// DELETE /api/events/[id]/menu/[itemId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    const { id, itemId } = await params
    const planner = await prisma.user.findUnique({ where: { email: session.email }, select: { id: true } })
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })
    const event = await prisma.event.findFirst({ where: { id, plannerId: planner.id }, select: { id: true } })
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    await prisma.menuItem.delete({ where: { id: itemId } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE menu item error:", err)
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 })
  }
}