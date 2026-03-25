// src/app/api/events/[id]/vendors/[vendorId]/payments/route.ts
// GET  — list payments for a vendor
// POST — planner uploads a new payment

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; vendorId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const { id: eventId, vendorId } = await params

    const payments = await prisma.vendorPayment.findMany({
      where:   { vendorId, eventId },
      orderBy: { createdAt: "desc" },
    })

    // Also return vendor totalCost for balance calc
    const vendor = await prisma.vendor.findUnique({
      where:  { id: vendorId },
      select: { totalCost: true },
    })

    const totalPaid = payments
      .filter(p => p.status !== "DISPUTED")
      .reduce((sum, p) => sum + Number(p.amount), 0)

    return NextResponse.json({
      payments: payments.map(p => ({
        ...p,
        amount: p.amount.toString(),
      })),
      totalCost:    vendor?.totalCost ? vendor.totalCost.toString() : null,
      totalPaid:    totalPaid.toString(),
      balance:      vendor?.totalCost
        ? (Number(vendor.totalCost) - totalPaid).toString()
        : null,
    })
  } catch (err) {
    console.error("GET vendor payments error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; vendorId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const { id: eventId, vendorId } = await params
    const { amount, method, note, receiptUrl, totalCost } = await req.json()

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 })
    }
    if (!["BANK_TRANSFER", "CASH"].includes(method)) {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 })
    }
    if (method === "BANK_TRANSFER" && !receiptUrl) {
      return NextResponse.json({ error: "Receipt is required for bank transfers" }, { status: 400 })
    }

    // Update totalCost on vendor if provided
    if (totalCost !== undefined && totalCost !== null) {
      await prisma.vendor.update({
        where: { id: vendorId },
        data:  { totalCost: Number(totalCost) },
      })
    }

    const payment = await prisma.vendorPayment.create({
      data: {
        vendorId,
        eventId,
        amount:     Number(amount),
        method,
        note:       note?.trim() || null,
        receiptUrl: receiptUrl || null,
        status:     "PENDING",
      },
    })

    return NextResponse.json({
      payment: { ...payment, amount: payment.amount.toString() },
    }, { status: 201 })
  } catch (err) {
    console.error("POST vendor payment error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}