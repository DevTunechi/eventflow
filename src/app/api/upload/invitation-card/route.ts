// ─────────────────────────────────────────────
// FILE: src/app/api/upload/invitation-card/route.ts
//
// Uploads invitation card images to Google Drive.
// Returns a publicly accessible URL stored in
// the Event.invitationCard field.
//
// Uses service account credentials from env:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL
//   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
//   GOOGLE_DRIVE_ROOT_FOLDER_ID
//
// Flow:
//   1. Receive multipart/form-data with `file` field
//   2. Upload to Google Drive under root folder
//   3. Set file permission to public (anyone with link)
//   4. Return the public view URL
//
// Called by events/new/page.tsx and events/[id]/edit/page.tsx
// before the event create/update API call.
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"

// Google Drive API endpoints
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"
const DRIVE_FILES_URL  = "https://www.googleapis.com/drive/v3/files"

// ── Get Google OAuth2 access token via service account ───────
// Uses JWT assertion flow — no external library needed.

async function getAccessToken(): Promise<string> {
  const email      = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!
    .replace(/\\n/g, "\n") // Fix escaped newlines from .env

  const now    = Math.floor(Date.now() / 1000)
  const expiry = now + 3600

  // Build JWT header + payload
  const header  = { alg: "RS256", typ: "JWT" }
  const payload = {
    iss:   email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud:   "https://oauth2.googleapis.com/token",
    exp:   expiry,
    iat:   now,
  }

  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url")

  const signingInput = `${encode(header)}.${encode(payload)}`

  // Import private key and sign
  const keyData = privateKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "")

  const binaryKey = Buffer.from(keyData, "base64")

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    Buffer.from(signingInput)
  )

  const jwt = `${signingInput}.${Buffer.from(signature).toString("base64url")}`

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:  jwt,
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    throw new Error(`Failed to get Google access token: ${err}`)
  }

  const { access_token } = await tokenRes.json()
  return access_token
}

// ── POST /api/upload/invitation-card ─────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the planner
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    // 2. Parse the uploaded file from form data
    const formData = await req.formData()
    const file     = formData.get("file") as File | null
    const eventName = (formData.get("eventName") as string) || "Untitled Event"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // 3. Validate file type and size
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WEBP, and PDF files are accepted." },
        { status: 400 }
      )
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File must be under 10MB." },
        { status: 400 }
      )
    }

    // 4. Get Google Drive access token
    const accessToken = await getAccessToken()

    // 5. Build a clean filename
    const ext      = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1]
    const safeName = eventName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)
    const fileName = `invitation-${safeName}-${Date.now()}.${ext}`

    // 6. Upload to Google Drive using multipart upload
    //    Metadata part: file name + parent folder
    //    Media part: actual file bytes
    const metadata = JSON.stringify({
      name:    fileName,
      parents: [process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!],
    })

    const fileBuffer  = await file.arrayBuffer()
    const boundary    = "---EventFlowBoundary"

    // Build multipart body manually (no external library)
    const metaPart =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${metadata}\r\n`

    const filePart =
      `--${boundary}\r\n` +
      `Content-Type: ${file.type}\r\n\r\n`

    const closing = `\r\n--${boundary}--`

    const metaBytes    = new TextEncoder().encode(metaPart)
    const filePartBytes = new TextEncoder().encode(filePart)
    const closingBytes = new TextEncoder().encode(closing)
    const fileBytes    = new Uint8Array(fileBuffer)

    // Combine all parts into one body
    const bodyLength = metaBytes.length + filePartBytes.length + fileBytes.length + closingBytes.length
    const body       = new Uint8Array(bodyLength)
    let offset       = 0
    body.set(metaBytes,     offset); offset += metaBytes.length
    body.set(filePartBytes, offset); offset += filePartBytes.length
    body.set(fileBytes,     offset); offset += fileBytes.length
    body.set(closingBytes,  offset)

    const uploadRes = await fetch(DRIVE_UPLOAD_URL, {
      method:  "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": String(bodyLength),
      },
      body: body,
    })

    if (!uploadRes.ok) {
      const err = await uploadRes.text()
      console.error("Drive upload error:", err)
      throw new Error("Google Drive upload failed")
    }

    const { id: fileId } = await uploadRes.json()

    // 7. Make the file publicly readable (anyone with link)
    const permRes = await fetch(`${DRIVE_FILES_URL}/${fileId}/permissions`, {
      method:  "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    })

    if (!permRes.ok) {
      console.error("Drive permission error:", await permRes.text())
      // Non-fatal — file uploaded but may not be publicly accessible
    }

    // 8. Return the public URL
    //    Google Drive direct view URL format
    const publicUrl = `https://drive.google.com/uc?export=view&id=${fileId}`

    return NextResponse.json({ url: publicUrl }, { status: 200 })
  } catch (err) {
    console.error("[POST /api/upload/invitation-card]", err)
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    )
  }
}