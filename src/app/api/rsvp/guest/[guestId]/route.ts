// src/app/api/rsvp/guest/[guestId]/route.ts
// PATCH — guest updates their meal selections
//         called from the confirmation page edit form
//         only allowed if rsvpDeadline has not passed
//
// POST  — guest submits a tribute message to the celebrant
//         one per guest, upserts on resubmit

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// ── PATCH — update meal selections ───────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ guestId: string }> }
) {
  const { guestId } = await params

  try {
    const guest = await prisma.guest.findUnique({
      where:  { id: guestId },
      select: {
        id: true, rsvpStatus: true,
        event: { select: { rsvpDeadline: true, id: true } },
      },
    })

    if (!guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 })
    }

    // Block edits after RSVP deadline
    if (guest.event.rsvpDeadline && new Date() > new Date(guest.event.rsvpDeadline)) {
      return NextResponse.json(
        { error: "RSVP has closed — meal selections can no longer be edited." },
        { status: 403 }
      )
    }

    // Block if guest declined
    if (guest.rsvpStatus === "DECLINED") {
      return NextResponse.json(
        { error: "Cannot edit meals for a declined RSVP." },
        { status: 400 }
      )
    }

    const { meals } = await req.json()
    // meals: { menuItemId: string; quantity: number }[]

    if (!Array.isArray(meals)) {
      return NextResponse.json({ error: "meals must be an array" }, { status: 400 })
    }

    // Validate all menu items belong to this event
    if (meals.length > 0) {
      const menuItemIds = meals.map((m: { menuItemId: string }) => m.menuItemId)
      const validItems  = await prisma.menuItem.findMany({
        where:  { id: { in: menuItemIds }, eventId: guest.event.id },
        select: { id: true },
      })
      if (validItems.length !== menuItemIds.length) {
        return NextResponse.json({ error: "Invalid menu item selection" }, { status: 400 })
      }
    }

    // Replace all existing meal selections with new ones
    await prisma.$transaction([
      // Delete existing selections
      prisma.guestMeal.deleteMany({ where: { guestId } }),
      // Insert new selections
      ...(meals.length > 0
        ? [prisma.guestMeal.createMany({
            data: meals.map((m: { menuItemId: string; quantity?: number }) => ({
              guestId,
              menuItemId: m.menuItemId,
              quantity:   m.quantity ?? 1,
            })),
          })]
        : []),
    ])

    // Return updated guest meal list
    const updated = await prisma.guest.findUnique({
      where:  { id: guestId },
      select: {
        meals: {
          select: {
            menuItem: { select: { id: true, name: true, category: true } },
          },
        },
      },
    })

    return NextResponse.json({ meals: updated?.meals ?? [] })
  } catch (error) {
    console.error("meal update error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// ── POST — submit tribute ─────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ guestId: string }> }
) {
  const { guestId } = await params

  try {
    const guest = await prisma.guest.findUnique({
      where:  { id: guestId },
      select: { id: true, rsvpStatus: true, event: { select: { id: true } } },
    })

    if (!guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 })
    }

    const { message } = await req.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    if (message.trim().length > 1000) {
      return NextResponse.json(
        { error: "Message must be under 1000 characters" },
        { status: 400 }
      )
    }

    // Upsert — guest can update their tribute
    const tribute = await prisma.tribute.upsert({
      where:  { guestId },
      update: { message: message.trim() },
      create: {
        guestId,
        eventId: guest.event.id,
        message: message.trim(),
      },
    })

    return NextResponse.json({ tribute }, { status: 201 })
  } catch (error) {
    console.error("tribute error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}