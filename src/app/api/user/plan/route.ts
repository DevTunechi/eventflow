// src/app/api/user/plan/route.ts
// Returns the current user's plan.
// Extend this once Paystack billing is wired in.

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  try {
    const user = await prisma.user.findUnique({
      where:  { id: session.uid },
      select: { plan: true },
    })
    return NextResponse.json({ plan: user?.plan ?? "free" })
  } catch {
    return NextResponse.json({ plan: "free" })
  }
}