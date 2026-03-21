// src/middleware.ts
// Handles plan gating and post-login redirects.
//
// Cookie values:
//   "free-acknowledged" — planner chose Free on pricing page
//   "starter"           — set by payment callback after Starter purchase
//   "pro"               — set by payment callback after Pro purchase
//
// Any of these values = let through to dashboard.
// No cookie at all = redirect to /pricing.

import { NextRequest, NextResponse } from "next/server"

const PUBLIC_PATHS = [
  "/login", "/invite", "/host", "/checkin",
  "/rsvp", "/vendor", "/usher", "/api",
  "/_next", "/favicon", "/eflogo",
  "/1.", "/2.", "/3.", "/4.", "/5.", "/6.",
  "/privacy", "/data-deletion",
]

const VALID_PLAN_VALUES = ["free-acknowledged", "free", "starter", "pro"]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow pricing page itself — prevents redirect loop
  if (pathname.startsWith("/pricing") || pathname === "/pricing") {
    return NextResponse.next()
  }

  // Only gate dashboard routes
  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next()
  }

  const planCookie = req.cookies.get("ef-plan")?.value

  // No plan cookie → redirect to pricing to choose a plan
  if (!planCookie || !VALID_PLAN_VALUES.includes(planCookie)) {
    const url = req.nextUrl.clone()
    url.pathname = "/pricing"
    return NextResponse.redirect(url)
  }

  // Valid plan cookie → allow through
  return NextResponse.next()
}

export const config = {
  matcher: ["/(dashboard)/:path*", "/dashboard/:path*"],
}