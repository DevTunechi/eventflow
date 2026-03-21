// src/app/api/payments/webhook/route.ts
// POST — Paystack sends all payment events here
//
// Handles:
//   charge.success          — one-time payment confirmed (top-ups)
//   subscription.create     — new subscription activated
//   subscription.disable    — subscription cancelled
//   invoice.payment_failed  — recurring charge failed
//   invoice.update          — subscription renewed

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

// Verify the request actually came from Paystack
function verifyPaystackSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY ?? "")
    .update(body)
    .digest("hex")
  return hash === signature
}

export async function POST(req: NextRequest) {
  try {
    const rawBody  = await req.text()
    const signature = req.headers.get("x-paystack-signature") ?? ""

    // Reject requests not from Paystack
    if (!verifyPaystackSignature(rawBody, signature)) {
      console.warn("Invalid Paystack signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    const event = JSON.parse(rawBody)
    const { data } = event

    console.log(`[Paystack Webhook] ${event.event}`, data?.reference)

    // Log every event for audit trail
    await prisma.paymentLog.create({
      data: {
        event:     event.event,
        reference: data?.reference ?? null,
        amount:    data?.amount    ?? null,
        status:    data?.status    ?? "unknown",
        raw:       event,
        userId:    data?.metadata?.userId ?? null,
      },
    }).catch(err => console.error("Failed to log payment event:", err))

    // ── Handle each event type ──────────────────────────────

    switch (event.event) {

      // ── One-time charge success ────────────────────────────
      // Fires for top-up purchases
      case "charge.success": {
        const { reference, metadata, amount, customer } = data

        if (!metadata?.topup) {
          // This is a subscription initialisation charge — handled by subscription.create
          break
        }

        const { userId, eventId, type } = metadata

        // Activate the top-up
        await prisma.eventTopUp.updateMany({
          where: { paystackRef: reference, status: "PENDING" },
          data:  { status: "ACTIVE" },
        })

        // Store customer code for future charges
        if (customer?.customer_code) {
          await prisma.user.update({
            where: { id: userId },
            data:  { paystackCustomerCode: customer.customer_code },
          }).catch(() => {})
        }

        console.log(`[Webhook] Top-up activated: ${type} for event ${eventId}`)
        break
      }

      // ── Subscription created / activated ───────────────────
      case "subscription.create": {
        const {
          subscription_code,
          email_token,
          plan:      paystackPlan,
          customer,
          next_payment_date,
          amount,
        } = data

        // Match plan code to our internal plan name
        const starterCode = process.env.PAYSTACK_STARTER_PLAN_CODE
        const proCode     = process.env.PAYSTACK_PRO_PLAN_CODE
        const planName    = paystackPlan?.plan_code === proCode ? "pro"
                          : paystackPlan?.plan_code === starterCode ? "starter"
                          : null

        if (!planName) {
          console.warn("Unknown plan code:", paystackPlan?.plan_code)
          break
        }

        // Find user by email
        const user = await prisma.user.findUnique({
          where:  { email: customer.email },
          select: { id: true },
        })

        if (!user) {
          console.warn("Webhook: user not found for email", customer.email)
          break
        }

        // Deactivate any existing subscription
        await prisma.subscription.updateMany({
          where:  { userId: user.id, status: "ACTIVE" },
          data:   { status: "CANCELLED", cancelledAt: new Date() },
        })

        // Create new subscription record
        await prisma.subscription.create({
          data: {
            userId:              user.id,
            plan:                planName,
            status:              "ACTIVE",
            paystackSubCode:     subscription_code,
            paystackCustomerCode: customer.customer_code,
            paystackEmailToken:  email_token,
            amount,
            nextBillingDate:     next_payment_date ? new Date(next_payment_date) : null,
          },
        })

        // Update user plan
        await prisma.user.update({
          where: { id: user.id },
          data:  {
            plan:                planName,
            paystackCustomerCode: customer.customer_code,
            // Plan expires 1 month after next billing date as a safety buffer
            planExpiresAt:       next_payment_date
              ? new Date(new Date(next_payment_date).getTime() + 7 * 24 * 60 * 60 * 1000)
              : null,
          },
        })

        console.log(`[Webhook] Subscription created: ${planName} for user ${user.id}`)
        break
      }

      // ── Invoice paid (subscription renewed) ───────────────
      case "invoice.update": {
        const { subscription, paid_at, next_payment_date } = data

        if (!subscription?.subscription_code) break

        const sub = await prisma.subscription.findFirst({
          where:  { paystackSubCode: subscription.subscription_code },
          select: { id: true, userId: true },
        })

        if (!sub) break

        // Extend subscription
        await prisma.subscription.update({
          where: { id: sub.id },
          data:  {
            status:         "ACTIVE",
            nextBillingDate: next_payment_date ? new Date(next_payment_date) : null,
          },
        })

        await prisma.user.update({
          where: { id: sub.userId },
          data:  {
            planExpiresAt: next_payment_date
              ? new Date(new Date(next_payment_date).getTime() + 7 * 24 * 60 * 60 * 1000)
              : null,
          },
        })

        console.log(`[Webhook] Subscription renewed for user ${sub.userId}`)
        break
      }

      // ── Subscription disabled (cancelled) ─────────────────
      case "subscription.disable": {
        const { subscription_code } = data

        const sub = await prisma.subscription.findFirst({
          where:  { paystackSubCode: subscription_code },
          select: { id: true, userId: true },
        })

        if (!sub) break

        await prisma.subscription.update({
          where: { id: sub.id },
          data:  { status: "CANCELLED", cancelledAt: new Date() },
        })

        // Downgrade user to free immediately
        await prisma.user.update({
          where: { id: sub.userId },
          data:  { plan: "free", planExpiresAt: null },
        })

        console.log(`[Webhook] Subscription cancelled for user ${sub.userId}`)
        break
      }

      // ── Invoice payment failed ─────────────────────────────
      case "invoice.payment_failed": {
        const { subscription } = data
        if (!subscription?.subscription_code) break

        const sub = await prisma.subscription.findFirst({
          where:  { paystackSubCode: subscription.subscription_code },
          select: { id: true, userId: true },
        })

        if (!sub) break

        await prisma.subscription.update({
          where: { id: sub.id },
          data:  { status: "PAST_DUE" },
        })

        console.log(`[Webhook] Payment failed for user ${sub.userId}`)
        // TODO: send email to planner notifying them of failed payment
        break
      }

      default:
        console.log(`[Webhook] Unhandled event: ${event.event}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("Webhook error:", err)
    // Always return 200 to Paystack — otherwise they retry endlessly
    return NextResponse.json({ received: true })
  }
}