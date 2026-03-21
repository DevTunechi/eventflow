// src/app/api/payments/subscribe/route.ts
// POST — initialise a Paystack subscription for a plan
//
// Fixed: plan code lookup now reads env vars at
// request time, not at module load time. This fixes
// cases where env vars are undefined during cold start.

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"

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

    // Read env vars at request time — not at module load time
    // This is the fix: PLAN_CODES as a const at module level
    // can be undefined if the env var wasn't set when the
    // module first loaded (common in Vercel edge cold starts)
    const PLAN_CODES: Record<string, string | undefined> = {
      starter: process.env.PAYSTACK_STARTER_PLAN_CODE,
      pro:     process.env.PAYSTACK_PRO_PLAN_CODE,
    }

    const planCode = PLAN_CODES[plan]

    // Debug log — remove after confirming it works
    console.log("[subscribe] plan:", plan)
    console.log("[subscribe] planCode:", planCode)
    console.log("[subscribe] STARTER env:", process.env.PAYSTACK_STARTER_PLAN_CODE)
    console.log("[subscribe] PRO env:", process.env.PAYSTACK_PRO_PLAN_CODE)
    console.log("[subscribe] SECRET key prefix:", process.env.PAYSTACK_SECRET_KEY?.slice(0, 12))

    if (!planCode) {
      console.error("[subscribe] Plan code missing for plan:", plan)
      return NextResponse.json(
        { error: `Plan code not configured for ${plan}. Check PAYSTACK_${plan.toUpperCase()}_PLAN_CODE env var.` },
        { status: 500 }
      )
    }

    const user = await prisma.user.findUnique({
      where:  { email: session.email },
      select: { id: true, email: true, name: true, plan: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.plan === plan || (user.plan === "pro" && plan === "starter")) {
      return NextResponse.json(
        { error: `You are already on the ${user.plan} plan` },
        { status: 400 }
      )
    }

    const reference = `sub_${user.id}_${plan}_${Date.now()}`
    const amount    = plan === "starter" ? 500_000 : 1_500_000 // kobo

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://eventflowng.vercel.app"

    console.log("[subscribe] Sending to Paystack:", {
      email:     user.email,
      amount,
      plan:      planCode,
      reference,
      callback:  `${appUrl}/api/payments/callback`,
    })

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email:        user.email,
        amount,
        plan:         planCode,
        reference,
        callback_url: `${appUrl}/api/payments/callback`,
        metadata: {
          userId:        user.id,
          plan,
          type:          "subscription",
          cancel_action: `${appUrl}/dashboard/settings/billing`,
        },
      }),
    })

    const paystackData = await paystackRes.json()

    console.log("[subscribe] Paystack response:", JSON.stringify(paystackData))

    if (!paystackData.status) {
      console.error("[subscribe] Paystack error:", paystackData)
      return NextResponse.json(
        { error: "Payment initialisation failed", detail: paystackData.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      authorizationUrl: paystackData.data.authorization_url,
      reference,
    })
  } catch (err) {
    console.error("[subscribe] Caught error:", err)
    return NextResponse.json(
      { error: "Server error", detail: String(err) },
      { status: 500 }
    )
  }
}