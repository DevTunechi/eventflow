// src/app/api/settings/profile/route.ts
// GET  — returns current planner profile
// PATCH — updates profile fields

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
        id: true, name: true, email: true, phone: true,
        businessName: true, businessLogo: true,
        plan: true, createdAt: true,
      },
    })

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    return NextResponse.json({ user })
  } catch (err) {
    console.error("GET /api/settings/profile error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const body = await req.json()
    const { name, phone, businessName, businessLogo } = body

    const user = await prisma.user.findUnique({
      where:  { email: session.email },
      select: { id: true },
    })

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(name         !== undefined && { name:         name?.trim()         || null }),
        ...(phone        !== undefined && { phone:        phone?.trim()        || null }),
        ...(businessName !== undefined && { businessName: businessName?.trim() || null }),
        ...(businessLogo !== undefined && { businessLogo: businessLogo         || null }),
      },
      select: {
        id: true, name: true, email: true, phone: true,
        businessName: true, businessLogo: true, plan: true,
      },
    })

    return NextResponse.json({ user: updated })
  } catch (err) {
    console.error("PATCH /api/settings/profile error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}