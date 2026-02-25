// ─────────────────────────────────────────────
// src/lib/whatsapp.ts
//
// Shared WhatsApp Business API utility.
// Imported by:
//   - /api/whatsapp/send/route.ts
//   - /api/events/[id]/guests/send-invites/route.ts
// ─────────────────────────────────────────────

import crypto from "crypto"

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? ""

// ── Encrypt / Decrypt ─────────────────────────

export function encrypt(plaintext: string): string {
  if (!ENCRYPTION_KEY) return plaintext
  const key     = Buffer.from(ENCRYPTION_KEY, "hex")
  const iv      = crypto.randomBytes(12)
  const cipher  = crypto.createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag     = cipher.getAuthTag()
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`
}

export function decrypt(ciphertext: string): string {
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

// ── Normalise phone to E.164 ──────────────────
// Handles Nigerian local format automatically.

export function normalisePhone(raw: string): string {
  let phone = raw.replace(/[\s\-().]/g, "")
  if (phone.startsWith("+")) return phone
  if (phone.startsWith("0") && phone.length === 11) return `+234${phone.slice(1)}`
  if (phone.startsWith("234")) return `+${phone}`
  return `+${phone}`
}

// ── Core send function ────────────────────────

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

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type:    "individual",
        to:                phone,
        type:              "text",
        text: {
          preview_url: previewUrl,
          body:        message,
        },
      }),
    }
  )

  const data = await res.json()

  if (!res.ok) {
    const errMsg = data?.error?.message ?? `Meta API error ${res.status}`
    console.error("WhatsApp send error:", errMsg, data)
    return { success: false, error: errMsg }
  }

  return { success: true, messageId: data?.messages?.[0]?.id }
}