// src/app/api/rsvp/route.ts
// GET  — load event + prefilled guest data for RSVP page
// POST — submit RSVP

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// ── GET /api/rsvp?slug=xxx&invite=yyy ─────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug        = searchParams.get("slug")
  const inviteToken = searchParams.get("invite")

  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 })

  try {
    const event = await prisma.event.findUnique({
      where:   { slug },
      select: {
        id:             true,
        name:           true,
        slug:           true,
        description:    true,
        eventDate:      true,
        startTime:      true,
        venueName:      true,
        venueAddress:   true,
        invitationCard: true,
        brandColor:     true,
        inviteModel:    true,
        requireOtp:     true,
        rsvpDeadline:   true,
        status:         true,
        venueCapacity:  true,
        _count:         { select: { guests: true } },
        guestTiers: {
          select: { id: true, name: true, menuAccess: true, maxGuests: true },
          orderBy: { createdAt: "asc" },
        },
        menuItems: {
          where:   { isAvailable: true },
          select:  { id: true, name: true, description: true, category: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    })

    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    // Reject if event is draft or cancelled
    if (["DRAFT", "CANCELLED"].includes(event.status)) {
      return NextResponse.json({ error: "This event is not accepting RSVPs" }, { status: 403 })
    }

    // Reject if RSVP deadline passed
    if (event.rsvpDeadline && new Date() > new Date(event.rsvpDeadline)) {
      return NextResponse.json({ error: "RSVP deadline has passed" }, { status: 403 })
    }

    // Reject if at venue capacity
    if (event.venueCapacity && event._count.guests >= event.venueCapacity) {
      return NextResponse.json({ error: "This event is at full capacity" }, { status: 409 })
    }

    // Reject if closed model with no token
    if (event.inviteModel === "CLOSED" && !inviteToken) {
      return NextResponse.json({ error: "This event requires a personal invitation link" }, { status: 403 })
    }

    // Load prefilled guest from invite token
    let guest = null
    if (inviteToken) {
      const g = await prisma.guest.findUnique({
        where:  { inviteToken },
        select: { id: true, firstName: true, lastName: true, phone: true, tierId: true,
                  inviteTokenUsed: true, rsvpStatus: true,
                  tier: { select: { name: true } } },
      })
      if (!g) return NextResponse.json({ error: "Invalid invitation link" }, { status: 404 })
      // Allow re-accessing confirmed RSVP (don't block)
      guest = {
        id:        g.id,
        firstName: g.firstName,
        lastName:  g.lastName,
        phone:     g.phone,
        tierId:    g.tierId,
        tierName:  g.tier?.name ?? null,
        alreadyRsvpd: g.inviteTokenUsed,
        rsvpStatus: g.rsvpStatus,
      }
    }

    return NextResponse.json({ event, guest })
  } catch (error) {
    console.error("GET /api/rsvp error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// ── POST /api/rsvp ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      slug, inviteToken,
      firstName, lastName, phone, email,
      tierId, rsvpStatus, isPrivate,
      otpVerified, meals, guestId,
    } = body

    if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 })
    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }
    if (!phone?.trim()) return NextResponse.json({ error: "Phone number is required" }, { status: 400 })

    const event = await prisma.event.findUnique({
      where:  { slug },
      select: {
        id: true, name: true, inviteModel: true, requireOtp: true,
        status: true, rsvpDeadline: true, venueCapacity: true,
        slug: true, invitationCard: true, brandColor: true,
        eventDate: true, startTime: true, venueName: true,
        planner: { select: { name: true } },
        _count: { select: { guests: true } },
      },
    })

    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })
    if (["DRAFT","CANCELLED"].includes(event.status)) {
      return NextResponse.json({ error: "Event not accepting RSVPs" }, { status: 403 })
    }
    if (event.venueCapacity && event._count.guests >= event.venueCapacity) {
      return NextResponse.json({ error: "Event is at full capacity" }, { status: 409 })
    }

    const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://eventflowng.vercel.app"

    // ── CLOSED model — update existing guest ──────────────
    if (event.inviteModel === "CLOSED" && inviteToken) {
      const existing = await prisma.guest.findUnique({
        where: { inviteToken },
        select: { id: true, eventId: true },
      })
      if (!existing || existing.eventId !== event.id) {
        return NextResponse.json({ error: "Invalid invitation token" }, { status: 400 })
      }

      const updatedGuest = await prisma.guest.update({
        where: { inviteToken },
        data: {
          firstName:      firstName.trim(),
          lastName:       lastName.trim(),
          phone:          phone.trim(),
          email:          email?.trim() || null,
          tierId:         tierId || null,
          rsvpStatus:     rsvpStatus ?? "CONFIRMED",
          rsvpAt:         new Date(),
          phoneVerified:  otpVerified ?? false,
          inviteTokenUsed: true,
          // Generate QR URL placeholder — real QR rendered client-side
          qrCodeUrl:      `${APP_URL}/rsvp/confirmed/${existing.id}`,
        },
      })

      // Save meal selections
      if (meals?.length) {
        await prisma.guestMeal.createMany({
          data: meals.map((m: { menuItemId: string; quantity?: number }) => ({
            guestId:    updatedGuest.id,
            menuItemId: m.menuItemId,
            quantity:   m.quantity ?? 1,
          })),
          skipDuplicates: true,
        })
      }

      return NextResponse.json({ guestId: updatedGuest.id, success: true })
    }

    // ── OPEN model — create new guest ─────────────────────
    const newToken = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`

    const newGuest = await prisma.guest.create({
      data: {
        eventId:       event.id,
        firstName:     firstName.trim(),
        lastName:      lastName.trim(),
        phone:         phone.trim(),
        email:         email?.trim() || null,
        tierId:        tierId || null,
        rsvpStatus:    rsvpStatus ?? "CONFIRMED",
        rsvpAt:        new Date(),
        phoneVerified: otpVerified ?? false,
        inviteChannel: "MANUAL",
        qrCode:        newToken,
        qrCodeUrl:     `${APP_URL}/rsvp/confirmed/pending`, // updated after creation
      },
    })

    // Update qrCodeUrl now we have the id
    await prisma.guest.update({
      where: { id: newGuest.id },
      data:  { qrCodeUrl: `${APP_URL}/rsvp/confirmed/${newGuest.id}` },
    })

    // Save meal selections
    if (meals?.length) {
      await prisma.guestMeal.createMany({
        data: meals.map((m: { menuItemId: string; quantity?: number }) => ({
          guestId:    newGuest.id,
          menuItemId: m.menuItemId,
          quantity:   m.quantity ?? 1,
        })),
        skipDuplicates: true,
      })
    }

    return NextResponse.json({ guestId: newGuest.id, success: true })
  } catch (error) {
    console.error("POST /api/rsvp error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}