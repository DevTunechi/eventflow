// ─────────────────────────────────────────────
// src/app/api/whatsapp/setup/route.ts
//
// POST   — save WhatsApp Business credentials
// DELETE — disconnect / remove credentials
//
// Credentials stored encrypted in the User
// record. We use AES-256-GCM via Node's
// built-in crypto module — no extra deps.
//
// Fields stored on User model (add these
// to your schema if not present):
//   waAccessToken     String?
//   waPhoneNumberId   String?
//   waWabaId          String?
//   waDisplayName     String?
//   waPhoneNumber     String?
//   waBusinessName    String?
//   waConnectedAt     DateTime?
//   waMessagesSent    Int @default(0)
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-server"
import crypto from "crypto"

// ── Encryption helpers ────────────────────────
// Uses AES-256-GCM with a random IV per value.
// ENCRYPTION_KEY must be a 64-char hex string
// (32 bytes). Set in your .env:
//   ENCRYPTION_KEY=<run: openssl rand -hex 32>

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? ""

function encrypt(plaintext: string): string {
  if (!ENCRYPTION_KEY) return plaintext // fallback if key not set (dev only)
  const key = Buffer.from(ENCRYPTION_KEY, "hex")
  const iv  = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`
}

function decrypt(ciphertext: string): string {
  if (!ENCRYPTION_KEY) return ciphertext
  try {
    const [ivHex, tagHex, dataHex] = ciphertext.split(":")
    const key       = Buffer.from(ENCRYPTION_KEY, "hex")
    const iv        = Buffer.from(ivHex,  "hex")
    const tag       = Buffer.from(tagHex, "hex")
    const data      = Buffer.from(dataHex,"hex")
    const decipher  = crypto.createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(data).toString("utf8") + decipher.final("utf8")
  } catch {
    return ciphertext // return as-is if decryption fails
  }
}

export { decrypt } // exported so send/route.ts can use it

// ── GET planner ───────────────────────────────

async function getPlanner(email: string) {
  return prisma.user.findUnique({
    where:  { email },
    select: { id: true },
  })
}

// ── POST /api/whatsapp/setup ──────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const planner = await getPlanner(session.email)
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const body = await req.json()
    const { accessToken, phoneNumberId, wabaId, displayName, phoneNumber } = body

    if (!accessToken?.trim() || !phoneNumberId?.trim() || !wabaId?.trim()) {
      return NextResponse.json(
        { error: "accessToken, phoneNumberId and wabaId are required" },
        { status: 400 }
      )
    }

    // Verify the token works by calling Meta's API
    // before saving — catch bad credentials early
    const verifyRes = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId.trim()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken.trim()}`,
        },
      }
    )

    if (!verifyRes.ok) {
      const errData = await verifyRes.json().catch(() => ({}))
      const message = errData?.error?.message ?? "Invalid credentials"
      return NextResponse.json(
        { error: `Meta API rejected the credentials: ${message}` },
        { status: 400 }
      )
    }

    const metaData = await verifyRes.json()
    const verifiedName = metaData.verified_name ?? displayName?.trim() ?? null

    // Encrypt the access token before storing
    const encryptedToken = encrypt(accessToken.trim())

    // Update user record
    // Note: If your schema doesn't have these fields yet,
    // add them and run: npx prisma migrate dev --name add-whatsapp
    await (prisma.user as any).update({
      where: { id: planner.id },
      data:  {
        waAccessToken:   encryptedToken,
        waPhoneNumberId: phoneNumberId.trim(),
        waWabaId:        wabaId.trim(),
        waDisplayName:   verifiedName,
        waPhoneNumber:   phoneNumber?.trim() || metaData.display_phone_number || null,
        waBusinessName:  metaData.business_name ?? null,
        waConnectedAt:   new Date(),
      },
    })

    return NextResponse.json({ success: true, displayName: verifiedName })
  } catch (error) {
    console.error("WhatsApp setup error:", error)
    return NextResponse.json({ error: "Failed to save credentials" }, { status: 500 })
  }
}

// ── DELETE /api/whatsapp/setup ────────────────

export async function DELETE(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const planner = await getPlanner(session.email)
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })

    await (prisma.user as any).update({
      where: { id: planner.id },
      data:  {
        waAccessToken:   null,
        waPhoneNumberId: null,
        waWabaId:        null,
        waDisplayName:   null,
        waPhoneNumber:   null,
        waBusinessName:  null,
        waConnectedAt:   null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("WhatsApp disconnect error:", error)
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 })
  }
}