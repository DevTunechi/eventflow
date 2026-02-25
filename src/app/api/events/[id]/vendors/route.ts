// src/app/api/events/[id]/vendors/route.ts

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth }   from "@/lib/auth-server"

async function getPlanner(email: string) {
  return prisma.user.findUnique({ where: { email }, select: { id: true } })
}

async function checkEventOwner(eventId: string, plannerId: string) {
  return prisma.event.findFirst({ where: { id: eventId, plannerId }, select: { id: true } })
}

// GET /api/events/[id]/vendors
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    const { id } = await params
    const planner = await getPlanner(session.email)
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })
    const event = await checkEventOwner(id, planner.id)
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const vendors = await prisma.vendor.findMany({
      where:   { eventId: id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(vendors)
  } catch (err) {
    console.error("GET vendors error:", err)
    return NextResponse.json({ error: "Failed to load vendors" }, { status: 500 })
  }
}

// POST /api/events/[id]/vendors
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
    const { name, contactName, email, phone, role, notes, canOverrideCapacity } = body

    if (!name?.trim()) return NextResponse.json({ error: "Vendor name is required" }, { status: 400 })

    const vendor = await prisma.vendor.create({
      data: {
        eventId:             id,
        name:                name.trim(),
        contactName:         contactName?.trim() || null,
        email:               email?.trim()       || null,
        phone:               phone?.trim()       || null,
        role:                role ?? "OTHER",
        notes:               notes?.trim()       || null,
        canOverrideCapacity: canOverrideCapacity ?? false,
      },
    })

    return NextResponse.json({ vendor }, { status: 201 })
  } catch (err) {
    console.error("POST vendor error:", err)
    return NextResponse.json({ error: "Failed to add vendor" }, { status: 500 })
  }
}