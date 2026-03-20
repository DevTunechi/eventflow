// ─────────────────────────────────────────────
// FILE: src/app/api/vendor/[portalToken]/route.ts
//
// PUBLIC API — token is the auth mechanism.
//
// GET /api/vendor/[portalToken]
//   Returns vendor + event + stats + tallies.
//
// What's included:
//   - Vendor brief (arriveTime, arriveLocation,
//     instructions) — private to each vendor
//   - Caterer only: allVendorStaff array so
//     caterer knows how many crew plates to prep
//   - Expiry check — 410 after 24hrs post-event
//   - Food tallies (CATERER, excludes drinks)
//   - Drink tallies (DRINK_VENDOR only)
//   - Staff list + count vs cap
//   - Event timeline items
//   - Records lastAccessed timestamp
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getExpiryInfo } from "@/lib/event-expiry"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ portalToken: string }> }
) {
  try {
    const { portalToken } = await params

    // 1. Look up vendor with all fields the portal needs
    const vendor = await prisma.vendor.findUnique({
      where:  { portalToken },
      select: {
        id:                     true,
        name:                   true,
        contactName:            true,
        role:                   true,
        notes:                  true,
        // ── Vendor brief — private per vendor ──
        arriveTime:             true,
        arriveLocation:         true,
        instructions:           true,
        staffCount:             true,
        canOverrideCapacity:    true,
        capacityOverrideActive: true,
        eventId:                true,
        staff: {
          select: {
            id: true, name: true, phone: true,
            qrToken: true, checkedIn: true, checkedInAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        feedback: {
          select: { rating: true, message: true, submittedAt: true },
        },
        event: {
          select: {
            id: true, name: true, eventDate: true,
            startTime: true, endTime: true,
            venueName: true, venueAddress: true,
            status: true, invitationCard: true,
            planner: { select: { name: true, phone: true, email: true } },
            timeline: {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true, time: true, title: true,
                description: true, sortOrder: true,
              },
            },
          },
        },
      },
    })

    // 2. 404 if token invalid
    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found. This link may be invalid." },
        { status: 404 }
      )
    }

    // 3. Expiry check — 410 Gone after eventDate + 24hrs
    const expiry = getExpiryInfo(new Date(vendor.event.eventDate))
    if (expiry.isExpired) {
      return NextResponse.json(
        {
          error:     "This portal has expired.",
          eventName: vendor.event.name,
          expiredAt: expiry.expiresAt,
        },
        { status: 410 }
      )
    }

    // 4. Record portal access timestamp for planner visibility
    await prisma.vendor.update({
      where: { portalToken },
      data:  { lastAccessed: new Date() },
    })

    // 5. Live headcount stats — no guest names ever returned
    const [totalGuests, checkedIn] = await Promise.all([
      prisma.guest.count({
        where: { eventId: vendor.eventId, rsvpStatus: "CONFIRMED" },
      }),
      prisma.guest.count({
        where: { eventId: vendor.eventId, checkedIn: true },
      }),
    ])

    // 6. Food + drink tallies (aggregated, no guest info)
    let foodTallies:  TallyItem[] = []
    let drinkTallies: TallyItem[] = []

    const isCaterer     = vendor.role === "CATERER"
    const isDrinkVendor = vendor.role === "DRINK_VENDOR"

    if (isCaterer || isDrinkVendor) {
      const meals = await prisma.guestMeal.groupBy({
        by:      ["menuItemId"],
        where:   { guest: { eventId: vendor.eventId, rsvpStatus: "CONFIRMED" } },
        _sum:    { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
      })

      if (meals.length > 0) {
        const menuItems = await prisma.menuItem.findMany({
          where:  { id: { in: meals.map(m => m.menuItemId) } },
          select: { id: true, name: true, category: true },
        })
        const itemMap    = new Map(menuItems.map(i => [i.id, i]))
        const allTallies = meals
          .map(m => {
            const item = itemMap.get(m.menuItemId)
            if (!item) return null
            return {
              menuItemId:  m.menuItemId,
              name:        item.name,
              category:    item.category,
              totalOrders: m._sum.quantity ?? 0,
            }
          })
          .filter(Boolean) as TallyItem[]

        // Caterers see food only (not drinks)
        if (isCaterer)     foodTallies  = allTallies.filter(t => t.category !== "DRINK")
        // Drink vendors see drinks only
        if (isDrinkVendor) drinkTallies = allTallies.filter(t => t.category === "DRINK")
      }
    }

    // 7. CATERER ONLY: other vendor staff counts
    //    Caterer needs to know how many crew plates to prepare
    //    beyond the guest count. They see vendor name, role,
    //    and staffCount ONLY — never briefs or instructions.
    let allVendorStaff: VendorStaffCount[] = []

    if (isCaterer) {
      const otherVendors = await prisma.vendor.findMany({
        where: {
          eventId:    vendor.eventId,
          id:         { not: vendor.id }, // Exclude self
          staffCount: { gt: 0 },          // Only vendors with staff allocated
        },
        select: {
          name:       true,
          role:       true,
          staffCount: true,
          _count:     { select: { staff: true } }, // How many actually registered
        },
        orderBy: { role: "asc" },
      })

      allVendorStaff = otherVendors.map(v => ({
        name:            v.name,
        role:            v.role,
        staffAllotted:   v.staffCount ?? 0,
        staffRegistered: v._count.staff,
      }))
    }

    // 8. Return complete portal payload
    return NextResponse.json({
      vendor: {
        id:                     vendor.id,
        name:                   vendor.name,
        contactName:            vendor.contactName,
        role:                   vendor.role,
        notes:                  vendor.notes,
        // ── Brief fields ───────────────────────
        arriveTime:             vendor.arriveTime,
        arriveLocation:         vendor.arriveLocation,
        instructions:           vendor.instructions,
        // ── Staff ──────────────────────────────
        staffCount:             vendor.staffCount,
        staffRegistered:        vendor.staff.length,
        canOverrideCapacity:    vendor.canOverrideCapacity,
        capacityOverrideActive: vendor.capacityOverrideActive,
        staff:                  vendor.staff,
        existingFeedback:       vendor.feedback,
      },
      event: {
        ...vendor.event,
        plannerName:  vendor.event.planner.name,
        plannerPhone: vendor.event.planner.phone,
        plannerEmail: vendor.event.planner.email,
      },
      stats: {
        totalGuests,
        checkedIn,
        pending: totalGuests - checkedIn,
      },
      foodTallies,
      drinkTallies,
      allVendorStaff, // Non-empty only for CATERER role
      expiry,
    })
  } catch (err) {
    console.error("GET /api/vendor/[portalToken] error:", err)
    return NextResponse.json(
      { error: "Failed to load vendor portal" },
      { status: 500 }
    )
  }
}

// ── Internal types ────────────────────────────

interface TallyItem {
  menuItemId:  string
  name:        string
  category:    string
  totalOrders: number
}

interface VendorStaffCount {
  name:            string
  role:            string
  staffAllotted:   number
  staffRegistered: number
}