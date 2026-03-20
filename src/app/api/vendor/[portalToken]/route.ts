// ─────────────────────────────────────────────
// FILE: src/app/api/vendor/[portalToken]/route.ts
//
// PUBLIC API — no authentication required.
// Called by the vendor portal page on load.
//
// GET /api/vendor/[portalToken]
//   Looks up a Vendor by their portalToken (cuid),
//   returns their details, the event summary,
//   headcount stats, and meal tallies for caterers.
//
// PRIVACY RULE: Guest names and personal details
//   are NEVER returned. Only counts and aggregates.
//
// The portalToken is stored in Vendor.portalToken,
// generated as @default(cuid()) in schema.prisma.
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/vendor/[portalToken]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ portalToken: string }> }
) {
  try {
    const { portalToken } = await params

    // 1. Look up vendor by their unique portal token
    const vendor = await prisma.vendor.findUnique({
      where:  { portalToken },
      select: {
        id:                     true,
        name:                   true,
        contactName:            true,
        role:                   true,
        notes:                  true,
        staffCount:             true, // Number of staff they're bringing
        canOverrideCapacity:    true,
        capacityOverrideActive: true,
        eventId:                true,
        // Include event details for the portal header
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
          },
        },
      },
    })

    // 2. 404 if token doesn't match any vendor
    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found. This link may be invalid or expired." },
        { status: 404 }
      )
    }

    // 3. Record that this vendor accessed their portal
    //    Used by planner to see "last accessed" in vendor list
    await prisma.vendor.update({
      where: { portalToken },
      data:  { lastAccessed: new Date() },
    })

    // 4. Pull headcount stats — no guest names, just counts
    const [totalGuests, checkedIn] = await Promise.all([
      prisma.guest.count({
        where: { eventId: vendor.eventId, rsvpStatus: "CONFIRMED" },
      }),
      prisma.guest.count({
        where: { eventId: vendor.eventId, checkedIn: true },
      }),
    ])

    // 5. Pull meal tallies for CATERER vendors only
    //    Groups meal selections by menu item to show how many of each dish is needed
    let mealTallies: Array<{
      menuItemId:  string
      name:        string
      category:    string
      totalOrders: number
    }> = []

    if (vendor.role === "CATERER") {
      // Aggregate all guest meal selections for this event
      const meals = await prisma.guestMeal.groupBy({
        by:          ["menuItemId"],
        where: {
          guest: { eventId: vendor.eventId, rsvpStatus: "CONFIRMED" },
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
      })

      // Look up the menu item names and categories for the tally
      if (meals.length > 0) {
        const menuItems = await prisma.menuItem.findMany({
          where:  { id: { in: meals.map(m => m.menuItemId) } },
          select: { id: true, name: true, category: true },
        })

        // Merge the tally counts with the menu item details
        const itemMap = new Map(menuItems.map(i => [i.id, i]))
        mealTallies = meals
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
          .filter(Boolean) as typeof mealTallies
      }
    }

    // 6. Return everything the vendor portal needs
    return NextResponse.json({
      vendor: {
        id:                     vendor.id,
        name:                   vendor.name,
        contactName:            vendor.contactName,
        role:                   vendor.role,
        staffCount:             vendor.staffCount,
        canOverrideCapacity:    vendor.canOverrideCapacity,
        capacityOverrideActive: vendor.capacityOverrideActive,
        notes:                  vendor.notes,
      },
      event: vendor.event,
      stats: {
        totalGuests,
        checkedIn,
        pending: totalGuests - checkedIn,
      },
      mealTallies, // Empty array for non-caterer vendors
    })
  } catch (err) {
    console.error("GET /api/vendor/[portalToken] error:", err)
    return NextResponse.json(
      { error: "Failed to load vendor portal" },
      { status: 500 }
    )
  }
}