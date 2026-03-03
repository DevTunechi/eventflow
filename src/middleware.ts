// src/middleware.ts
// Redirects Free plan users to /pricing after login
// unless they're already on /pricing or a public route.

import { NextRequest, NextResponse } from "next/server"

const PUBLIC_PATHS = ["/login", "/invite", "/host", "/checkin", "/rsvp", "/vendor", "/api"]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Skip public routes and API
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()

  // Skip pricing itself to avoid redirect loop
  if (pathname === "/pricing") return NextResponse.next()

  // Read plan from cookie (set at login)
  const plan = req.cookies.get("ef-plan")?.value

  // If no plan cookie or plan is "free", redirect to pricing
if (!plan || (plan !== "pro" && plan !== "free-acknowledged")) {
    const url = req.nextUrl.clone()
    url.pathname = "/pricing"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/(dashboard)/:path*"],
}