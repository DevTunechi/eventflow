// src/app/api/admin/route.ts
// GET — returns all data needed for admin dashboard
// Protected by ADMIN_SECRET env var

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function isAdmin(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret")
  return secret === process.env.ADMIN_SECRET
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  try {
    const [
      totalPlanners,
      plannersByPlan,
      recentPlanners,
      totalEvents,
      eventsByStatus,
      recentEvents,
      totalPayments,
      recentPayments,
      failedPayments,
      recentLogs,
      totalGuests,
      totalVendors,
    ] = await Promise.all([
      // Planner counts
      prisma.user.count(),
      prisma.user.groupBy({ by:["plan"], _count:{ plan:true } }),
      prisma.user.findMany({
        orderBy: { createdAt:"desc" }, take:10,
        select: { id:true, name:true, email:true, plan:true, createdAt:true,
          _count:{ select:{ events:true } } },
      }),

      // Event counts
      prisma.event.count(),
      prisma.event.groupBy({ by:["status"], _count:{ status:true } }),
      prisma.event.findMany({
        orderBy: { createdAt:"desc" }, take:10,
        select: { id:true, name:true, status:true, eventDate:true, createdAt:true,
          planner:{ select:{ name:true, email:true } },
          _count:{ select:{ guests:true, vendors:true } } },
      }),

      // Payments
      prisma.subscription.count({ where:{ status:"ACTIVE" } }),
      prisma.subscription.findMany({
        orderBy: { createdAt:"desc" }, take:10,
        select: { id:true, plan:true, amount:true, status:true, createdAt:true,
          user:{ select:{ name:true, email:true } } },
      }),
      prisma.subscription.findMany({
        where:   { status:"PAST_DUE" },
        orderBy: { createdAt:"desc" }, take:10,
        select:  { id:true, plan:true, createdAt:true,
          user:{ select:{ name:true, email:true } } },
      }),

      // Payment log (last 20 events)
      prisma.paymentLog.findMany({
        orderBy: { createdAt:"desc" }, take:20,
        select:  { id:true, event:true, amount:true, status:true, reference:true, createdAt:true, userId:true },
      }),

      // Totals
      prisma.guest.count(),
      prisma.vendor.count(),
    ])

    // MRR calculation
    const activeSubs = await prisma.subscription.findMany({
      where:  { status:"ACTIVE" },
      select: { amount:true, plan:true },
    })
    const mrr = activeSubs.reduce((sum, s) => sum + Number(s.amount), 0) / 100 // kobo → naira

    // Conversion rate
    const freePlanners  = plannersByPlan.find(p => p.plan==="free")?._count.plan ?? 0
    const paidPlanners  = totalPlanners - freePlanners
    const conversionRate = totalPlanners > 0 ? Math.round((paidPlanners / totalPlanners) * 100) : 0

    return NextResponse.json({
      stats: {
        totalPlanners,
        paidPlanners,
        freePlanners,
        conversionRate,
        totalEvents,
        totalGuests,
        totalVendors,
        activeSubscriptions: totalPayments,
        mrr,
      },
      plannersByPlan,
      eventsByStatus,
      recentPlanners,
      recentEvents,
      recentPayments,
      failedPayments,
      recentLogs,
    })
  } catch (err) {
    console.error("Admin API error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}