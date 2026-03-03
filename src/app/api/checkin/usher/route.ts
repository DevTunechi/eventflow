// src/app/api/checkin/usher/route.ts
// GET — validate usher access token, return usher + event info

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get("token")

  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 })

  try {
    const usher = await prisma.usher.findUnique({
      where:  { accessToken: token },
      select: {
        id: true, name: true, role: true, isActive: true,
        event: {
          select: {
            id: true, name: true, eventDate: true,
            venueName: true, brandColor: true, status: true,
          },
        },
      },
    })

    if (!usher || !usher.isActive) {
      return NextResponse.json({ error: "Invalid or inactive usher link" }, { status: 403 })
    }

    return NextResponse.json({ usher })
  } catch (error) {
    console.error("usher auth error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}