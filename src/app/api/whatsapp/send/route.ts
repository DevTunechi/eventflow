// ─────────────────────────────────────────────
// src/app/api/whatsapp/send/route.ts
//
// POST — send a WhatsApp message via the
//        Meta Cloud API (WhatsApp Business
//        API, hosted by Meta — free tier).
//
// Used by:
//   - send-invites route (bulk invites)
//   - QR code delivery after RSVP
//   - Test message from settings page
//
// Message types supported:
//   - text: plain WhatsApp text message
//   - template: pre-approved Meta template
//     (required for first outbound message
//      to a number that hasn't messaged you)
//
// Rate limits (Meta free tier):
//   - 1,000 unique recipients per day
//   - No per-minute limit on Cloud API
//
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-server"
import crypto from "crypto"

// ── Decrypt helper (mirrors setup/route.ts) ───

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? ""

function decrypt(ciphertext: string): string {
  if (!ENCRYPTION_KEY || !ciphertext.includes(":")) return ciphertext
  try {
    const [ivHex, tagHex, dataHex] = ciphertext.split(":")
    const key      = Buffer.from(ENCRYPTION_KEY, "hex")
    const iv       = Buffer.from(ivHex,  "hex")
    const tag      = Buffer.from(tagHex, "hex")
    const data     = Buffer.from(dataHex,"hex")
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(data).toString("utf8") + decipher.final("utf8")
  } catch {
    return ciphertext
  }
}

// ── Normalise phone number ────────────────────
// Meta requires E.164 format: +2348012345678
// Strip spaces, dashes, parentheses.
// Prepend +234 if Nigerian local format detected.

function normalisePhone(raw: string): string {
  let phone = raw.replace(/[\s\-().]/g, "")

  // Already has + prefix
  if (phone.startsWith("+")) return phone

  // Nigerian local format: 0801…  → +234801…
  if (phone.startsWith("0") && phone.length === 11) {
    return `+234${phone.slice(1)}`
  }

  // Nigerian without leading zero: 801… → +234801…
  if (phone.startsWith("234")) return `+${phone}`

  // Assume international, just prepend +
  return `+${phone}`
}

// ── Core send function ────────────────────────
// Exported so other routes (send-invites) can
// call it directly without going through HTTP.

export async function sendWhatsAppMessage({
  accessToken,
  phoneNumberId,
  to,
  message,
  previewUrl = false,
}: {
  accessToken:   string
  phoneNumberId: string
  to:            string
  message:       string
  previewUrl?:   boolean
}): Promise<{ success: boolean; messageId?: string; error?: string }> {

  const phone = normalisePhone(to)

  const payload = {
    messaging_product: "whatsapp",
    recipient_type:    "individual",
    to:                phone,
    type:              "text",
    text: {
      preview_url: previewUrl,
      body:        message,
    },
  }

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    }
  )

  const data = await res.json()

  if (!res.ok) {
    const errMsg = data?.error?.message ?? `Meta API error ${res.status}`
    console.error("WhatsApp send error:", errMsg, data)
    return { success: false, error: errMsg }
  }

  const messageId = data?.messages?.[0]?.id
  return { success: true, messageId }
}

// ── POST /api/whatsapp/send ───────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const user = await (prisma.user as any).findUnique({
      where:  { email: session.email },
      select: {
        id:              true,
        waAccessToken:   true,
        waPhoneNumberId: true,
        waMessagesSent:  true,
      },
    })

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    if (!user.waAccessToken || !user.waPhoneNumberId) {
      return NextResponse.json(
        { error: "WhatsApp not connected. Go to Settings → WhatsApp to set it up." },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { to, message, test } = body

    if (!to?.trim())      return NextResponse.json({ error: "Recipient phone number required" }, { status: 400 })
    if (!message?.trim()) return NextResponse.json({ error: "Message body required" },           { status: 400 })

    // Decrypt the access token
    const accessToken = decrypt(user.waAccessToken)

    const result = await sendWhatsAppMessage({
      accessToken,
      phoneNumberId: user.waPhoneNumberId,
      to:            to.trim(),
      message:       message.trim(),
      previewUrl:    true,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 502 })
    }

    // Increment message counter (skip for tests)
    if (!test) {
      await (prisma.user as any).update({
        where: { id: user.id },
        data:  { waMessagesSent: { increment: 1 } },
      })
    }

    return NextResponse.json({ success: true, messageId: result.messageId })
  } catch (error) {
    console.error("WhatsApp send route error:", error)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}