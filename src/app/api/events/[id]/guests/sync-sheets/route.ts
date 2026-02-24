// ─────────────────────────────────────────────
// src/app/api/events/[id]/guests/sync-sheets/route.ts
//
// POST — pull guest names from a public
//        Google Sheet and sync into the
//        event's guest list.
//
// The sheet must be shared as "Anyone with
// the link can view". The system converts
// the sheet URL to a CSV export URL and
// fetches the data directly — no OAuth needed.
//
// Auto-detects columns: First Name, Last Name,
// Phone (flexible header matching).
//
// Saves the sheet URL against the event so
// it can be re-synced automatically every
// 30 minutes via a cron job (coming later).
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-server"

// Convert a Google Sheets share URL to a CSV export URL
function toCsvExportUrl(sheetsUrl: string): string | null {
  try {
    // Extract the spreadsheet ID
    const match = sheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (!match) return null
    const spreadsheetId = match[1]

    // Extract sheet (gid) if present, default to 0
    const gidMatch = sheetsUrl.match(/[?&]gid=(\d+)/)
    const gid = gidMatch ? gidMatch[1] : "0"

    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`
  } catch {
    return null
  }
}

// Parse CSV text into rows
function parseCsv(text: string): string[][] {
  return text.trim().split(/\r?\n/).map(line => {
    const cols: string[] = []
    let current = ""
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQuotes = !inQuotes
      } else if (line[i] === "," && !inQuotes) {
        cols.push(current.trim())
        current = ""
      } else {
        current += line[i]
      }
    }
    cols.push(current.trim())
    return cols
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.email) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const planner = await prisma.user.findUnique({
      where: { email: session.email },
      select: { id: true },
    })
    if (!planner) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const event = await prisma.event.findFirst({
      where: { id, plannerId: planner.id },
      select: { id: true, inviteModel: true },
    })
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const body = await req.json()
    const { sheetsUrl } = body

    if (!sheetsUrl?.includes("docs.google.com/spreadsheets")) {
      return NextResponse.json({ error: "Invalid Google Sheets URL" }, { status: 400 })
    }

    const csvUrl = toCsvExportUrl(sheetsUrl)
    if (!csvUrl) {
      return NextResponse.json({ error: "Could not parse Google Sheets URL" }, { status: 400 })
    }

    // Fetch the CSV from Google Sheets
    const fetchRes = await fetch(csvUrl, {
      headers: { "User-Agent": "EventFlow/1.0" },
    })

    if (!fetchRes.ok) {
      return NextResponse.json({
        error: "Could not access the sheet. Make sure it is shared as 'Anyone with the link can view'."
      }, { status: 400 })
    }

    const csvText = await fetchRes.text()
    const rows    = parseCsv(csvText)

    if (rows.length < 2) {
      return NextResponse.json({ error: "Sheet appears to be empty" }, { status: 400 })
    }

    // Auto-detect column indices from header row
    const header = rows[0].map(h => h.toLowerCase().replace(/[^a-z]/g, ""))
    const fnIdx  = header.findIndex(h => h.includes("first") || h === "firstname" || h === "fname")
    const lnIdx  = header.findIndex(h => h.includes("last")  || h === "lastname"  || h === "lname")
    const phIdx  = header.findIndex(h => h.includes("phone") || h === "mobile"    || h === "tel")

    if (fnIdx === -1 || lnIdx === -1) {
      return NextResponse.json({
        error: "Sheet must have 'First Name' and 'Last Name' columns."
      }, { status: 400 })
    }

    // Parse guest rows
    const newGuests = rows.slice(1)
      .map(cols => ({
        firstName: (cols[fnIdx] ?? "").trim(),
        lastName:  (cols[lnIdx] ?? "").trim(),
        phone:     phIdx !== -1 ? (cols[phIdx] ?? "").trim() : "",
      }))
      .filter(r => r.firstName && r.lastName)
      .slice(0, 500) // safety cap

    if (!newGuests.length) {
      return NextResponse.json({ error: "No valid rows found in sheet" }, { status: 400 })
    }

    // Load existing guests to skip duplicates
    const existing = await prisma.guest.findMany({
      where:  { eventId: id },
      select: { firstName: true, lastName: true, phone: true },
    })

    const existingKeys   = new Set(existing.map(g => `${g.firstName.toLowerCase()}|${g.lastName.toLowerCase()}`))
    const existingPhones = new Set(existing.filter(g => g.phone).map(g => g.phone!))

    const toCreate = newGuests.filter(r => {
      const key = `${r.firstName.toLowerCase()}|${r.lastName.toLowerCase()}`
      if (existingKeys.has(key)) return false
      if (r.phone && existingPhones.has(r.phone)) return false
      return true
    })

    if (toCreate.length > 0) {
      await prisma.guest.createMany({
        data: toCreate.map(r => ({
          eventId:      id,
          firstName:    r.firstName,
          lastName:     r.lastName,
          phone:        r.phone || null,
          inviteToken:  event.inviteModel === "CLOSED"
            ? `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
            : null,
          inviteChannel: "MANUAL" as const,
          rsvpStatus:   "PENDING" as const,
        })),
        skipDuplicates: true,
      })
    }

    // TODO: Save sheetsUrl to event record for auto re-sync
    // await prisma.event.update({ where: { id }, data: { syncedSheetsUrl: sheetsUrl, lastSyncedAt: new Date() } })

    return NextResponse.json({
      imported: toCreate.length,
      skipped:  newGuests.length - toCreate.length,
      total:    newGuests.length,
    })
  } catch (error) {
    console.error("Sheets sync error:", error)
    return NextResponse.json({ error: "Sync failed" }, { status: 500 })
  }
}