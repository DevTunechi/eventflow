// src/app/api/payments/subscribe/route.ts
// POST — initialise a Paystack subscription for a plan
//
// Body: { plan: "starter" | "pro" }
// Returns: { authorizationUrl } — redirect planner to this URL

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"

const PLAN_CODES: Record<string, string> = {
  starter: process.env.PAYSTACK_STARTER_PLAN_CODE ?? "",
  pro:     process.env.PAYSTACK_PRO_PLAN_CODE     ?? "",
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const { plan } = await req.json()

    if (!["starter", "pro"].includes(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
    }

    const planCode = PLAN_CODES[plan]
    if (!planCode) {
      return NextResponse.json({ error: "Plan not configured" }, { status: 500 })
    }

    const user = await prisma.user.findUnique({
      where:  { email: session.email },
      select: { id: true, email: true, name: true, plan: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Don't let them subscribe to a lower or same plan
    if (user.plan === plan || (user.plan === "pro" && plan === "starter")) {
      return NextResponse.json(
        { error: `You are already on the ${user.plan} plan` },
        { status: 400 }
      )
    }

    // Generate unique reference for this transaction
    const reference = `sub_${user.id}_${plan}_${Date.now()}`

    // Initialise Paystack transaction
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method:  "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email:     user.email,
        amount:    plan === "starter" ? 500_000 : 1_500_000, // kobo
        plan:      planCode,
        reference,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/callback`,
        metadata: {
          userId:    user.id,
          plan,
          type:      "subscription",
          cancel_action: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing`,
        },
      }),
    })

    const paystackData = await paystackRes.json()

    if (!paystackData.status) {
      console.error("Paystack init error:", paystackData)
      return NextResponse.json({ error: "Payment initialisation failed" }, { status: 500 })
    }

    return NextResponse.json({
      authorizationUrl: paystackData.data.authorization_url,
      reference,
    })
  } catch (err) {
    console.error("subscribe route error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}