// src/app/api/settings/delete-account/route.ts
// POST — permanently deletes a planner's account
// Cascades to all events, guests, vendors etc via Prisma schema

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"

export async function POST(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where:  { email: session.email },
      select: { id: true, plan: true },
    })

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    // Cancel active Paystack subscriptions before deleting
    const activeSub = await prisma.subscription.findFirst({
      where:  { userId: user.id, status: "ACTIVE" },
      select: { paystackSubCode: true, paystackEmailToken: true },
    })

    if (activeSub?.paystackSubCode && activeSub?.paystackEmailToken) {
      await fetch("https://api.paystack.co/subscription/disable", {
        method:  "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code:  activeSub.paystackSubCode,
          token: activeSub.paystackEmailToken,
        }),
      }).catch(err => console.error("Failed to cancel Paystack sub on delete:", err))
    }

    // Delete user — cascades to all related data via schema onDelete: Cascade
    await prisma.user.delete({ where: { id: user.id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("delete-account error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}