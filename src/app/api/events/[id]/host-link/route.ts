// src/app/api/events/[id]/host-link/route.ts
// POST — generate host link (one-time) and send via email
// GET  — return current host link details

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-server"
import { sendEmail, hostLinkEmailHtml } from "@/lib/resend"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://eventflowng.vercel.app"

// ── GET — return host link status ─────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  try {
    const event = await prisma.event.findFirst({
      where:  { id, plannerId: session.uid },
      select: { hostToken: true, hostEmail: true, hostName: true },
    })
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })
    return NextResponse.json({
      hasHostLink: !!event.hostToken,
      hostEmail:   event.hostEmail,
      hostName:    event.hostName,
      hostLink:    event.hostToken ? `${APP_URL}/host/${event.hostToken}` : null,
    })
  } catch (error) {
    console.error("host-link GET error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// ── POST — generate (once) and send host link ─────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  try {
    const existing = await prisma.event.findFirst({
      where:  { id, plannerId: session.uid },
      select: {
        id: true, name: true, eventDate: true, startTime: true,
        venueName: true, hostToken: true, hostEmail: true, hostName: true,
        planner: { select: { name: true } },
      },
    })
    if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const { hostName, hostEmail, resend = true } = await req.json()

    if (!hostEmail?.trim()) return NextResponse.json({ error: "Host email is required" }, { status: 400 })
    if (!hostName?.trim())  return NextResponse.json({ error: "Host name is required"  }, { status: 400 })

    // Generate token once — never regenerate
    const token = existing.hostToken ?? `host_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`

    const event = await prisma.event.update({
      where: { id },
      data: {
        hostToken: token,
        hostEmail: hostEmail.trim(),
        hostName:  hostName.trim(),
      },
    })

    const hostLink = `${APP_URL}/host/${token}`
    const eventDate = new Date(existing.eventDate).toLocaleDateString("en-NG", {
      weekday:"long", year:"numeric", month:"long", day:"numeric",
    })

    // Send email if requested
    let emailResult = { success: true }
    if (resend) {
      emailResult = await sendEmail({
        to:      hostEmail.trim(),
        subject: `Your host access for ${existing.name}`,
        html:    hostLinkEmailHtml({
          hostName:       hostName.trim(),
          eventName:      existing.name,
          eventDate,
          venueName:      existing.venueName,
          hostPortalLink: hostLink,
          plannerName:    existing.planner.name ?? "Your planner",
        }),
      })
    }

    return NextResponse.json({
      success:       true,
      hostLink,
      hostEmail:     hostEmail.trim(),
      emailSent:     emailResult.success,
      emailError:    emailResult.success ? null : (emailResult as any).error,
    })
  } catch (error) {
    console.error("host-link POST error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}