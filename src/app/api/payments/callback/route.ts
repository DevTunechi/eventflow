// src/app/api/payments/callback/route.ts
// GET — Paystack redirects here after payment.
//
// After successful subscription:
//   - Sets ef-plan cookie to "starter" or "pro"
//   - Redirects to /dashboard
//
// After successful top-up:
//   - Redirects to event page
//
// After failure:
//   - Redirects to billing page with error

import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const reference = searchParams.get("reference")
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "https://eventflowng.vercel.app"

  if (!reference) {
    return NextResponse.redirect(new URL("/dashboard/settings/billing?status=error", appUrl))
  }

  try {
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    )
    const data = await res.json()

    if (!data.status || data.data?.status !== "success") {
      return NextResponse.redirect(
        new URL(`/dashboard/settings/billing?status=failed&ref=${reference}`, appUrl)
      )
    }

    const metadata = data.data?.metadata

    // ── Top-up ───────────────────────────────────────────────
    if (metadata?.topup && metadata?.eventId) {
      return NextResponse.redirect(
        new URL(`/dashboard/events/${metadata.eventId}?payment=success&type=${metadata.type}`, appUrl)
      )
    }

    // ── Subscription ─────────────────────────────────────────
    // Set cookie to plan name so middleware lets them through
    const plan        = metadata?.plan ?? "starter"
    const redirectUrl = new URL("/dashboard?payment=success", appUrl)
    const response    = NextResponse.redirect(redirectUrl)

    response.cookies.set("ef-plan", plan, {
      path:     "/",
      maxAge:   365 * 24 * 60 * 60,
      sameSite: "lax",
      secure:   process.env.NODE_ENV === "production",
    })

    return response
  } catch (err) {
    console.error("Callback error:", err)
    return NextResponse.redirect(new URL("/dashboard/settings/billing?status=error", appUrl))
  }
}