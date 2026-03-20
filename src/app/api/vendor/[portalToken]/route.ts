// ─────────────────────────────────────────────
// FILE: src/app/api/vendor/[portalToken]/route.ts
//
// PUBLIC API — no authentication required.
// Token is the authentication mechanism.
//
// GET /api/vendor/[portalToken]
//   Returns vendor + event + stats + tallies.
//   Includes expiry info so the portal page
//   can show the correct screen.
//
// Changes from previous version:
//   - Adds expiry check via getExpiryInfo()
//   - Returns 410 Gone after 24hrs post-event
//   - Adds drink tallies for DRINK_VENDOR role
//   - Returns staff list + count vs cap
//   - Returns event timeline items
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

    // 1. Look up vendor and include everything the portal needs
    const vendor = await prisma.vendor.findUnique({
      where:  { portalToken },
      select: {
        id:                     true,
        name:                   true,
        contactName:            true,
        role:                   true,
        notes:                  true,
        staffCount:             true,
        canOverrideCapacity:    true,
        capacityOverrideActive: true,
        eventId:                true,
        // Staff registered by this vendor
        staff: {
          select: {
            id:         true,
            name:       true,
            phone:      true,
            qrToken:    true,
            checkedIn:  true,
            checkedInAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        // Existing feedback if vendor already submitted
        feedback: {
          select: { rating: true, message: true, submittedAt: true },
        },
        event: {
          select: {
            id:             true,
            name:           true,
            eventDate:      true,
            startTime:      true,
            endTime:        true,
            venueName:      true,
            venueAddress:   true,
            status:         true,
            invitationCard: true,
            // Planner contact for vendor reference
            planner: {
              select: { name: true, phone: true, email: true },
            },
            // Structured schedule visible to all vendors
            timeline: {
              orderBy: { sortOrder: "asc" },
              select: {
                id:          true,
                time:        true,
                title:       true,
                description: true,
                sortOrder:   true,
              },
            },
          },
        },
      },
    })

    // 2. 404 if token is invalid
    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found. This link may be invalid." },
        { status: 404 }
      )
    }

    // 3. Check expiry — returns 410 Gone after 24hrs post-event
    const expiry = getExpiryInfo(new Date(vendor.event.eventDate))
    if (expiry.isExpired) {
      return NextResponse.json(
        {
          error:     "This portal has expired.",
          eventName: vendor.event.name,
          expiredAt: expiry.expiresAt,
        },
        { status: 410 } // 410 Gone — semantically correct for expired resources
      )
    }

    // 4. Record portal access timestamp
    await prisma.vendor.update({
      where: { portalToken },
      data:  { lastAccessed: new Date() },
    })

    // 5. Pull live headcount stats
    const [totalGuests, checkedIn] = await Promise.all([
      prisma.guest.count({
        where: { eventId: vendor.eventId, rsvpStatus: "CONFIRMED" },
      }),
      prisma.guest.count({
        where: { eventId: vendor.eventId, checkedIn: true },
      }),
    ])

    // 6. Pull food tallies for CATERER
    //    Pull drink tallies for DRINK_VENDOR
    //    Both use the same GuestMeal aggregate —
    //    just filtered by MenuCategory
    let foodTallies:  TallyItem[] = []
    let drinkTallies: TallyItem[] = []

    const isCaterer     = vendor.role === "CATERER"
    const isDrinkVendor = vendor.role === "DRINK_VENDOR"

    if (isCaterer || isDrinkVendor) {
      // Aggregate all confirmed guest meal selections
      const meals = await prisma.guestMeal.groupBy({
        by:    ["menuItemId"],
        where: {
          guest: { eventId: vendor.eventId, rsvpStatus: "CONFIRMED" },
        },
        _sum:     { quantity: true },
        orderBy:  { _sum: { quantity: "desc" } },
      })

      if (meals.length > 0) {
        // Get the menu item names and categories
        const menuItems = await prisma.menuItem.findMany({
          where:  { id: { in: meals.map(m => m.menuItemId) } },
          select: { id: true, name: true, category: true },
        })

        const itemMap = new Map(menuItems.map(i => [i.id, i]))

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

        if (isCaterer) {
          // Caterers see everything EXCEPT drinks
          foodTallies = allTallies.filter(t => t.category !== "DRINK")
        }
        if (isDrinkVendor) {
          // Drink vendors see only DRINK category items
          drinkTallies = allTallies.filter(t => t.category === "DRINK")
        }
      }
    }

    // 7. Return full portal payload
    return NextResponse.json({
      vendor: {
        id:                     vendor.id,
        name:                   vendor.name,
        contactName:            vendor.contactName,
        role:                   vendor.role,
        staffCount:             vendor.staffCount,   // Max staff cap set by planner
        staffRegistered:        vendor.staff.length, // How many vendor has added so far
        canOverrideCapacity:    vendor.canOverrideCapacity,
        capacityOverrideActive: vendor.capacityOverrideActive,
        notes:                  vendor.notes,
        staff:                  vendor.staff,
        existingFeedback:       vendor.feedback,     // null if not yet submitted
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
      foodTallies,   // Caterer only — food/meal orders
      drinkTallies,  // Drink vendor only — drink orders
      expiry,        // { isExpired, isInFeedbackWindow, expiresAt }
    })
  } catch (err) {
    console.error("GET /api/vendor/[portalToken] error:", err)
    return NextResponse.json(
      { error: "Failed to load vendor portal" },
      { status: 500 }
    )
  }
}

// ── Internal type ─────────────────────────────
interface TallyItem {
  menuItemId:  string
  name:        string
  category:    string
  totalOrders: number
}