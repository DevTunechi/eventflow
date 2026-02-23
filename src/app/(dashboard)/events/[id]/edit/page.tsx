"use client"

// ─────────────────────────────────────────────
// src/app/(dashboard)/events/[id]/edit/page.tsx
// Pre-populated 6-step edit form.
// Mirrors /events/new exactly — PATCH instead of POST,
// all fields pre-filled from existing event data.
// Invitation card: real file upload with canvas color extraction.
// ─────────────────────────────────────────────

import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import Link from "next/link"
import Image from "next/image"

// ── Types ──────────────────────────────────────

type SeatingType = "PRE_ASSIGNED" | "DYNAMIC"
type MenuAccess  = "PRE_EVENT"    | "AT_EVENT"
type InviteModel = "OPEN"         | "CLOSED"
type MenuCat     = "APPETIZER"    | "MAIN" | "DRINK" | "DESSERT" | "SPECIAL"

interface GuestTier {
  id:          string
  name:        string
  color:       string
  seatingType: SeatingType
  menuAccess:  MenuAccess
  maxGuests:   string
  tablePrefix: string
}

interface MenuItemRow {
  id:          string
  category:    MenuCat
  name:        string
  description: string
}

interface FormData {
  name:                 string
  eventType:            string
  eventDate:            string
  startTime:            string
  endTime:              string
  venueName:            string
  venueAddress:         string
  venueCapacity:        string
  description:          string
  invitationCard:       string
  inviteModel:          InviteModel
  requireOtp:           boolean
  rsvpDeadline:         string
  brandColor:           string
  tiers:                GuestTier[]
  totalTables:          string
  seatsPerTable:        string
  releaseReservedAfter: string
  menuItems:            MenuItemRow[]
}

// ── Constants ──────────────────────────────────

const STEPS = [
  { n: 1, label: "Details"  },
  { n: 2, label: "Invites"  },
  { n: 3, label: "Tiers"    },
  { n: 4, label: "Seating"  },
  { n: 5, label: "Menu"     },
  { n: 6, label: "Review"   },
]

const EVENT_TYPES = [
  { value: "WEDDING",     label: "Wedding"     },
  { value: "BIRTHDAY",    label: "Birthday"    },
  { value: "CORPORATE",   label: "Corporate"   },
  { value: "BURIAL",      label: "Burial"      },
  { value: "ANNIVERSARY", label: "Anniversary" },
  { value: "OTHER",       label: "Other"       },
]

const TIER_COLORS = ["#b48c3c","#4a9eff","#4caf7d","#a78bfa","#f0a500","#ef4444","#38bdf8"]

const MENU_CATEGORIES: { value: MenuCat; label: string; desc: string }[] = [
  { value: "APPETIZER", label: "Appetizer",    desc: "Starters & small chops"    },
  { value: "MAIN",      label: "Main Course",  desc: "Rice, swallow, proteins"   },
  { value: "DRINK",     label: "Drinks",       desc: "Alcoholic & non-alcoholic" },
  { value: "DESSERT",   label: "Dessert",      desc: "Cake, ice cream, pastries" },
  { value: "SPECIAL",   label: "Chef Special", desc: "Custom or signature items" },
]

const uid = () => Math.random().toString(36).slice(2, 9)

// ── Color extraction from image via canvas ──────
function extractDominantColor(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = document.createElement("img")
    const url = URL.createObjectURL(file)
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const canvas = document.createElement("canvas")
      // Sample a 50x50 thumbnail for speed
      canvas.width  = 50
      canvas.height = 50
      const ctx = canvas.getContext("2d")
      if (!ctx) { resolve("#b48c3c"); return }
      ctx.drawImage(img, 0, 0, 50, 50)
      const data = ctx.getImageData(0, 0, 50, 50).data

      // Bucket colors into 32-level bins, find most common non-dark non-grey bucket
      const buckets: Record<string, { count: number; r: number; g: number; b: number }> = {}
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        // Skip very dark pixels
        if (r < 30 && g < 30 && b < 30) continue
        // Skip very grey pixels (all channels close)
        const max = Math.max(r, g, b), min = Math.min(r, g, b)
        if (max - min < 30) continue
        // Bucket key (quantize to 32 levels)
        const key = `${r >> 5},${g >> 5},${b >> 5}`
        if (!buckets[key]) buckets[key] = { count: 0, r: 0, g: 0, b: 0 }
        buckets[key].count++
        buckets[key].r += r
        buckets[key].g += g
        buckets[key].b += b
      }

      const best = Object.values(buckets).sort((a, b) => b.count - a.count)[0]
      if (!best) { resolve("#b48c3c"); return }

      const avgR = Math.round(best.r / best.count)
      const avgG = Math.round(best.g / best.count)
      const avgB = Math.round(best.b / best.count)
      resolve(`#${avgR.toString(16).padStart(2, "0")}${avgG.toString(16).padStart(2, "0")}${avgB.toString(16).padStart(2, "0")}`)
      URL.revokeObjectURL(url)
    }
    img.onerror = () => resolve("#b48c3c")
    img.src = url
  })
}

// ── Component ───────────────────────────────────

export default function EditEventPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const { user } = useAuth()

  const [step,        setStep]        = useState(1)
  const [saving,      setSaving]      = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error,       setError]       = useState("")

  // Card upload state
  const [uploading,     setUploading]     = useState(false)
  const [cardPreview,   setCardPreview]   = useState<string | null>(null)
  const [uploadError,   setUploadError]   = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormData>({
    name: "", eventType: "WEDDING",
    eventDate: "", startTime: "", endTime: "",
    venueName: "", venueAddress: "", venueCapacity: "",
    description: "", invitationCard: "",
    inviteModel: "OPEN", requireOtp: false,
    rsvpDeadline: "", brandColor: "#C9A84C",
    tiers: [],
    totalTables: "", seatsPerTable: "10",
    releaseReservedAfter: "30",
    menuItems: [],
  })

  // ── Load existing event data ──────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const token = await user?.getIdToken()
        const hdrs: Record<string, string> = { "Content-Type": "application/json" }
        if (token) hdrs["Authorization"] = `Bearer ${token}`
        const res = await fetch(`/api/events/${id}`, { headers: hdrs })
        if (!res.ok) throw new Error("Failed to load event")
        const { event } = await res.json()

        // Convert date to yyyy-mm-dd for input[type=date]
        const toDateStr = (d: string | null) => d ? new Date(d).toISOString().slice(0, 10) : ""
        const toTimeStr = (d: string | null) => d ? new Date(d).toISOString().slice(11, 16) : ""

        setForm({
          name:                 event.title          ?? "",
          eventType:            event.eventType       ?? "WEDDING",
          eventDate:            toDateStr(event.date),
          startTime:            toTimeStr(event.date),
          endTime:              event.endDate ? toTimeStr(event.endDate) : "",
          venueName:            event.venue           ?? "",
          venueAddress:         event.city && event.state ? `${event.city}, ${event.state}` : "",
          venueCapacity:        event.venueCapacity   ? String(event.venueCapacity) : "",
          description:          event.description     ?? "",
          invitationCard:       event.coverImage      ?? "",
          inviteModel:          event.inviteModel     ?? "OPEN",
          requireOtp:           event.requireOtp      ?? false,
          rsvpDeadline:         toDateStr(event.rsvpDeadline),
          brandColor:           event.brandColor      ?? "#C9A84C",
          tiers: (event.guestTiers ?? []).map((t: {
            id: string; name: string; color: string;
            seatingType: SeatingType; menuAccess: MenuAccess;
            capacity?: number; tablePrefix?: string | null
          }) => ({
            id:          t.id,
            name:        t.name,
            color:       t.color,
            seatingType: t.seatingType,
            menuAccess:  t.menuAccess,
            maxGuests:   t.capacity ? String(t.capacity) : "",
            tablePrefix: t.tablePrefix ?? "",
          })),
          totalTables:          event.totalTables          ? String(event.totalTables)          : "",
          seatsPerTable:        event.seatsPerTable         ? String(event.seatsPerTable)         : "10",
          releaseReservedAfter: event.releaseReservedAfter  ? String(event.releaseReservedAfter)  : "30",
          menuItems: (event.menuItems ?? []).map((m: {
            id: string; category: MenuCat; name: string; description?: string
          }) => ({
            id:          m.id,
            category:    m.category,
            name:        m.name,
            description: m.description ?? "",
          })),
        })

        if (event.coverImage) setCardPreview(event.coverImage)
      } catch (err) {
        console.error(err)
        setError("Could not load event data.")
      } finally {
        setLoadingData(false)
      }
    }
    load()
  }, [id, user])

  // ── Form helpers ──────────────────────────────

  const setField = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  const updateTier = (id: string, field: keyof GuestTier, value: string) =>
    setField("tiers", form.tiers.map(t => t.id === id ? { ...t, [field]: value } : t))

  const addTier = () =>
    setField("tiers", [...form.tiers, {
      id: uid(), name: "", color: TIER_COLORS[form.tiers.length % TIER_COLORS.length],
      seatingType: "DYNAMIC", menuAccess: "AT_EVENT", maxGuests: "", tablePrefix: "",
    }])

  const removeTier = (id: string) =>
    setField("tiers", form.tiers.filter(t => t.id !== id))

  const addMenuItem = (category: MenuCat) =>
    setField("menuItems", [...form.menuItems, { id: uid(), category, name: "", description: "" }])

  const updateMenuItem = (id: string, field: keyof MenuItemRow, value: string) =>
    setField("menuItems", form.menuItems.map(m => m.id === id ? { ...m, [field]: value } : m))

  const removeMenuItem = (id: string) =>
    setField("menuItems", form.menuItems.filter(m => m.id !== id))

  // ── Card upload handler ───────────────────────

  const handleCardUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload an image file.")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Image must be under 10MB.")
      return
    }
    setUploadError("")
    setUploading(true)

    try {
      // Show local preview immediately
      const localUrl = URL.createObjectURL(file)
      setCardPreview(localUrl)

      // Extract dominant color from image
      const color = await extractDominantColor(file)
      setField("brandColor", color)

      // Upload to your storage (adapt to your storage solution)
      // Here we convert to base64 data URL as a fallback —
      // replace this block with your actual upload logic (e.g. Firebase Storage, Cloudinary, S3)
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        setField("invitationCard", dataUrl)
        setUploading(false)
      }
      reader.onerror = () => {
        setUploadError("Failed to read file.")
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch {
      setUploadError("Upload failed. Please try again.")
      setUploading(false)
    }
  }

  // ── Navigation ────────────────────────────────

  const canProceed = () => step === 1 ? (!!form.name.trim() && !!form.eventDate) : true
  const next = () => { if (canProceed()) setStep(s => Math.min(s + 1, 6)) }
  const back = () => setStep(s => Math.max(s - 1, 1))

  // ── Submit ────────────────────────────────────

  const submit = async (publish: boolean) => {
    setSaving(true)
    setError("")
    try {
      const token = await user?.getIdToken()
      const hdrs: Record<string, string> = { "Content-Type": "application/json" }
      if (token) hdrs["Authorization"] = `Bearer ${token}`

      const res = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: hdrs,
        body: JSON.stringify({
          title:                form.name,
          description:          form.description         || null,
          date:                 form.eventDate && form.startTime
                                  ? `${form.eventDate}T${form.startTime}:00`
                                  : form.eventDate,
          endDate:              form.eventDate && form.endTime
                                  ? `${form.eventDate}T${form.endTime}:00`
                                  : null,
          venue:                form.venueName,
          coverImage:           form.invitationCard      || null,
          brandColor:           form.brandColor          || null,
          inviteModel:          form.inviteModel,
          requireOtp:           form.requireOtp,
          status:               publish ? "PUBLISHED" : "DRAFT",
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      router.push(`/events/${id}`)
    } catch {
      setError("Something went wrong. Please try again.")
      setSaving(false)
    }
  }

  // ── Loading state ─────────────────────────────

  if (loadingData) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", gap: "0.75rem" }}>
      <div style={{ width: 22, height: 22, border: "1.5px solid rgba(180,140,60,0.2)", borderTopColor: "#b48c3c", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ fontSize: "0.82rem", color: "var(--text-3)" }}>Loading event…</span>
    </div>
  )

  // ── Render ────────────────────────────────────

  return (
    <>
      <style>{`
        .ne-root { max-width: 780px; margin: 0 auto; }

        .ne-back {
          display: inline-flex; align-items: center; gap: 0.4rem;
          font-size: 0.775rem; color: var(--text-3);
          text-decoration: none; margin-bottom: 1.75rem; transition: color 0.15s;
        }
        .ne-back:hover { color: var(--text-2); }
        .ne-back svg { width: 14px; height: 14px; }

        .ne-page-heading {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.125rem; font-weight: 300;
          color: var(--text-2); margin-bottom: 1.5rem;
          letter-spacing: -0.01em;
        }
        .ne-page-heading span { color: var(--gold); }

        /* Progress */
        .ne-progress { display: flex; align-items: center; margin-bottom: 2.5rem; }
        .ne-step { display: flex; align-items: center; gap: 0.5rem; flex: 1; position: relative; }
        .ne-step:not(:last-child)::after {
          content: ''; position: absolute;
          left: calc(14px + 0.5rem); right: 0; top: 14px;
          height: 1px; background: var(--border); z-index: 0;
        }
        .ne-step:not(:last-child).done::after { background: var(--gold); opacity: 0.4; }
        .ne-dot {
          width: 28px; height: 28px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.7rem; font-weight: 500;
          flex-shrink: 0; z-index: 1;
          border: 1.5px solid var(--border);
          background: var(--bg-2); color: var(--text-3); transition: all 0.2s;
        }
        .ne-step.active .ne-dot { border-color: var(--gold); background: var(--gold-dim); color: var(--gold); }
        .ne-step.done   .ne-dot { border-color: var(--gold); background: var(--gold); color: #0a0a0a; }
        .ne-step-label { font-size: 0.68rem; color: var(--text-3); letter-spacing: 0.03em; white-space: nowrap; display: none; }
        .ne-step.active .ne-step-label { color: var(--gold); }
        .ne-step.done   .ne-step-label { color: var(--text-2); }
        @media (min-width: 600px) { .ne-step-label { display: block; } }

        /* Card */
        .ne-card { background: var(--bg-2); border: 1px solid var(--border); border-radius: 12px; padding: 2rem; margin-bottom: 1.5rem; }
        .ne-title { font-family: 'Cormorant Garamond', serif; font-size: 1.5rem; font-weight: 300; color: var(--text); letter-spacing: -0.01em; margin-bottom: 0.375rem; }
        .ne-desc { font-size: 0.8rem; color: var(--text-3); font-weight: 300; line-height: 1.6; margin-bottom: 1.75rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); }

        /* Fields */
        .ne-field { margin-bottom: 1.25rem; }
        .ne-label { display: block; font-size: 0.75rem; font-weight: 500; color: var(--text-2); letter-spacing: 0.03em; margin-bottom: 0.4rem; }
        .ne-hint { display: block; font-size: 0.7rem; color: var(--text-3); font-weight: 300; line-height: 1.5; margin-top: 0.3rem; }
        .ne-input, .ne-select, .ne-textarea {
          width: 100%; padding: 0.625rem 0.875rem;
          background: var(--bg-3); border: 1px solid var(--border);
          border-radius: 6px; color: var(--text);
          font-family: 'DM Sans', sans-serif; font-size: 0.825rem;
          transition: border-color 0.15s; outline: none; box-sizing: border-box;
        }
        .ne-input:focus, .ne-select:focus, .ne-textarea:focus { border-color: var(--gold); }
        .ne-textarea { resize: vertical; min-height: 80px; line-height: 1.6; }
        .ne-select option { background: var(--bg-2); }
        .ne-req { color: var(--gold); margin-left: 2px; }
        .ne-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        @media (max-width: 480px) { .ne-row { grid-template-columns: 1fr; } }

        /* Invitation card upload */
        .ne-upload-zone {
          border: 1.5px dashed var(--border); border-radius: 8px;
          padding: 1.5rem; text-align: center; cursor: pointer;
          transition: all 0.2s; background: var(--bg-3); position: relative;
        }
        .ne-upload-zone:hover { border-color: var(--gold); background: rgba(180,140,60,0.04); }
        .ne-upload-zone.dragging { border-color: var(--gold); background: rgba(180,140,60,0.08); }
        .ne-upload-icon { font-size: 1.5rem; margin-bottom: 0.5rem; }
        .ne-upload-text { font-size: 0.8rem; color: var(--text-2); margin-bottom: 0.25rem; }
        .ne-upload-sub  { font-size: 0.7rem; color: var(--text-3); }
        .ne-upload-input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

        .ne-card-preview {
          margin-top: 0.875rem; position: relative;
          border-radius: 6px; overflow: hidden;
          border: 1px solid var(--border); aspect-ratio: 16/9;
        }
        .ne-card-preview-remove {
          position: absolute; top: 0.5rem; right: 0.5rem;
          width: 26px; height: 26px; border-radius: 50%;
          background: rgba(0,0,0,0.7); border: none; color: #fff;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          font-size: 0.8rem; transition: background 0.2s; z-index: 2;
        }
        .ne-card-preview-remove:hover { background: rgba(239,68,68,0.8); }

        .ne-uploading {
          display: flex; align-items: center; gap: 0.5rem;
          font-size: 0.78rem; color: var(--gold); padding: 0.5rem 0;
        }
        .ne-upload-spinner {
          width: 14px; height: 14px; border: 1.5px solid rgba(180,140,60,0.2);
          border-top-color: var(--gold); border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        .ne-upload-error { font-size: 0.75rem; color: #ef4444; margin-top: 0.4rem; }

        .ne-color-row { display: flex; gap: 0.5rem; align-items: center; }
        .ne-color-text { flex: 1; }
        .ne-color-swatch {
          width: 40px; height: 38px; padding: 2px;
          background: var(--bg-3); border: 1px solid var(--border);
          border-radius: 6px; cursor: pointer; flex-shrink: 0; display: block;
        }
        .ne-color-swatch:focus { outline: 2px solid var(--gold); }
        .ne-color-auto-badge {
          font-size: 0.65rem; color: var(--gold); letter-spacing: 0.06em;
          padding: 0.2rem 0.5rem; border: 1px solid rgba(180,140,60,0.3);
          border-radius: 99px; white-space: nowrap;
        }

        /* Invite model */
        .ne-model-group { display: grid; grid-template-columns: 1fr 1fr; gap: 0.875rem; margin-bottom: 1.25rem; }
        @media (max-width: 480px) { .ne-model-group { grid-template-columns: 1fr; } }
        .ne-model-card { padding: 1.125rem; border: 1.5px solid var(--border); border-radius: 8px; cursor: pointer; transition: all 0.2s; background: var(--bg-3); position: relative; }
        .ne-model-card:hover { border-color: var(--border-hover); }
        .ne-model-card.selected { border-color: var(--gold); background: var(--gold-dim); }
        .ne-model-icon  { font-size: 1.375rem; margin-bottom: 0.625rem; }
        .ne-model-title { font-size: 0.825rem; font-weight: 500; color: var(--text); margin-bottom: 0.375rem; }
        .ne-model-desc  { font-size: 0.72rem; color: var(--text-3); line-height: 1.55; font-weight: 300; }
        .ne-check { position: absolute; top: 0.75rem; right: 0.75rem; width: 18px; height: 18px; border-radius: 50%; background: var(--gold); display: flex; align-items: center; justify-content: center; }
        .ne-check svg { width: 10px; height: 10px; }

        /* Switch */
        .ne-switch-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1rem; background: var(--bg-3); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 1.25rem; }
        .ne-switch-info  { flex: 1; }
        .ne-switch-title { font-size: 0.825rem; font-weight: 500; color: var(--text); margin-bottom: 0.25rem; }
        .ne-switch-desc  { font-size: 0.72rem; color: var(--text-3); line-height: 1.5; font-weight: 300; }
        .ne-switch { width: 40px; height: 22px; border-radius: 11px; background: var(--bg); border: 1.5px solid var(--border); cursor: pointer; flex-shrink: 0; position: relative; transition: all 0.2s; margin-top: 2px; }
        .ne-switch.on { background: var(--gold); border-color: var(--gold); }
        .ne-switch-thumb { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--text-3); transition: all 0.2s; }
        .ne-switch.on .ne-switch-thumb { left: 20px; background: #0a0a0a; }

        /* Tiers */
        .ne-tier-list { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem; }
        .ne-tier-card { background: var(--bg-3); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; position: relative; }
        .ne-tier-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; border-radius: 8px 0 0 8px; background: var(--tier-accent, var(--gold)); }
        .ne-tier-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.875rem; }
        .ne-tier-swatch { width: 22px; height: 22px; padding: 0; border: none; border-radius: 50%; cursor: pointer; flex-shrink: 0; display: block; }
        .ne-tier-swatch:focus { outline: 2px solid var(--gold); }
        .ne-tier-name { flex: 1; padding: 0.375rem 0.625rem; background: var(--bg-2); border: 1px solid var(--border); border-radius: 5px; color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 0.825rem; outline: none; }
        .ne-tier-name:focus { border-color: var(--gold); }
        .ne-tier-remove { background: transparent; border: none; color: var(--text-3); cursor: pointer; padding: 0.25rem; border-radius: 4px; transition: color 0.15s; }
        .ne-tier-remove:hover { color: #ef4444; }
        .ne-tier-remove svg { width: 14px; height: 14px; display: block; }
        .ne-tier-pills { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
        .ne-pill { font-size: 0.65rem; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; padding: 0.25rem 0.625rem; border-radius: 20px; border: 1px solid var(--border); background: transparent; cursor: pointer; color: var(--text-3); transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
        .ne-pill:hover { border-color: var(--border-hover); color: var(--text-2); }
        .ne-pill.seat-on { border-color: #4a9eff; background: rgba(74,158,255,0.1); color: #4a9eff; }
        .ne-pill.menu-on { border-color: #4caf7d; background: rgba(76,175,125,0.1); color: #4caf7d; }
        .ne-pill-label { font-size: 0.68rem; color: var(--text-3); }
        .ne-tier-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
        .ne-tier-meta-input { padding: 0.35rem 0.625rem; background: var(--bg-2); border: 1px solid var(--border); border-radius: 5px; color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 0.775rem; outline: none; box-sizing: border-box; width: 100%; }
        .ne-tier-meta-input:focus { border-color: var(--gold); }

        .ne-add { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem; border: 1px dashed var(--border); border-radius: 6px; background: transparent; color: var(--text-3); font-family: 'DM Sans', sans-serif; font-size: 0.775rem; cursor: pointer; transition: all 0.15s; }
        .ne-add:hover { border-color: var(--gold); color: var(--gold); }
        .ne-add svg { width: 13px; height: 13px; display: block; }

        /* Menu */
        .ne-menu-section { margin-bottom: 1.5rem; }
        .ne-menu-cat-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
        .ne-menu-cat-label { font-size: 0.72rem; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-2); }
        .ne-menu-item-row { background: var(--bg-3); border: 1px solid var(--border); border-radius: 7px; padding: 0.875rem; margin-bottom: 0.5rem; display: flex; gap: 0.75rem; align-items: flex-start; }
        .ne-menu-item-fields { flex: 1; display: flex; flex-direction: column; gap: 0.4rem; }

        /* Review */
        .ne-review-section { margin-bottom: 1.25rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--border); }
        .ne-review-section:last-child { border-bottom: none; margin-bottom: 0; }
        .ne-review-title { font-size: 0.72rem; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gold); margin-bottom: 0.875rem; }
        .ne-review-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 0.8rem; padding: 0.3rem 0; gap: 1rem; }
        .ne-review-key { color: var(--text-3); flex-shrink: 0; }
        .ne-review-val { color: var(--text); text-align: right; }

        /* Seating */
        .ne-seating-summary { margin-top: 1.5rem; padding: 1rem; background: var(--bg-3); border-radius: 8px; border: 1px solid var(--border); }
        .ne-seating-summary-title { font-size: 0.72rem; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-2); margin-bottom: 0.75rem; }
        .ne-seating-row { display: flex; align-items: center; gap: 0.625rem; padding: 0.35rem 0; font-size: 0.8rem; color: var(--text-2); }
        .ne-seating-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .ne-release-row { display: flex; align-items: center; gap: 0.75rem; }
        .ne-release-input { max-width: 120px; }
        .ne-release-label { font-size: 0.8rem; color: var(--text-3); }

        /* Actions */
        .ne-actions { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
        .ne-btn-back { display: flex; align-items: center; gap: 0.4rem; padding: 0.625rem 1.125rem; border: 1px solid var(--border); border-radius: 6px; background: transparent; color: var(--text-2); font-family: 'DM Sans', sans-serif; font-size: 0.8rem; cursor: pointer; transition: all 0.15s; }
        .ne-btn-back:hover { border-color: var(--border-hover); color: var(--text); }
        .ne-btn-back svg { width: 14px; height: 14px; display: block; }
        .ne-btn-next { display: flex; align-items: center; gap: 0.4rem; padding: 0.625rem 1.5rem; background: var(--gold); color: #0a0a0a; font-family: 'DM Sans', sans-serif; font-size: 0.8rem; font-weight: 500; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
        .ne-btn-next:hover:not(:disabled) { background: #c9a84c; transform: translateY(-1px); }
        .ne-btn-next:disabled { opacity: 0.45; cursor: not-allowed; }
        .ne-btn-next svg { width: 14px; height: 14px; display: block; }
        .ne-btn-draft { display: flex; align-items: center; gap: 0.4rem; padding: 0.625rem 1.125rem; border: 1px solid var(--border); border-radius: 6px; background: transparent; color: var(--text-2); font-family: 'DM Sans', sans-serif; font-size: 0.8rem; cursor: pointer; transition: all 0.15s; }
        .ne-btn-draft:hover:not(:disabled) { border-color: var(--border-hover); color: var(--text); }
        .ne-btn-draft:disabled { opacity: 0.45; cursor: not-allowed; }
        .ne-btn-publish { display: flex; align-items: center; gap: 0.4rem; padding: 0.625rem 1.5rem; background: #4caf7d; color: #fff; font-family: 'DM Sans', sans-serif; font-size: 0.8rem; font-weight: 500; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
        .ne-btn-publish:hover:not(:disabled) { background: #43a070; transform: translateY(-1px); }
        .ne-btn-publish:disabled { opacity: 0.45; cursor: not-allowed; }

        .ne-error { font-size: 0.775rem; color: #ef4444; padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 1rem; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); }
        .ne-publish-row { display: flex; gap: 0.75rem; }
      `}</style>

      <div className="ne-root">

        <Link href={`/events/${id}`} className="ne-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back to Event
        </Link>

        <p className="ne-page-heading">Editing: <span>{form.name || "…"}</span></p>

        {/* Progress */}
        <div className="ne-progress">
          {STEPS.map(s => (
            <div key={s.n} className={`ne-step${step === s.n ? " active" : ""}${step > s.n ? " done" : ""}`}>
              <div className="ne-dot">
                {step > s.n
                  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>
                  : s.n
                }
              </div>
              <span className="ne-step-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* ══ STEP 1 — Details ══ */}
        {step === 1 && (
          <div className="ne-card">
            <h2 className="ne-title">Event Details</h2>
            <p className="ne-desc">Update your event information. Changes here appear on your RSVP page.</p>

            <div className="ne-field">
              <label className="ne-label">Event Name <span className="ne-req">*</span></label>
              <input type="text" className="ne-input" placeholder="e.g. Tunde & Amaka's Wedding" value={form.name} onChange={e => setField("name", e.target.value)} />
            </div>

            <div className="ne-row">
              <div className="ne-field">
                <label className="ne-label">Event Type</label>
                <select className="ne-select" value={form.eventType} onChange={e => setField("eventType", e.target.value)}>
                  {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="ne-field">
                <label className="ne-label">Event Date <span className="ne-req">*</span></label>
                <input type="date" className="ne-input" value={form.eventDate} onChange={e => setField("eventDate", e.target.value)} />
              </div>
            </div>

            <div className="ne-row">
              <div className="ne-field">
                <label className="ne-label">Start Time</label>
                <input type="time" className="ne-input" value={form.startTime} onChange={e => setField("startTime", e.target.value)} />
              </div>
              <div className="ne-field">
                <label className="ne-label">End Time</label>
                <input type="time" className="ne-input" value={form.endTime} onChange={e => setField("endTime", e.target.value)} />
              </div>
            </div>

            <div className="ne-field">
              <label className="ne-label">Venue Name</label>
              <input type="text" className="ne-input" placeholder="e.g. Eko Hotels & Suites" value={form.venueName} onChange={e => setField("venueName", e.target.value)} />
            </div>

            <div className="ne-row">
              <div className="ne-field">
                <label className="ne-label">Venue Address</label>
                <input type="text" className="ne-input" placeholder="e.g. Victoria Island, Lagos" value={form.venueAddress} onChange={e => setField("venueAddress", e.target.value)} />
              </div>
              <div className="ne-field">
                <label className="ne-label">Venue Capacity</label>
                <input type="number" className="ne-input" placeholder="e.g. 300" min="1" value={form.venueCapacity} onChange={e => setField("venueCapacity", e.target.value)} />
                <span className="ne-hint">RSVP link closes when this number is reached.</span>
              </div>
            </div>

            <div className="ne-field">
              <label className="ne-label">Description</label>
              <textarea className="ne-textarea" placeholder="A brief description for your guests…" value={form.description} onChange={e => setField("description", e.target.value)} />
            </div>

            {/* ── Invitation Card Upload ── */}
            <div className="ne-field">
              <label className="ne-label">Invitation Card</label>

              {cardPreview ? (
                <div className="ne-card-preview">
                  <Image src={cardPreview} alt="Invitation card preview" fill style={{ objectFit: "cover" }} unoptimized />
                  <button
                    type="button"
                    className="ne-card-preview-remove"
                    onClick={() => { setCardPreview(null); setField("invitationCard", "") }}
                    title="Remove card"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div
                  className="ne-upload-zone"
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("dragging") }}
                  onDragLeave={e => e.currentTarget.classList.remove("dragging")}
                  onDrop={e => {
                    e.preventDefault()
                    e.currentTarget.classList.remove("dragging")
                    const file = e.dataTransfer.files[0]
                    if (file) handleCardUpload(file)
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) handleCardUpload(file)
                    }}
                  />
                  <div className="ne-upload-icon">🖼️</div>
                  <div className="ne-upload-text">Drop your invitation card here, or click to browse</div>
                  <div className="ne-upload-sub">PNG, JPG, WEBP · Max 10MB · Brand colour auto-extracted</div>
                </div>
              )}

              {uploading && (
                <div className="ne-uploading">
                  <div className="ne-upload-spinner" />
                  Uploading & extracting brand colour…
                </div>
              )}
              {uploadError && <div className="ne-upload-error">{uploadError}</div>}
              <span className="ne-hint">
                Appears as the hero image on your RSVP page. The dominant colour is automatically set as your brand colour.
              </span>
            </div>
          </div>
        )}

        {/* ══ STEP 2 — Invite Settings ══ */}
        {step === 2 && (
          <div className="ne-card">
            <h2 className="ne-title">Invite Settings</h2>
            <p className="ne-desc">Configure how guests access your RSVP and your event's brand colour.</p>

            <div className="ne-field">
              <label className="ne-label">Invite Model <span className="ne-req">*</span></label>
              <div className="ne-model-group">
                {(["OPEN", "CLOSED"] as InviteModel[]).map(model => (
                  <div
                    key={model}
                    className={`ne-model-card${form.inviteModel === model ? " selected" : ""}`}
                    onClick={() => setField("inviteModel", model)}
                    role="button" tabIndex={0}
                    onKeyDown={e => e.key === "Enter" && setField("inviteModel", model)}
                    aria-pressed={form.inviteModel === model}
                  >
                    {form.inviteModel === model && (
                      <div className="ne-check">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                    <div className="ne-model-icon">{model === "OPEN" ? "🔓" : "🔒"}</div>
                    <div className="ne-model-title">{model === "OPEN" ? "Open Invite" : "Closed Invite"}</div>
                    <div className="ne-model-desc">
                      {model === "OPEN"
                        ? "A single public RSVP link. Anyone with the link can register."
                        : "Each guest receives a personalised link. Nobody else can use their link."
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ne-switch-row">
              <div className="ne-switch-info">
                <div className="ne-switch-title">Phone Verification (OTP)</div>
                <div className="ne-switch-desc">Require guests to verify their phone with a 6-digit SMS code during RSVP. SMS charges apply per event.</div>
              </div>
              <div
                className={`ne-switch${form.requireOtp ? " on" : ""}`}
                onClick={() => setField("requireOtp", !form.requireOtp)}
                role="switch" tabIndex={0} aria-checked={form.requireOtp}
                onKeyDown={e => e.key === "Enter" && setField("requireOtp", !form.requireOtp)}
              >
                <div className="ne-switch-thumb" />
              </div>
            </div>

            <div className="ne-row">
              <div className="ne-field">
                <label className="ne-label">RSVP Deadline</label>
                <input type="date" className="ne-input" value={form.rsvpDeadline} onChange={e => setField("rsvpDeadline", e.target.value)} />
                <span className="ne-hint">Leave blank to close manually.</span>
              </div>
              <div className="ne-field">
                <label className="ne-label">
                  Brand Colour
                  {uploading && <span className="ne-color-auto-badge" style={{ marginLeft: "0.5rem" }}>Auto-extracted</span>}
                </label>
                <div className="ne-color-row">
                  <input
                    type="color"
                    className="ne-color-swatch"
                    value={form.brandColor}
                    onChange={e => setField("brandColor", e.target.value)}
                    title="Pick brand colour"
                  />
                  <input
                    type="text"
                    className="ne-input ne-color-text"
                    value={form.brandColor}
                    onChange={e => setField("brandColor", e.target.value)}
                    maxLength={7}
                    placeholder="#C9A84C"
                  />
                </div>
                <span className="ne-hint">Used on your event's RSVP page. Auto-set when you upload an invitation card.</span>
              </div>
            </div>
          </div>
        )}

        {/* ══ STEP 3 — Guest Tiers ══ */}
        {step === 3 && (
          <div className="ne-card">
            <h2 className="ne-title">Guest Tiers</h2>
            <p className="ne-desc">Adjust your tier structure. Colour tags appear on guest lists and check-in screens.</p>

            <div className="ne-tier-list">
              {form.tiers.map(tier => (
                <div key={tier.id} className="ne-tier-card" style={{ "--tier-accent": tier.color } as React.CSSProperties}>
                  <div className="ne-tier-header">
                    <input
                      type="color" className="ne-tier-swatch"
                      value={tier.color}
                      onChange={e => updateTier(tier.id, "color", e.target.value)}
                      title="Pick tier colour"
                      aria-label={`Colour for ${tier.name || "tier"}`}
                    />
                    <input
                      type="text" className="ne-tier-name"
                      placeholder="Tier name e.g. VIP"
                      value={tier.name}
                      onChange={e => updateTier(tier.id, "name", e.target.value)}
                    />
                    <button type="button" className="ne-tier-remove" onClick={() => removeTier(tier.id)} title="Remove tier">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>

                  <div className="ne-tier-pills">
                    <span className="ne-pill-label">Seating:</span>
                    <button type="button" className={`ne-pill${tier.seatingType === "PRE_ASSIGNED" ? " seat-on" : ""}`} onClick={() => updateTier(tier.id, "seatingType", "PRE_ASSIGNED")}>Pre-assigned</button>
                    <button type="button" className={`ne-pill${tier.seatingType === "DYNAMIC"      ? " seat-on" : ""}`} onClick={() => updateTier(tier.id, "seatingType", "DYNAMIC")}>Dynamic</button>
                    <span className="ne-pill-label" style={{ marginLeft: "0.25rem" }}>Menu:</span>
                    <button type="button" className={`ne-pill${tier.menuAccess === "PRE_EVENT" ? " menu-on" : ""}`} onClick={() => updateTier(tier.id, "menuAccess", "PRE_EVENT")}>Pre-order</button>
                    <button type="button" className={`ne-pill${tier.menuAccess === "AT_EVENT"  ? " menu-on" : ""}`} onClick={() => updateTier(tier.id, "menuAccess", "AT_EVENT")}>At event</button>
                  </div>

                  <div className="ne-tier-meta">
                    <input type="number" className="ne-tier-meta-input" placeholder="Max guests (optional)" min="1" value={tier.maxGuests} onChange={e => updateTier(tier.id, "maxGuests", e.target.value)} />
                    {tier.seatingType === "PRE_ASSIGNED" && (
                      <input type="text" className="ne-tier-meta-input" placeholder='Table prefix e.g. VIP-' value={tier.tablePrefix} onChange={e => updateTier(tier.id, "tablePrefix", e.target.value)} />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button type="button" className="ne-add" onClick={addTier}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Tier
            </button>
          </div>
        )}

        {/* ══ STEP 4 — Seating ══ */}
        {step === 4 && (
          <div className="ne-card">
            <h2 className="ne-title">Tables & Seating</h2>
            <p className="ne-desc">Update your table layout configuration.</p>

            <div className="ne-row">
              <div className="ne-field">
                <label className="ne-label">Total Tables</label>
                <input type="number" className="ne-input" placeholder="e.g. 30" min="1" value={form.totalTables} onChange={e => setField("totalTables", e.target.value)} />
              </div>
              <div className="ne-field">
                <label className="ne-label">Seats Per Table</label>
                <input type="number" className="ne-input" placeholder="e.g. 10" min="1" value={form.seatsPerTable} onChange={e => setField("seatsPerTable", e.target.value)} />
              </div>
            </div>

            <div className="ne-field">
              <label className="ne-label">Release Reserved Seats After</label>
              <div className="ne-release-row">
                <input type="number" className="ne-input ne-release-input" placeholder="e.g. 30" min="0" value={form.releaseReservedAfter} onChange={e => setField("releaseReservedAfter", e.target.value)} />
                <span className="ne-release-label">minutes after event start</span>
              </div>
              <span className="ne-hint">Leave blank to never auto-release reserved seats.</span>
            </div>

            {form.tiers.filter(t => t.seatingType === "PRE_ASSIGNED").length > 0 && (
              <div className="ne-seating-summary">
                <div className="ne-seating-summary-title">Pre-assigned Tiers</div>
                {form.tiers.filter(t => t.seatingType === "PRE_ASSIGNED").map(t => (
                  <div key={t.id} className="ne-seating-row">
                    <div className="ne-seating-dot" style={{ background: t.color }} />
                    <span>{t.name || "Unnamed tier"}</span>
                    {t.tablePrefix && <span style={{ color: "var(--text-3)", fontSize: "0.72rem" }}>· Prefix &quot;{t.tablePrefix}&quot;</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ STEP 5 — Menu ══ */}
        {step === 5 && (
          <div className="ne-card">
            <h2 className="ne-title">Menu Builder</h2>
            <p className="ne-desc">Update food and drinks. Pre-order tiers (VIP, Family, Special Guests) select from this menu during RSVP.</p>

            {MENU_CATEGORIES.map(cat => {
              const items = form.menuItems.filter(m => m.category === cat.value)
              return (
                <div key={cat.value} className="ne-menu-section">
                  <div className="ne-menu-cat-header">
                    <div>
                      <span className="ne-menu-cat-label">{cat.label}</span>
                      <span style={{ fontSize: "0.68rem", color: "var(--text-3)", marginLeft: "0.5rem" }}>{cat.desc}</span>
                    </div>
                    <button type="button" className="ne-add" onClick={() => addMenuItem(cat.value)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      Add
                    </button>
                  </div>
                  {items.map(item => (
                    <div key={item.id} className="ne-menu-item-row">
                      <div className="ne-menu-item-fields">
                        <input type="text" className="ne-input" placeholder={`${cat.label} name`} value={item.name} onChange={e => updateMenuItem(item.id, "name", e.target.value)} />
                        <input type="text" className="ne-input" placeholder="Description (optional)" value={item.description} onChange={e => updateMenuItem(item.id, "description", e.target.value)} />
                      </div>
                      <button type="button" className="ne-tier-remove" onClick={() => removeMenuItem(item.id)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-3)", padding: "0.5rem 0" }}>No {cat.label.toLowerCase()} items.</div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ══ STEP 6 — Review ══ */}
        {step === 6 && (
          <div className="ne-card">
            <h2 className="ne-title">Review & Save</h2>
            <p className="ne-desc">Confirm your changes. Save as Draft or publish immediately.</p>

            <div className="ne-review-section">
              <div className="ne-review-title">Event Details</div>
              <div className="ne-review-row"><span className="ne-review-key">Name</span><span className="ne-review-val">{form.name}</span></div>
              <div className="ne-review-row"><span className="ne-review-key">Type</span><span className="ne-review-val">{EVENT_TYPES.find(t => t.value === form.eventType)?.label}</span></div>
              <div className="ne-review-row">
                <span className="ne-review-key">Date</span>
                <span className="ne-review-val">{form.eventDate ? new Date(form.eventDate).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "—"}</span>
              </div>
              {form.venueName     && <div className="ne-review-row"><span className="ne-review-key">Venue</span><span className="ne-review-val">{form.venueName}</span></div>}
              {form.venueCapacity && <div className="ne-review-row"><span className="ne-review-key">Capacity</span><span className="ne-review-val">{form.venueCapacity} guests</span></div>}
            </div>

            <div className="ne-review-section">
              <div className="ne-review-title">Invite Settings</div>
              <div className="ne-review-row"><span className="ne-review-key">Model</span><span className="ne-review-val">{form.inviteModel === "CLOSED" ? "🔒 Closed Invite" : "🔓 Open Invite"}</span></div>
              <div className="ne-review-row"><span className="ne-review-key">OTP</span><span className="ne-review-val">{form.requireOtp ? "✓ Enabled" : "Disabled"}</span></div>
              <div className="ne-review-row">
                <span className="ne-review-key">Brand Colour</span>
                <span className="ne-review-val" style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: form.brandColor, display: "inline-block", border: "1px solid var(--border)" }} />
                  {form.brandColor}
                </span>
              </div>
            </div>

            <div className="ne-review-section">
              <div className="ne-review-title">Guest Tiers ({form.tiers.length})</div>
              {form.tiers.map(t => (
                <div key={t.id} className="ne-review-row">
                  <span className="ne-review-key" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, display: "inline-block", flexShrink: 0 }} />
                    {t.name || "Unnamed"}
                  </span>
                  <span className="ne-review-val" style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>
                    {t.seatingType === "PRE_ASSIGNED" ? "Pre-assigned" : "Dynamic"} · {t.menuAccess === "PRE_EVENT" ? "Pre-order" : "At-event"}
                  </span>
                </div>
              ))}
            </div>

            <div className="ne-review-section">
              <div className="ne-review-title">Menu ({form.menuItems.length} items)</div>
              {form.menuItems.length === 0
                ? <div style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>No menu items.</div>
                : MENU_CATEGORIES.map(cat => {
                    const items = form.menuItems.filter(m => m.category === cat.value)
                    if (!items.length) return null
                    return (
                      <div key={cat.value}>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-3)", margin: "0.5rem 0 0.25rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>{cat.label}</div>
                        {items.map(item => (
                          <div key={item.id} className="ne-review-row">
                            <span className="ne-review-key">·</span>
                            <span className="ne-review-val">{item.name || "Unnamed item"}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })
              }
            </div>
          </div>
        )}

        {error && <div className="ne-error" role="alert">{error}</div>}

        {/* Actions */}
        <div className="ne-actions">
          {step > 1
            ? (
              <button type="button" className="ne-btn-back" onClick={back}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 5l-7 7 7 7"/>
                </svg>
                Back
              </button>
            )
            : <div />
          }

          {step < 6
            ? (
              <button type="button" className="ne-btn-next" onClick={next} disabled={!canProceed()}>
                Continue
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            )
            : (
              <div className="ne-publish-row">
                <button type="button" className="ne-btn-draft"   onClick={() => submit(false)} disabled={saving}>{saving ? "Saving…"       : "Save as Draft"  }</button>
                <button type="button" className="ne-btn-publish" onClick={() => submit(true)}  disabled={saving}>{saving ? "Saving…"       : "Save & Publish" }</button>
              </div>
            )
          }
        </div>

      </div>
    </>
  )
}
