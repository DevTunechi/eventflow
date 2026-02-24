// ─────────────────────────────────────────────
// src/app/api/upload/invitation-card/route.ts
//
// Accepts a multipart/form-data POST with a
// single "file" field (JPEG, PNG, or PDF, max 10MB).
//
// Uploads to the EventFlow service account Drive,
// organised by planner email and event name.
//
// Returns: { url: string, fileId: string }
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { uploadToDrive } from "@/lib/drive-upload"

const MAX_SIZE        = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES   = ["image/jpeg", "image/png", "application/pdf"]
const EXT_MAP: Record<string, string> = {
  "image/jpeg":      "jpg",
  "image/png":       "png",
  "application/pdf": "pdf",
}

export async function POST(request: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────
    const session = await auth()
    if (!session?.email) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    // ── Parse multipart form ────────────────────
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
    }

    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // ── Validate type ───────────────────────────
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, or PDF files are accepted." },
        { status: 422 }
      )
    }

    // ── Validate size ───────────────────────────
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File must be under 10 MB." },
        { status: 422 }
      )
    }

    // ── Get event name for folder organisation ──
    // Optional: pass eventName in the form, fallback to "Untitled Event"
    const eventName = (formData.get("eventName") as string | null) ?? "Untitled Event"

    // ── Convert File → Buffer ───────────────────
    const arrayBuffer = await file.arrayBuffer()
    const buffer      = Buffer.from(arrayBuffer)

    // ── Build a clean filename ──────────────────
    const ext      = EXT_MAP[file.type] ?? "bin"
    const filename = `invitation-card-${Date.now()}.${ext}`

    // ── Upload to Drive ─────────────────────────
    const { url, fileId } = await uploadToDrive({
      buffer,
      filename,
      mimeType:     file.type,
      plannerEmail: session.email,
      eventName,
    })

    return NextResponse.json({ url, fileId }, { status: 200 })

  } catch (error) {
    console.error("Invitation card upload error:", error)
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    )
  }
}

// Disable Next.js body parser — needed for multipart
export const config = {
  api: { bodyParser: false },
}