// src/app/api/vendor/[portalToken]/payments/route.ts
// GET  — vendor fetches their payment history
// POST — vendor acknowledges or disputes a payment

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ portalToken: string }> }
) {
  try {
    const { portalToken } = await params

    const vendor = await prisma.vendor.findUnique({
      where:  { portalToken },
      select: { id: true, totalCost: true, event: { select: { id: true } } },
    })

    if (!vendor) return NextResponse.json({ error: "Invalid token" }, { status: 404 })

    const payments = await prisma.vendorPayment.findMany({
      where:   { vendorId: vendor.id },
      orderBy: { createdAt: "desc" },
    })

    const totalPaid = payments
      .filter(p => p.status !== "DISPUTED")
      .reduce((sum, p) => sum + Number(p.amount), 0)

    return NextResponse.json({
      payments: payments.map(p => ({
        ...p,
        amount: p.amount.toString(),
      })),
      totalCost: vendor.totalCost ? vendor.totalCost.toString() : null,
      totalPaid: totalPaid.toString(),
      balance:   vendor.totalCost
        ? (Number(vendor.totalCost) - totalPaid).toString()
        : null,
    })
  } catch (err) {
    console.error("GET vendor portal payments error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ portalToken: string }> }
) {
  try {
    const { portalToken } = await params

    const vendor = await prisma.vendor.findUnique({
      where:  { portalToken },
      select: { id: true },
    })

    if (!vendor) return NextResponse.json({ error: "Invalid token" }, { status: 404 })

    const { paymentId, action, disputeNote } = await req.json()

    if (!paymentId || !["acknowledge", "dispute"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const payment = await prisma.vendorPayment.findFirst({
      where: { id: paymentId, vendorId: vendor.id },
    })

    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 })

    const updated = await prisma.vendorPayment.update({
      where: { id: paymentId },
      data:  action === "acknowledge"
        ? { status: "ACKNOWLEDGED", acknowledgedAt: new Date() }
        : { status: "DISPUTED", disputedAt: new Date(), disputeNote: disputeNote?.trim() || null },
    })

    return NextResponse.json({
      payment: { ...updated, amount: updated.amount.toString() },
    })
  } catch (err) {
    console.error("POST vendor portal payments error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}