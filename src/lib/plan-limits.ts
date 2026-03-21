// src/lib/plan-limits.ts
// Plan enforcement — checks what a planner can do
// based on their current plan and any top-ups.
//
// Used by API routes before allowing:
//   - Publishing an event
//   - Adding a guest (checks guest cap)
//   - Enabling vendor portals
//   - Sending WhatsApp QR
//   - Using priority check-in tools

import { prisma } from "@/lib/prisma"

// ── Plan definitions ──────────────────────────────────────────

export const PLANS = {
  free: {
    name:          "Free",
    maxEvents:     1,
    maxGuests:     100,
    whatsapp:      false,
    vendors:       false,
    csvImport:     false,
    analytics:     false,
    priorityCheckin: false,
  },
  starter: {
    name:          "Starter",
    maxEvents:     3,
    maxGuests:     500,
    whatsapp:      true,   // basic WhatsApp
    vendors:       true,
    csvImport:     false,
    analytics:     false,
    priorityCheckin: false,
  },
  pro: {
    name:          "Pro",
    maxEvents:     Infinity,
    maxGuests:     Infinity,
    whatsapp:      true,
    vendors:       true,
    csvImport:     true,
    analytics:     true,
    priorityCheckin: true,
  },
} as const

export type PlanKey = keyof typeof PLANS

// ── Top-up prices (kobo) ──────────────────────────────────────

export const TOPUP_PRICES = {
  GUESTS:   200_000,  // ₦2,000
  WHATSAPP: 150_000,  // ₦1,500
  CHECKIN:  250_000,  // ₦2,500
} as const

export const TOPUP_LABELS = {
  GUESTS:   "Extra Guests Pack (+200 guests)",
  WHATSAPP: "WhatsApp QR Delivery",
  CHECKIN:  "Priority Check-in Tools",
} as const

// ── Enforcement result type ───────────────────────────────────

export interface EnforcementResult {
  allowed:     boolean
  hardBlocked: boolean   // true = completely blocked
  reason?:     string    // shown to planner
  upgradeHint?: string   // what plan/top-up they need
}

// ── Get planner's effective plan ──────────────────────────────

export async function getPlanKey(userId: string): Promise<PlanKey> {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { plan: true, planExpiresAt: true },
  })

  if (!user) return "free"

  // If plan has expired, fall back to free
  if (user.planExpiresAt && new Date() > new Date(user.planExpiresAt)) {
    return "free"
  }

  const plan = user.plan as PlanKey
  return PLANS[plan] ? plan : "free"
}

// ── Get effective guest cap for an event ─────────────────────
// Base plan cap + any stacked guest top-up packs

export async function getEffectiveGuestCap(
  userId:  string,
  eventId: string
): Promise<number> {
  const planKey = await getPlanKey(userId)
  const baseCap = PLANS[planKey].maxGuests

  if (baseCap === Infinity) return Infinity

  // Sum up all active guest top-up packs for this event
  const topUps = await prisma.eventTopUp.findMany({
    where:  { userId, eventId, type: "GUESTS", status: "ACTIVE" },
    select: { guestBonus: true },
  })

  const bonus = topUps.reduce((sum, t) => sum + (t.guestBonus ?? 200), 0)
  return baseCap + bonus
}

// ── Check: can planner publish an event? ─────────────────────

export async function canPublishEvent(userId: string): Promise<EnforcementResult> {
  const planKey = await getPlanKey(userId)
  const plan    = PLANS[planKey]

  if (plan.maxEvents === Infinity) return { allowed: true, hardBlocked: false }

  // Count currently published/ongoing events
  const activeCount = await prisma.event.count({
    where: {
      plannerId: userId,
      status:    { in: ["PUBLISHED", "ONGOING"] },
    },
  })

  if (activeCount < plan.maxEvents) {
    return { allowed: true, hardBlocked: false }
  }

  // Soft warning at limit, hard block past limit
  const hardBlocked = activeCount >= plan.maxEvents

  return {
    allowed:     false,
    hardBlocked,
    reason:      `Your ${plan.name} plan allows ${plan.maxEvents} active event${plan.maxEvents !== 1 ? "s" : ""}. You currently have ${activeCount}.`,
    upgradeHint: planKey === "free"
      ? "Upgrade to Starter (₦5,000/mo) for up to 3 events, or Pro (₦15,000/mo) for unlimited."
      : planKey === "starter"
      ? "Upgrade to Pro (₦15,000/mo) for unlimited active events."
      : undefined,
  }
}

// ── Check: can planner add another guest? ────────────────────

export async function canAddGuest(
  userId:  string,
  eventId: string
): Promise<EnforcementResult> {
  const [effectiveCap, currentCount] = await Promise.all([
    getEffectiveGuestCap(userId, eventId),
    prisma.guest.count({ where: { eventId } }),
  ])

  if (effectiveCap === Infinity || currentCount < effectiveCap) {
    return { allowed: true, hardBlocked: false }
  }

  const planKey = await getPlanKey(userId)
  const plan    = PLANS[planKey]

  // Warn at 90% capacity, hard block at cap
  const atWarnThreshold = currentCount >= Math.floor(effectiveCap * 0.9)
  const hardBlocked     = currentCount >= effectiveCap

  return {
    allowed:     !hardBlocked,
    hardBlocked,
    reason:      `This event has reached its guest limit (${effectiveCap} guests on your ${plan.name} plan).`,
    upgradeHint: "Purchase an Extra Guests Pack (₦2,000) to add 200 more guests to this event, or upgrade your plan.",
  }
}

// ── Check: can planner use vendor portals? ───────────────────

export async function canUseVendors(userId: string): Promise<EnforcementResult> {
  const planKey = await getPlanKey(userId)
  const plan    = PLANS[planKey]

  if (plan.vendors) return { allowed: true, hardBlocked: false }

  return {
    allowed:     false,
    hardBlocked: true,
    reason:      "Vendor portals are not available on the Free plan.",
    upgradeHint: "Upgrade to Starter (₦5,000/mo) or Pro (₦15,000/mo) to add vendors.",
  }
}

// ── Check: can planner send WhatsApp QR? ────────────────────

export async function canSendWhatsApp(
  userId:  string,
  eventId: string
): Promise<EnforcementResult> {
  const planKey = await getPlanKey(userId)
  const plan    = PLANS[planKey]

  // Pro plan — always allowed
  if (planKey === "pro") return { allowed: true, hardBlocked: false }

  // Starter plan — allowed if they have a WhatsApp top-up for this event
  if (plan.whatsapp) {
    const topUp = await prisma.eventTopUp.findFirst({
      where: { userId, eventId, type: "WHATSAPP", status: "ACTIVE" },
    })
    if (topUp) return { allowed: true, hardBlocked: false }

    return {
      allowed:     false,
      hardBlocked: true,
      reason:      "WhatsApp QR delivery requires a top-up for this event.",
      upgradeHint: "Purchase WhatsApp QR Delivery (₦1,500) to send QR codes via WhatsApp for this event.",
    }
  }

  // Free plan — not allowed at all
  return {
    allowed:     false,
    hardBlocked: true,
    reason:      "WhatsApp QR delivery is not available on the Free plan.",
    upgradeHint: "Upgrade to Starter and purchase a WhatsApp top-up, or go Pro for full WhatsApp access.",
  }
}

// ── Check: can planner use priority check-in? ────────────────

export async function canUsePriorityCheckin(
  userId:  string,
  eventId: string
): Promise<EnforcementResult> {
  const planKey = await getPlanKey(userId)

  // Pro plan — always allowed
  if (planKey === "pro") return { allowed: true, hardBlocked: false }

  // Any plan — allowed if they have a check-in top-up for this event
  const topUp = await prisma.eventTopUp.findFirst({
    where: { userId, eventId, type: "CHECKIN", status: "ACTIVE" },
  })

  if (topUp) return { allowed: true, hardBlocked: false }

  return {
    allowed:     false,
    hardBlocked: true,
    reason:      "Priority check-in tools require a top-up for this event.",
    upgradeHint: "Purchase Priority Check-in Tools (₦2,500) for this event, or upgrade to Pro.",
  }
}

// ── Check: can planner use CSV import? ───────────────────────

export async function canUseCsvImport(userId: string): Promise<EnforcementResult> {
  const planKey = await getPlanKey(userId)
  if (PLANS[planKey].csvImport) return { allowed: true, hardBlocked: false }

  return {
    allowed:     false,
    hardBlocked: true,
    reason:      "CSV & Google Sheets import is a Pro feature.",
    upgradeHint: "Upgrade to Pro (₦15,000/mo) to import guests from CSV or Google Sheets.",
  }
}