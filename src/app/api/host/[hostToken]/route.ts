// src/app/api/host/[hostToken]/route.ts
// GET — returns full event data for host portal

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ hostToken: string }> }
) {
  const { hostToken } = await params

  try {
    const event = await prisma.event.findUnique({
      where:  { hostToken },
      select: {
        id: true, name: true, eventDate: true, startTime: true,
        venueName: true, venueAddress: true, invitationCard: true,
        brandColor: true, status: true, venueCapacity: true,
        hostName: true,
        _count:     { select: { guests: true } },
        guestTiers: { select: { id: true, name: true, color: true } },
      },
    })

    if (!event) return NextResponse.json({ error: "Invalid host link" }, { status: 404 })

    // Guests
    const guests = await prisma.guest.findMany({
      where:   { eventId: event.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, firstName: true, lastName: true, phone: true,
        rsvpStatus: true, checkedIn: true, checkedInAt: true,
        tableNumber: true,
        tier:  { select: { name: true, color: true } },
        meals: { select: { menuItem: { select: { name: true } } } },
        gifts: { select: { amount: true, giftType: true, status: true } },
      },
    })

    // Gift records
    const gifts = await prisma.giftRecord.findMany({
      where:   { eventId: event.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, giftType: true, amount: true, status: true, createdAt: true,
        senderName: true,
        guest: { select: { firstName: true, lastName: true } },
      },
    })

    const giftsFormatted = gifts.map(g => ({
      id:         g.id,
      guestName:  g.guest ? `${g.guest.firstName} ${g.guest.lastName}` : null,
      senderName: g.senderName,
      giftType:   g.giftType,
      amount:     g.amount?.toString() ?? null,
      status:     g.status,
      createdAt:  g.createdAt.toISOString(),
    }))

    // Tributes
    const tributeRecords = await prisma.tribute.findMany({
      where:   { eventId: event.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, message: true, createdAt: true,
        guest: { select: { firstName: true, lastName: true } },
      },
    })

    const tributes = tributeRecords.map(t => ({
      id:        t.id,
      guestName: `${t.guest.firstName} ${t.guest.lastName}`,
      message:   t.message,
      createdAt: t.createdAt.toISOString(),
    }))

    return NextResponse.json({ event, guests, gifts: giftsFormatted, tributes })
  } catch (error) {
    console.error("host portal GET error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}