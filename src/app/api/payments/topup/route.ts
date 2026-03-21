// src/app/api/payments/topup/route.ts
// POST — initialise a one-time Paystack charge for a top-up
//
// Body: { eventId: string, type: "GUESTS" | "WHATSAPP" | "CHECKIN" }
// Returns: { authorizationUrl }

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { TOPUP_PRICES, TOPUP_LABELS } from "@/lib/plan-limits"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const { eventId, type } = await req.json()

    if (!eventId || !type) {
      return NextResponse.json({ error: "eventId and type are required" }, { status: 400 })
    }

    if (!["GUESTS", "WHATSAPP", "CHECKIN"].includes(type)) {
      return NextResponse.json({ error: "Invalid top-up type" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where:  { email: session.email },
      select: { id: true, email: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify event belongs to this planner
    const event = await prisma.event.findFirst({
      where:  { id: eventId, plannerId: user.id },
      select: { id: true, name: true },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Check for existing active top-up of same type
    // (GUESTS can stack, others cannot)
    if (type !== "GUESTS") {
      const existing = await prisma.eventTopUp.findFirst({
        where: { userId: user.id, eventId, type, status: "ACTIVE" },
      })
      if (existing) {
        return NextResponse.json(
          { error: `You already have ${TOPUP_LABELS[type as keyof typeof TOPUP_LABELS]} for this event` },
          { status: 400 }
        )
      }
    }

    const amount    = TOPUP_PRICES[type as keyof typeof TOPUP_PRICES]
    const reference = `topup_${user.id}_${eventId}_${type}_${Date.now()}`

    // Create a pending top-up record
    await prisma.eventTopUp.create({
      data: {
        userId:     user.id,
        eventId,
        type:       type as "GUESTS" | "WHATSAPP" | "CHECKIN",
        status:     "PENDING",
        amount,
        paystackRef: reference,
        guestBonus:  type === "GUESTS" ? 200 : null,
      },
    })

    // Initialise Paystack one-time charge
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method:  "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email:     user.email,
        amount,
        reference,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/callback`,
        metadata: {
          userId:  user.id,
          eventId,
          type,
          topup:   true,
          cancel_action: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/events/${eventId}`,
        },
      }),
    })

    const paystackData = await paystackRes.json()

    if (!paystackData.status) {
      // Clean up pending record if Paystack failed
      await prisma.eventTopUp.deleteMany({
        where: { paystackRef: reference },
      })
      return NextResponse.json({ error: "Payment initialisation failed" }, { status: 500 })
    }

    return NextResponse.json({
      authorizationUrl: paystackData.data.authorization_url,
      reference,
    })
  } catch (err) {
    console.error("topup route error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}