// src/app/api/admin/users/[userId]/route.ts
// PATCH — admin manually overrides a planner's plan

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function isAdmin(req: NextRequest): boolean {
  return req.headers.get("x-admin-secret") === process.env.ADMIN_SECRET
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const { userId } = await params
  const { plan, note } = await req.json()

  if (!["free","starter","pro"].includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data:  { plan },
      select:{ id:true, name:true, email:true, plan:true },
    })

    // Log the manual override
    await prisma.paymentLog.create({
      data: {
        userId,
        event:     "admin.plan_override",
        reference: null,
        amount:    null,
        status:    `plan set to ${plan} by admin`,
        raw:       { plan, note: note || "manual override", by: "admin" },
      },
    }).catch(() => {})

    return NextResponse.json({ user: updated })
  } catch (err) {
    console.error("Admin plan override error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}