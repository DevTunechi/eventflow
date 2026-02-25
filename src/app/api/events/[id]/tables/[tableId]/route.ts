// src/app/api/events/[id]/tables/[tableId]/route.ts

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth }   from "@/lib/auth-server"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; tableId: string }> }) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    const { id, tableId } = await params
    const planner = await prisma.user.findUnique({ where: { email: session.email }, select: { id: true } })
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })
    const event = await prisma.event.findFirst({ where: { id, plannerId: planner.id }, select: { id: true } })
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    await prisma.table.delete({ where: { id: tableId } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE table error:", err)
    return NextResponse.json({ error: "Failed to delete table" }, { status: 500 })
  }
}