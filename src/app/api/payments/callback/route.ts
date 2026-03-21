// src/app/api/payments/callback/route.ts
// GET — Paystack redirects here after payment attempt
//
// Verifies the payment and redirects planner to
// the appropriate page with a success/fail param.

import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const reference = searchParams.get("reference")

  if (!reference) {
    return NextResponse.redirect(
      new URL("/dashboard/settings/billing?status=error", req.url)
    )
  }

  try {
    // Verify the transaction with Paystack
    const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    })

    const data = await res.json()

    if (!data.status || data.data?.status !== "success") {
      return NextResponse.redirect(
        new URL(`/dashboard/settings/billing?status=failed&ref=${reference}`, req.url)
      )
    }

    const metadata = data.data?.metadata

    // Redirect based on what was purchased
    if (metadata?.topup && metadata?.eventId) {
      // Top-up — redirect to the event page
      return NextResponse.redirect(
        new URL(
          `/dashboard/events/${metadata.eventId}?payment=success&type=${metadata.type}`,
          req.url
        )
      )
    }

    // Subscription — redirect to billing page
    return NextResponse.redirect(
      new URL(`/dashboard/settings/billing?status=success&plan=${metadata?.plan}`, req.url)
    )
  } catch (err) {
    console.error("Callback verification error:", err)
    return NextResponse.redirect(
      new URL("/dashboard/settings/billing?status=error", req.url)
    )
  }
}