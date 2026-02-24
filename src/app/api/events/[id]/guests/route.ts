// ─────────────────────────────────────────────
// src/app/api/events/[id]/guests/route.ts
//
// GET  — list all guests for the event
// POST — add a single guest manually
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-server"

// ── Helpers ───────────────────────────────────

async function getPlanner() {
  const session = await auth()
  if (!session?.email) return null
  return prisma.user.findUnique({ where: { email: session.email }, select: { id: true } })
}

async function verifyEventOwner(eventId: string, plannerId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, plannerId },
    select: { id: true, inviteModel: true, name: true, slug: true },
  })
}

// ── GET /api/events/[id]/guests ───────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const planner = await getPlanner()
    if (!planner) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const event = await verifyEventOwner(id, planner.id)
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const guests = await prisma.guest.findMany({
      where:   { eventId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id:           true,
        firstName:    true,
        lastName:     true,
        phone:        true,
        email:        true,
        rsvpStatus:   true,
        rsvpAt:       true,
        checkedIn:    true,
        checkedInAt:  true,
        inviteSentAt: true,
        isFlagged:    true,
        tableNumber:  true,
        createdAt:    true,
        tier: {
          select: { id: true, name: true, color: true }
        },
      },
    })

    return NextResponse.json(guests)
  } catch (error) {
    console.error("GET guests error:", error)
    return NextResponse.json({ error: "Failed to fetch guests" }, { status: 500 })
  }
}

// ── POST /api/events/[id]/guests ──────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const planner = await getPlanner()
    if (!planner) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const event = await verifyEventOwner(id, planner.id)
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const body = await req.json()
    const { firstName, lastName, phone, tierId } = body

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: "First name and last name are required" }, { status: 400 })
    }

    // For closed invites, generate a unique invite token
    const inviteToken = event.inviteModel === "CLOSED"
      ? `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
      : null

    const guest = await prisma.guest.create({
      data: {
        eventId:      id,
        firstName:    firstName.trim(),
        lastName:     lastName.trim(),
        phone:        phone?.trim() || null,
        tierId:       tierId || null,
        inviteToken,
        inviteChannel: "MANUAL",
        rsvpStatus:   "PENDING",
      },
      select: {
        id:           true,
        firstName:    true,
        lastName:     true,
        phone:        true,
        email:        true,
        rsvpStatus:   true,
        rsvpAt:       true,
        checkedIn:    true,
        checkedInAt:  true,
        inviteSentAt: true,
        isFlagged:    true,
        tableNumber:  true,
        createdAt:    true,
        tier: {
          select: { id: true, name: true, color: true }
        },
      },
    })

    return NextResponse.json({ guest }, { status: 201 })
  } catch (error) {
    console.error("POST guest error:", error)
    return NextResponse.json({ error: "Failed to add guest" }, { status: 500 })
  }
}