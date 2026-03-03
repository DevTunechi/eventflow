// src/app/api/checkin/route.ts
// POST — validate QR code and check in guest

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const { qrCode, accessToken, eventId } = await req.json()

    if (!qrCode || !accessToken || !eventId) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    // Verify usher access token belongs to this event
    const usher = await prisma.usher.findUnique({
      where:  { accessToken },
      select: { id: true, eventId: true, isActive: true, role: true },
    })

    if (!usher || usher.eventId !== eventId || !usher.isActive) {
      return NextResponse.json({ success: false, error: "Invalid or inactive usher access", code: "INVALID_USHER" }, { status: 403 })
    }

    // Find guest by QR code
    const guest = await prisma.guest.findUnique({
      where:  { qrCode },
      select: {
        id: true, firstName: true, lastName: true,
        phone: true, rsvpStatus: true,
        tableNumber: true, checkedIn: true, checkedInAt: true,
        isFlagged: true, flagReason: true, eventId: true,
        tier:  { select: { name: true, color: true } },
        meals: { select: { menuItem: { select: { name: true, category: true } } } },
      },
    })

    if (!guest) {
      return NextResponse.json({ success: false, error: "QR code not recognised", code: "INVALID_QR" }, { status: 404 })
    }

    // Make sure the QR belongs to this event
    if (guest.eventId !== eventId) {
      return NextResponse.json({ success: false, error: "QR code is for a different event", code: "WRONG_EVENT" }, { status: 400 })
    }

    // Already checked in — flag and warn usher
    if (guest.checkedIn) {
      // Flag as potential gate crasher on second scan
      await prisma.guest.update({
        where: { qrCode },
        data:  { isFlagged: true, flagReason: "QR scanned more than once", flaggedAt: new Date() },
      })
      return NextResponse.json({
        success: false,
        error:   `${guest.firstName} ${guest.lastName} was already checked in at ${new Date(guest.checkedInAt!).toLocaleTimeString("en-NG", { hour:"2-digit", minute:"2-digit" })}`,
        code:    "ALREADY_CHECKED_IN",
        guest:   { ...guest, isFlagged: true, flagReason: "QR scanned more than once" },
      })
    }

    // RSVP not confirmed — allow entry but flag
    const shouldFlag = guest.rsvpStatus !== "CONFIRMED"
    const flagReason = shouldFlag
      ? guest.rsvpStatus === "DECLINED"  ? "RSVP was declined"
      : guest.rsvpStatus === "PENDING"   ? "RSVP not confirmed"
      : guest.rsvpStatus === "NO_SHOW"   ? "Marked as no-show"
      : "Unexpected RSVP status"
      : null

    // Mark as checked in
    const updated = await prisma.guest.update({
      where: { qrCode },
      data: {
        checkedIn:    true,
        checkedInAt:  new Date(),
        checkedInBy:  usher.id,
        rsvpStatus:   guest.rsvpStatus === "PENDING" ? "CONFIRMED" : guest.rsvpStatus,
        isFlagged:    shouldFlag,
        flagReason:   flagReason,
        flaggedAt:    shouldFlag ? new Date() : null,
      },
      select: {
        id: true, firstName: true, lastName: true,
        phone: true, rsvpStatus: true,
        tableNumber: true, checkedIn: true, checkedInAt: true,
        isFlagged: true, flagReason: true,
        tier:  { select: { name: true, color: true } },
        meals: { select: { menuItem: { select: { name: true, category: true } } } },
      },
    })

    return NextResponse.json({ success: true, guest: updated })
  } catch (error) {
    console.error("checkin error:", error)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}