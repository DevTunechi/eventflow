// src/app/api/payments/billing/route.ts
// GET — returns current plan and subscription info for billing page

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where:  { email: session.email },
      select: {
        id: true, plan: true, planExpiresAt: true,
        subscriptions: {
          where:   { status: { in: ["ACTIVE", "PAST_DUE"] } },
          orderBy: { createdAt: "desc" },
          take:    1,
          select: {
            status:         true,
            nextBillingDate: true,
            amount:         true,
            plan:           true,
          },
        },
      },
    })

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    return NextResponse.json({
      plan:          user.plan,
      planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
      subscription:  user.subscriptions[0] ?? null,
    })
  } catch (err) {
    console.error("billing route error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}