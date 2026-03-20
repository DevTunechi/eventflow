// src/app/api/host/[hostToken]/route.ts
// GET — returns full event data for host portal
//
// Added vs previous version:
//   - venueLat, venueLng, venueMapUrl for maps link
//   - rsvpDeadline so portal can show "RSVP closes" info
//   - isPrivate on each guest
//   - vendor portal status (name, role, lastAccessed)
//   - meal tallies (grouped counts per menu item)
//   - tier breakdown (guest count per tier)

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
        hostName: true, rsvpDeadline: true,
        // Map fields
        venueLat: true, venueLng: true, venueMapUrl: true,
        _count:     { select: { guests: true } },
        guestTiers: { select: { id: true, name: true, color: true } },
      },
    })

    if (!event) return NextResponse.json({ error: "Invalid host link" }, { status: 404 })

    // ── Guests ────────────────────────────────────────────────
    const guests = await prisma.guest.findMany({
      where:   { eventId: event.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, firstName: true, lastName: true, phone: true,
        rsvpStatus: true, checkedIn: true, checkedInAt: true,
        tableNumber: true,
        tier:  { select: { name: true, color: true } },
        meals: { select: { menuItem: { select: { name: true, category: true } } } },
        gifts: { select: { amount: true, giftType: true, status: true } },
      },
    })

    // ── Gift records ──────────────────────────────────────────
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

    // ── Tributes ──────────────────────────────────────────────
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

    // ── Vendor portal status ──────────────────────────────────
    // Host sees which vendors have accessed their portal link
    const vendors = await prisma.vendor.findMany({
      where:   { eventId: event.id },
      orderBy: { role: "asc" },
      select: {
        id: true, name: true, role: true,
        lastAccessed: true, portalToken: true,
        staffCount: true,
        _count: { select: { staff: true } },
      },
    })

    const vendorStatus = vendors.map(v => ({
      id:              v.id,
      name:            v.name,
      role:            v.role,
      portalToken:     v.portalToken,
      lastAccessed:    v.lastAccessed?.toISOString() ?? null,
      staffCount:      v.staffCount,
      staffRegistered: v._count.staff,
    }))

    // ── Meal tallies ──────────────────────────────────────────
    // Grouped counts per menu item across all confirmed guests
    const mealGroups = await prisma.guestMeal.groupBy({
      by:    ["menuItemId"],
      where: { guest: { eventId: event.id, rsvpStatus: "CONFIRMED" } },
      _sum:  { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
    })

    let mealTallies: { name: string; category: string; total: number }[] = []
    if (mealGroups.length > 0) {
      const menuItems = await prisma.menuItem.findMany({
        where:  { id: { in: mealGroups.map(m => m.menuItemId) } },
        select: { id: true, name: true, category: true },
      })
      const itemMap = new Map(menuItems.map(i => [i.id, i]))
      mealTallies = mealGroups
        .map(m => {
          const item = itemMap.get(m.menuItemId)
          if (!item) return null
          return { name: item.name, category: item.category, total: m._sum.quantity ?? 0 }
        })
        .filter(Boolean) as { name: string; category: string; total: number }[]
    }

    // ── Tier breakdown ────────────────────────────────────────
    // Guest count per tier for the overview
    const tierCounts = event.guestTiers.map(tier => ({
      id:    tier.id,
      name:  tier.name,
      color: tier.color,
      count: guests.filter(g => g.tier?.name === tier.name).length,
    }))

    return NextResponse.json({
      event,
      guests,
      gifts:        giftsFormatted,
      tributes,
      vendorStatus,
      mealTallies,
      tierCounts,
    })
  } catch (error) {
    console.error("host portal GET error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}