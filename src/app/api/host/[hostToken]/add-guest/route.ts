// src/app/api/host/[hostToken]/add-guest/route.ts
// POST — host adds a guest (only if under capacity)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ hostToken: string }> }
) {
  const { hostToken } = await params

  try {
    const event = await prisma.event.findUnique({
      where:  { hostToken },
      select: { id: true, venueCapacity: true, _count: { select: { guests: true } } },
    })

    if (!event) return NextResponse.json({ error: "Invalid host link" }, { status: 404 })

    if (event.venueCapacity && event._count.guests >= event.venueCapacity) {
      return NextResponse.json({ error: "Event is at full capacity" }, { status: 409 })
    }

    const { firstName, lastName, phone, email } = await req.json()
    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }
    if (!phone?.trim() && !email?.trim()) {
      return NextResponse.json({ error: "Please provide at least a phone number or email address" }, { status: 400 })
    }

    const token = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`

    const guest = await prisma.guest.create({
      data: {
        eventId:      event.id,
        firstName:    firstName.trim(),
        lastName:     lastName.trim(),
        phone:        phone?.trim()  || null,
        email:        email?.trim()  || null,
        rsvpStatus:   "CONFIRMED",
        inviteChannel:"MANUAL",
        qrCode:       token,
      },
      select: {
        id: true, firstName: true, lastName: true, phone: true, email: true,
        rsvpStatus: true, checkedIn: true, checkedInAt: true,
        tableNumber: true, isPrivate: true,
        tier:  { select: { name: true, color: true } },
        meals: { select: { menuItem: { select: { name: true } } } },
        gifts: { select: { amount: true, giftType: true, status: true } },
      },
    })

    return NextResponse.json({ guest }, { status: 201 })
  } catch (error) {
    console.error("host add-guest error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}