// ─────────────────────────────────────────────
// src/app/api/events/[id]/guests/import/route.ts
//
// POST — bulk import guests from CSV or
//        Google Sheets parsed data.
//
// Skips duplicates (same phone or same
// first+last name combo on the same event).
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-server"

interface GuestRow {
  firstName: string
  lastName:  string
  phone?:    string
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const planner = await prisma.user.findUnique({
      where: { email: session.email },
      select: { id: true },
    })
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const event = await prisma.event.findFirst({
      where: { id, plannerId: planner.id },
      select: { id: true, inviteModel: true },
    })
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const body = await req.json()
    const rows: GuestRow[] = body.guests ?? []

    if (!rows.length) return NextResponse.json({ error: "No guests provided" }, { status: 400 })
    if (rows.length > 200) return NextResponse.json({ error: "Maximum 200 guests per import" }, { status: 400 })

    // Load existing guests to skip duplicates
    const existing = await prisma.guest.findMany({
      where:  { eventId: id },
      select: { firstName: true, lastName: true, phone: true },
    })

    const existingKeys = new Set(
      existing.map(g => `${g.firstName.toLowerCase()}|${g.lastName.toLowerCase()}`)
    )
    const existingPhones = new Set(
      existing.filter(g => g.phone).map(g => g.phone!)
    )

    // Filter out duplicates
    const toCreate = rows.filter(r => {
      if (!r.firstName?.trim() || !r.lastName?.trim()) return false
      const key = `${r.firstName.trim().toLowerCase()}|${r.lastName.trim().toLowerCase()}`
      if (existingKeys.has(key)) return false
      if (r.phone?.trim() && existingPhones.has(r.phone.trim())) return false
      return true
    })

    if (!toCreate.length) {
      return NextResponse.json({ imported: 0, skipped: rows.length, message: "All guests already exist" })
    }

    // Batch create
    await prisma.guest.createMany({
      data: toCreate.map(r => ({
        eventId:      id,
        firstName:    r.firstName.trim(),
        lastName:     r.lastName.trim(),
        phone:        r.phone?.trim() || null,
        inviteToken:  event.inviteModel === "CLOSED"
          ? `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
          : null,
        inviteChannel: "MANUAL" as const,
        rsvpStatus:   "PENDING" as const,
      })),
      skipDuplicates: true,
    })

    return NextResponse.json({
      imported: toCreate.length,
      skipped:  rows.length - toCreate.length,
    })
  } catch (error) {
    console.error("Import guests error:", error)
    return NextResponse.json({ error: "Import failed" }, { status: 500 })
  }
}