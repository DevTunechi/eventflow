// ─────────────────────────────────────────────
// src/app/api/auth/sync/route.ts
// Called automatically after every Google
// sign-in. Creates a new user row in our
// database or updates an existing one.
// This bridges Firebase Auth ↔ Neon PostgreSQL.
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    // Destructure the Firebase user data sent
    // from AuthContext.tsx after sign-in
    const { uid, name, email, image } = await req.json()

    // Email is required — can't create a user without it
    if (!email) {
      return NextResponse.json(
        { error: "Email required" },
        { status: 400 }
      )
    }

    // upsert = update if exists, create if new
    // This means returning users are handled
    // automatically — no duplicate rows
    const user = await prisma.user.upsert({
      where: { email },       // look up by email
      update: {
        name,                 // refresh name/photo on each login
        image,                // in case they updated their Google profile
      },
      create: {
        id:    uid,           // use Firebase UID as our DB primary key
        name,
        email,
        image,
      },
    })

    // Return the user so the client can use it
    return NextResponse.json({ user })

  } catch (error) {
    console.error("User sync error:", error)
    return NextResponse.json(
      { error: "Failed to sync user" },
      { status: 500 }
    )
  }
}