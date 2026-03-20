// ─────────────────────────────────────────────
// FILE: src/app/api/vendor/[portalToken]/override/route.ts
//
// PUBLIC API — no login required (token is the auth).
// Called by the SECURITY vendor's walk-in toggle button.
//
// POST /api/vendor/[portalToken]/override
//   Body: { active: boolean }
//   Toggles Vendor.capacityOverrideActive.
//   Only works if Vendor.canOverrideCapacity is true.
//   Records the timestamp when override was activated.
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ portalToken: string }> }
) {
  try {
    const { portalToken } = await params
    const { active } = await req.json()

    // 1. Find vendor and verify they have override permission
    const vendor = await prisma.vendor.findUnique({
      where:  { portalToken },
      select: { id: true, canOverrideCapacity: true },
    })

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
    }

    // 2. Block if planner hasn't granted this vendor override access
    if (!vendor.canOverrideCapacity) {
      return NextResponse.json(
        { error: "This vendor does not have walk-in override permission" },
        { status: 403 }
      )
    }

    // 3. Toggle the override state and record the timestamp
    const updated = await prisma.vendor.update({
      where: { portalToken },
      data: {
        capacityOverrideActive: active,
        // Only record the activation time when turning ON
        capacityOverrideAt: active ? new Date() : undefined,
      },
      select: { capacityOverrideActive: true },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error("POST /api/vendor/[portalToken]/override error:", err)
    return NextResponse.json({ error: "Failed to update override" }, { status: 500 })
  }
}