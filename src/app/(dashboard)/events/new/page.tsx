"use client"

// src/app/(dashboard)/events/new/page.tsx
// Multi-step event creation — 6 steps.
// Step 1 includes Google Places Autocomplete for venue + map preview.

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/context/AuthContext"

declare global {
  interface Window {
    google: typeof google
    initGooglePlaces: () => void
  }
}

// ── Types ──────────────────────────────────────────────────────

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
  // ── Map fields ──
  venueLat:             string
  venueLng:             string
  venueMapUrl:          string
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

// ── Constants ──────────────────────────────────────────────────

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

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"]
const MAX_FILE_SIZE  = 10 * 1024 * 1024

const DEFAULT_TIERS: GuestTier[] = [
  { id: uid(), name: "VIP",           color: "#b48c3c", seatingType: "PRE_ASSIGNED", menuAccess: "PRE_EVENT", maxGuests: "", tablePrefix: "VIP-" },
  { id: uid(), name: "Family",        color: "#4caf7d", seatingType: "PRE_ASSIGNED", menuAccess: "PRE_EVENT", maxGuests: "", tablePrefix: "FAM-" },
  { id: uid(), name: "Special Guest", color: "#a78bfa", seatingType: "PRE_ASSIGNED", menuAccess: "PRE_EVENT", maxGuests: "", tablePrefix: "SG-"  },
  { id: uid(), name: "Friends",       color: "#4a9eff", seatingType: "DYNAMIC",      menuAccess: "AT_EVENT",  maxGuests: "", tablePrefix: ""     },
  { id: uid(), name: "Workmates",     color: "#38bdf8", seatingType: "DYNAMIC",      menuAccess: "AT_EVENT",  maxGuests: "", tablePrefix: ""     },
  { id: uid(), name: "General",       color: "#6b7280", seatingType: "DYNAMIC",      menuAccess: "AT_EVENT",  maxGuests: "", tablePrefix: ""     },
]

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

// ── Component ──────────────────────────────────────────────────

export default function NewEventPage() {
  const router = useRouter()
  const { sessionToken } = useAuth()

  const [step,   setStep]   = useState(1)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState("")

  // ── Invitation card upload ──
  const [cardFile,      setCardFile]      = useState<File | null>(null)
  const [cardPreview,   setCardPreview]   = useState<string | null>(null)
  const [cardUploading, setCardUploading] = useState(false)
  const [cardError,     setCardError]     = useState("")
  const [isDragging,    setIsDragging]    = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Places Autocomplete ──
  const venueInputRef    = useRef<HTMLInputElement>(null)
  const autocompleteRef  = useRef<google.maps.places.Autocomplete | null>(null)
  const [mapsReady,      setMapsReady]    = useState(false)
  const [mapPreviewUrl,  setMapPreviewUrl] = useState<string | null>(null)

  const [form, setForm] = useState<FormData>({
    name: "", eventType: "WEDDING",
    eventDate: "", startTime: "", endTime: "",
    venueName: "", venueAddress: "", venueCapacity: "",
    venueLat: "", venueLng: "", venueMapUrl: "",
    description: "", invitationCard: "",
    inviteModel: "OPEN", requireOtp: false,
    rsvpDeadline: "", brandColor: "#C9A84C",
    tiers: DEFAULT_TIERS,
    totalTables: "", seatsPerTable: "10",
    releaseReservedAfter: "30",
    menuItems: [],
  })

  const setField = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  // ── Load Google Maps script ───────────────────────────────────

  useEffect(() => {
    if (!MAPS_KEY) return
    if (window.google?.maps?.places) { setMapsReady(true); return }

    window.initGooglePlaces = () => setMapsReady(true)

    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places&callback=initGooglePlaces`
    script.async = true
    script.defer = true
    document.head.appendChild(script)

    return () => {
      if (document.head.contains(script)) document.head.removeChild(script)
    }
  }, [])

  // ── Wire up autocomplete once Maps is ready and input is mounted ─

  useEffect(() => {
    if (!mapsReady || !venueInputRef.current || autocompleteRef.current) return

    autocompleteRef.current = new window.google.maps.places.Autocomplete(
      venueInputRef.current,
      { types: ["establishment", "geocode"], fields: ["formatted_address", "geometry", "name", "url"] }
    )

    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current!.getPlace()
      if (!place.geometry?.location) return

      const lat    = place.geometry.location.lat()
      const lng    = place.geometry.location.lng()
      const addr   = place.formatted_address ?? ""
      const name   = place.name ?? ""
      const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

      const staticUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=600x200&markers=color:red|${lat},${lng}&key=${MAPS_KEY}`

      setForm(prev => ({
        ...prev,
        venueName:    name  || prev.venueName,
        venueAddress: addr,
        venueLat:     String(lat),
        venueLng:     String(lng),
        venueMapUrl:  mapUrl,
      }))
      setMapPreviewUrl(staticUrl)
    })
  }, [mapsReady])

  // ── Clear map when venue address is manually cleared ─────────

  const handleVenueAddressChange = (val: string) => {
    setField("venueAddress", val)
    if (!val.trim()) {
      setField("venueLat",    "")
      setField("venueLng",    "")
      setField("venueMapUrl", "")
      setMapPreviewUrl(null)
    }
  }

  // ── Invitation card handlers ──────────────────────────────────

  const processFile = (file: File) => {
    setCardError("")
    if (!ACCEPTED_TYPES.includes(file.type)) { setCardError("Only JPEG, PNG, or PDF files are accepted."); return }
    if (file.size > MAX_FILE_SIZE) { setCardError("File must be under 10 MB."); return }
    setCardFile(file)
    if (file.type !== "application/pdf") {
      const reader = new FileReader()
      reader.onload = e => setCardPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    } else { setCardPreview(null) }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files?.[0]; if (file) processFile(file)
  }

  const removeCard = () => {
    setCardFile(null); setCardPreview(null); setCardError("")
    setField("invitationCard", "")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const uploadCard = async (): Promise<string | null> => {
    if (!cardFile) return form.invitationCard || null
    setCardUploading(true)
    try {
      const data = new FormData()
      data.append("file", cardFile)
      data.append("eventName", form.name || "Untitled Event")
      const hdrs: Record<string, string> = {}
      if (sessionToken) hdrs["Authorization"] = `Bearer ${sessionToken}`
      const res = await fetch("/api/upload/invitation-card", { method: "POST", headers: hdrs, body: data })
      if (!res.ok) throw new Error("Upload failed")
      const json = await res.json()
      return json.url as string
    } catch {
      setCardError("Failed to upload invitation card. You can add it later from the event page.")
      return null
    } finally { setCardUploading(false) }
  }

  // ── Tier helpers ──────────────────────────────────────────────

  const updateTier   = (id: string, field: keyof GuestTier, value: string) =>
    setField("tiers", form.tiers.map(t => t.id === id ? { ...t, [field]: value } : t))
  const addTier      = () =>
    setField("tiers", [...form.tiers, { id: uid(), name: "", color: TIER_COLORS[form.tiers.length % TIER_COLORS.length], seatingType: "DYNAMIC", menuAccess: "AT_EVENT", maxGuests: "", tablePrefix: "" }])
  const removeTier   = (id: string) =>
    setField("tiers", form.tiers.filter(t => t.id !== id))

  // ── Menu helpers ──────────────────────────────────────────────

  const addMenuItem    = (category: MenuCat) =>
    setField("menuItems", [...form.menuItems, { id: uid(), category, name: "", description: "" }])
  const updateMenuItem = (id: string, field: keyof MenuItemRow, value: string) =>
    setField("menuItems", form.menuItems.map(m => m.id === id ? { ...m, [field]: value } : m))
  const removeMenuItem = (id: string) =>
    setField("menuItems", form.menuItems.filter(m => m.id !== id))

  // ── Navigation ────────────────────────────────────────────────

  const canProceed = () => step === 1 ? (!!form.name.trim() && !!form.eventDate) : true
  const next = () => { if (canProceed()) setStep(s => Math.min(s + 1, 6)) }
  const back = () => setStep(s => Math.max(s - 1, 1))

  // ── Submit ────────────────────────────────────────────────────

  const submit = async (publish: boolean) => {
    setSaving(true); setError("")
    try {
      const cardUrl = await uploadCard()
      const hdrs: Record<string, string> = { "Content-Type": "application/json" }
      if (sessionToken) hdrs["Authorization"] = `Bearer ${sessionToken}`

      const res = await fetch("/api/events", {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({
          ...form,
          invitationCard:       cardUrl                   || null,
          venueCapacity:        form.venueCapacity        || null,
          venueLat:             form.venueLat             || null,
          venueLng:             form.venueLng             || null,
          venueMapUrl:          form.venueMapUrl          || null,
          totalTables:          form.totalTables          || null,
          seatsPerTable:        form.seatsPerTable        || null,
          releaseReservedAfter: form.releaseReservedAfter || null,
          rsvpDeadline:         form.rsvpDeadline         || null,
          status:               publish ? "PUBLISHED" : "DRAFT",
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const event = await res.json()
      router.push(`/events/${event.id}`)
    } catch {
      setError("Something went wrong. Please try again.")
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .ne-root { max-width: 780px; margin: 0 auto; }
        .ne-back { display:inline-flex;align-items:center;gap:0.4rem;font-size:0.775rem;color:var(--text-3);text-decoration:none;margin-bottom:1.75rem;transition:color 0.15s }
        .ne-back:hover { color:var(--text-2) }
        .ne-back svg { width:14px;height:14px }
        .ne-progress { display:flex;align-items:center;margin-bottom:2.5rem }
        .ne-step { display:flex;align-items:center;gap:0.5rem;flex:1;position:relative }
        .ne-step:not(:last-child)::after { content:'';position:absolute;left:calc(14px + 0.5rem);right:0;top:14px;height:1px;background:var(--border);z-index:0 }
        .ne-step:not(:last-child).done::after { background:var(--gold);opacity:0.4 }
        .ne-dot { width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:500;flex-shrink:0;z-index:1;border:1.5px solid var(--border);background:var(--bg-2);color:var(--text-3);transition:all 0.2s }
        .ne-step.active .ne-dot { border-color:var(--gold);background:var(--gold-dim);color:var(--gold) }
        .ne-step.done .ne-dot { border-color:var(--gold);background:var(--gold);color:#0a0a0a }
        .ne-step-label { font-size:0.68rem;color:var(--text-3);letter-spacing:0.03em;white-space:nowrap;display:none }
        .ne-step.active .ne-step-label { color:var(--gold) }
        .ne-step.done .ne-step-label { color:var(--text-2) }
        @media(min-width:600px) { .ne-step-label { display:block } }
        .ne-card { background:var(--bg-2);border:1px solid var(--border);border-radius:12px;padding:2rem;margin-bottom:1.5rem }
        .ne-title { font-family:'Cormorant Garamond',serif;font-size:1.5rem;font-weight:300;color:var(--text);letter-spacing:-0.01em;margin-bottom:0.375rem }
        .ne-desc { font-size:0.8rem;color:var(--text-3);font-weight:300;line-height:1.6;margin-bottom:1.75rem;padding-bottom:1.5rem;border-bottom:1px solid var(--border) }
        .ne-field { margin-bottom:1.25rem }
        .ne-label { display:block;font-size:0.75rem;font-weight:500;color:var(--text-2);letter-spacing:0.03em;margin-bottom:0.4rem }
        .ne-hint { display:block;font-size:0.7rem;color:var(--text-3);font-weight:300;line-height:1.5;margin-top:0.3rem }
        .ne-input,.ne-select,.ne-textarea { width:100%;padding:0.625rem 0.875rem;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:0.825rem;transition:border-color 0.15s;outline:none;box-sizing:border-box }
        .ne-input:focus,.ne-select:focus,.ne-textarea:focus { border-color:var(--gold) }
        .ne-textarea { resize:vertical;min-height:80px;line-height:1.6 }
        .ne-select option { background:var(--bg-2) }
        .ne-color-swatch { width:40px;height:38px;padding:2px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;cursor:pointer;flex-shrink:0;display:block }
        .ne-color-row { display:flex;gap:0.5rem;align-items:center }
        .ne-color-text { flex:1 }
        .ne-row { display:grid;grid-template-columns:1fr 1fr;gap:1rem }
        @media(max-width:480px) { .ne-row { grid-template-columns:1fr } }
        .ne-req { color:var(--gold);margin-left:2px }

        /* ── Map pin ── */
        .ne-venue-group { position:relative }
        .ne-venue-pin-indicator { display:flex;align-items:center;gap:0.4rem;font-size:0.7rem;color:#22c55e;margin-top:0.35rem }
        .ne-map-preview { margin-top:0.75rem;border-radius:10px;overflow:hidden;border:1px solid var(--border);position:relative }
        .ne-map-preview img { width:100%;display:block;aspect-ratio:3/1;object-fit:cover }
        .ne-map-preview-overlay { position:absolute;bottom:0;left:0;right:0;padding:0.5rem 0.75rem;background:linear-gradient(to top,rgba(0,0,0,0.65),transparent);display:flex;align-items:center;justify-content:space-between }
        .ne-map-directions { font-size:0.7rem;color:#fff;text-decoration:none;display:inline-flex;align-items:center;gap:0.3rem;opacity:0.9 }
        .ne-map-directions:hover { opacity:1 }
        .ne-map-clear { font-size:0.65rem;color:rgba(255,255,255,0.6);background:transparent;border:1px solid rgba(255,255,255,0.25);border-radius:4px;padding:0.2rem 0.5rem;cursor:pointer;font-family:'DM Sans',sans-serif }
        .ne-map-clear:hover { border-color:rgba(255,255,255,0.5);color:#fff }
        .ne-maps-unavailable { padding:0.625rem 0.875rem;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:6px;font-size:0.72rem;color:#f59e0b;margin-top:0.5rem }

        /* ── Upload ── */
        .ne-upload-zone { border:1.5px dashed var(--border);border-radius:8px;padding:2rem 1.5rem;text-align:center;cursor:pointer;transition:all 0.2s;background:var(--bg-3);position:relative }
        .ne-upload-zone:hover,.ne-upload-zone.drag-over { border-color:var(--gold);background:var(--gold-dim) }
        .ne-upload-icon { font-size:2rem;margin-bottom:0.625rem }
        .ne-upload-title { font-size:0.825rem;font-weight:500;color:var(--text);margin-bottom:0.3rem }
        .ne-upload-sub { font-size:0.72rem;color:var(--text-3);line-height:1.5 }
        .ne-upload-sub strong { color:var(--gold) }
        .ne-upload-types { display:flex;justify-content:center;gap:0.5rem;margin-top:0.875rem;flex-wrap:wrap }
        .ne-upload-type-badge { font-size:0.6rem;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;padding:0.2rem 0.5rem;border:1px solid var(--border);border-radius:4px;color:var(--text-3) }
        .ne-card-preview { border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--bg-3);position:relative }
        .ne-card-preview-img { width:100%;aspect-ratio:16/7;object-fit:cover;display:block }
        .ne-card-preview-pdf { display:flex;align-items:center;gap:0.875rem;padding:1.125rem 1.25rem }
        .ne-card-preview-pdf-icon { font-size:1.75rem;flex-shrink:0 }
        .ne-card-preview-pdf-name { font-size:0.825rem;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:0.2rem }
        .ne-card-preview-pdf-size { font-size:0.7rem;color:var(--text-3) }
        .ne-card-preview-actions { display:flex;gap:0.5rem;padding:0.75rem 1rem;border-top:1px solid var(--border);background:var(--bg-2) }
        .ne-card-change { font-size:0.72rem;color:var(--gold);background:transparent;border:1px solid rgba(180,140,60,0.3);border-radius:5px;padding:0.3rem 0.75rem;cursor:pointer;transition:all 0.15s;font-family:'DM Sans',sans-serif }
        .ne-card-change:hover { border-color:var(--gold);background:var(--gold-dim) }
        .ne-card-remove { font-size:0.72rem;color:var(--text-3);background:transparent;border:1px solid var(--border);border-radius:5px;padding:0.3rem 0.75rem;cursor:pointer;transition:all 0.15s;font-family:'DM Sans',sans-serif }
        .ne-card-remove:hover { border-color:rgba(239,68,68,0.4);color:#ef4444 }
        .ne-upload-error { font-size:0.75rem;color:#ef4444;margin-top:0.5rem;padding:0.5rem 0.75rem;background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.2);border-radius:5px }

        /* ── Invite model ── */
        .ne-model-group { display:grid;grid-template-columns:1fr 1fr;gap:0.875rem;margin-bottom:1.25rem }
        @media(max-width:480px) { .ne-model-group { grid-template-columns:1fr } }
        .ne-model-card { padding:1.125rem;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;transition:all 0.2s;background:var(--bg-3);position:relative }
        .ne-model-card:hover { border-color:var(--border-hover) }
        .ne-model-card.selected { border-color:var(--gold);background:var(--gold-dim) }
        .ne-model-icon { font-size:1.375rem;margin-bottom:0.625rem }
        .ne-model-title { font-size:0.825rem;font-weight:500;color:var(--text);margin-bottom:0.375rem }
        .ne-model-desc { font-size:0.72rem;color:var(--text-3);line-height:1.55;font-weight:300 }
        .ne-check { position:absolute;top:0.75rem;right:0.75rem;width:18px;height:18px;border-radius:50%;background:var(--gold);display:flex;align-items:center;justify-content:center }
        .ne-check svg { width:10px;height:10px }

        /* ── OTP switch ── */
        .ne-switch-row { display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;padding:1rem;background:var(--bg-3);border:1px solid var(--border);border-radius:8px;margin-bottom:1.25rem }
        .ne-switch-info { flex:1 }
        .ne-switch-title { font-size:0.825rem;font-weight:500;color:var(--text);margin-bottom:0.25rem }
        .ne-switch-desc { font-size:0.72rem;color:var(--text-3);line-height:1.5;font-weight:300 }
        .ne-switch { width:40px;height:22px;border-radius:11px;background:var(--bg);border:1.5px solid var(--border);cursor:pointer;flex-shrink:0;position:relative;transition:all 0.2s;margin-top:2px }
        .ne-switch.on { background:var(--gold);border-color:var(--gold) }
        .ne-switch-thumb { position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--text-3);transition:all 0.2s }
        .ne-switch.on .ne-switch-thumb { left:20px;background:#0a0a0a }

        /* ── Tier ── */
        .ne-tier-list { display:flex;flex-direction:column;gap:0.75rem;margin-bottom:1rem }
        .ne-tier-card { background:var(--bg-3);border:1px solid var(--border);border-radius:8px;padding:1rem;position:relative }
        .ne-tier-card::before { content:'';position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:8px 0 0 8px;background:var(--tier-accent,var(--gold)) }
        .ne-tier-header { display:flex;align-items:center;gap:0.75rem;margin-bottom:0.875rem }
        .ne-tier-swatch { width:22px;height:22px;padding:0;border:none;border-radius:50%;cursor:pointer;flex-shrink:0;display:block }
        .ne-tier-swatch:focus { outline:2px solid var(--gold) }
        .ne-tier-name { flex:1;padding:0.375rem 0.625rem;background:var(--bg-2);border:1px solid var(--border);border-radius:5px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:0.825rem;outline:none }
        .ne-tier-name:focus { border-color:var(--gold) }
        .ne-tier-remove { background:transparent;border:none;color:var(--text-3);cursor:pointer;padding:0.25rem;border-radius:4px;transition:color 0.15s }
        .ne-tier-remove:hover { color:#ef4444 }
        .ne-tier-remove svg { width:14px;height:14px;display:block }
        .ne-tier-pills { display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.75rem }
        .ne-pill { font-size:0.65rem;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;padding:0.25rem 0.625rem;border-radius:20px;border:1px solid var(--border);background:transparent;cursor:pointer;color:var(--text-3);transition:all 0.15s;font-family:'DM Sans',sans-serif }
        .ne-pill:hover { border-color:var(--border-hover);color:var(--text-2) }
        .ne-pill.seat-on { border-color:#4a9eff;background:rgba(74,158,255,0.1);color:#4a9eff }
        .ne-pill.menu-on { border-color:#4caf7d;background:rgba(76,175,125,0.1);color:#4caf7d }
        .ne-pill-label { font-size:0.68rem;color:var(--text-3) }
        .ne-tier-meta { display:grid;grid-template-columns:1fr 1fr;gap:0.5rem }
        .ne-tier-meta-input { padding:0.35rem 0.625rem;background:var(--bg-2);border:1px solid var(--border);border-radius:5px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:0.775rem;outline:none;box-sizing:border-box;width:100% }
        .ne-tier-meta-input:focus { border-color:var(--gold) }
        .ne-add { display:inline-flex;align-items:center;gap:0.4rem;padding:0.5rem 1rem;border:1px dashed var(--border);border-radius:6px;background:transparent;color:var(--text-3);font-family:'DM Sans',sans-serif;font-size:0.775rem;cursor:pointer;transition:all 0.15s }
        .ne-add:hover { border-color:var(--gold);color:var(--gold) }
        .ne-add svg { width:13px;height:13px;display:block }

        /* ── Menu ── */
        .ne-menu-section { margin-bottom:1.5rem }
        .ne-menu-cat-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem }
        .ne-menu-cat-label { font-size:0.72rem;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-2) }
        .ne-menu-item-row { background:var(--bg-3);border:1px solid var(--border);border-radius:7px;padding:0.875rem;margin-bottom:0.5rem;display:flex;gap:0.75rem;align-items:flex-start }
        .ne-menu-item-fields { flex:1;display:flex;flex-direction:column;gap:0.4rem }

        /* ── Review ── */
        .ne-review-section { margin-bottom:1.25rem;padding-bottom:1.25rem;border-bottom:1px solid var(--border) }
        .ne-review-section:last-child { border-bottom:none;margin-bottom:0 }
        .ne-review-title { font-size:0.72rem;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold);margin-bottom:0.875rem }
        .ne-review-row { display:flex;justify-content:space-between;align-items:baseline;font-size:0.8rem;padding:0.3rem 0;gap:1rem }
        .ne-review-key { color:var(--text-3);flex-shrink:0 }
        .ne-review-val { color:var(--text);text-align:right }

        /* ── Actions ── */
        .ne-actions { display:flex;justify-content:space-between;align-items:center;gap:1rem }
        .ne-btn-back { display:flex;align-items:center;gap:0.4rem;padding:0.625rem 1.125rem;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--text-2);font-family:'DM Sans',sans-serif;font-size:0.8rem;cursor:pointer;transition:all 0.15s }
        .ne-btn-back:hover { border-color:var(--border-hover);color:var(--text) }
        .ne-btn-back svg { width:14px;height:14px;display:block }
        .ne-btn-next { display:flex;align-items:center;gap:0.4rem;padding:0.625rem 1.5rem;background:var(--gold);color:#0a0a0a;font-family:'DM Sans',sans-serif;font-size:0.8rem;font-weight:500;border:none;border-radius:6px;cursor:pointer;transition:all 0.2s }
        .ne-btn-next:hover:not(:disabled) { background:#c9a84c;transform:translateY(-1px) }
        .ne-btn-next:disabled { opacity:0.45;cursor:not-allowed }
        .ne-btn-next svg { width:14px;height:14px;display:block }
        .ne-btn-draft { display:flex;align-items:center;gap:0.4rem;padding:0.625rem 1.125rem;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--text-2);font-family:'DM Sans',sans-serif;font-size:0.8rem;cursor:pointer;transition:all 0.15s }
        .ne-btn-draft:hover:not(:disabled) { border-color:var(--border-hover);color:var(--text) }
        .ne-btn-draft:disabled { opacity:0.45;cursor:not-allowed }
        .ne-btn-publish { display:flex;align-items:center;gap:0.4rem;padding:0.625rem 1.5rem;background:#4caf7d;color:#fff;font-family:'DM Sans',sans-serif;font-size:0.8rem;font-weight:500;border:none;border-radius:6px;cursor:pointer;transition:all 0.2s }
        .ne-btn-publish:hover:not(:disabled) { background:#43a070;transform:translateY(-1px) }
        .ne-btn-publish:disabled { opacity:0.45;cursor:not-allowed }
        .ne-error { font-size:0.775rem;color:#ef4444;padding:0.75rem 1rem;border-radius:6px;margin-bottom:1rem;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2) }
        .ne-publish-row { display:flex;gap:0.75rem }
        .ne-seating-summary { margin-top:1.5rem;padding:1rem;background:var(--bg-3);border-radius:8px;border:1px solid var(--border) }
        .ne-seating-summary-title { font-size:0.72rem;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-2);margin-bottom:0.75rem }
        .ne-seating-row { display:flex;align-items:center;gap:0.625rem;padding:0.35rem 0;font-size:0.8rem;color:var(--text-2) }
        .ne-seating-dot { width:8px;height:8px;border-radius:50%;flex-shrink:0 }
        .ne-release-row { display:flex;align-items:center;gap:0.75rem }
        .ne-release-input { max-width:120px }
        .ne-release-label { font-size:0.8rem;color:var(--text-3) }
      `}</style>

      <div className="ne-root">

        <Link href="/events" className="ne-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back to Events
        </Link>

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

        {/* ══ STEP 1 — Event Details ══ */}
        {step === 1 && (
          <div className="ne-card">
            <h2 className="ne-title">Event Details</h2>
            <p className="ne-desc">
              Tell us about your event. This information appears on the RSVP page your guests will see.
            </p>

            <div className="ne-field">
              <label className="ne-label">Event Name <span className="ne-req">*</span></label>
              <input type="text" className="ne-input" placeholder="e.g. Tunde & Amaka's Wedding"
                value={form.name} onChange={e => setField("name", e.target.value)} />
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
              <input type="text" className="ne-input" placeholder="e.g. Eko Hotels & Suites"
                value={form.venueName} onChange={e => setField("venueName", e.target.value)} />
            </div>

            {/* ── Venue Address with Places Autocomplete ── */}
            <div className="ne-field">
              <label className="ne-label">Venue Address</label>
              <div className="ne-venue-group">
                <input
                  ref={venueInputRef}
                  type="text"
                  className="ne-input"
                  placeholder={mapsReady ? "Start typing to search location…" : "e.g. Victoria Island, Lagos"}
                  value={form.venueAddress}
                  onChange={e => handleVenueAddressChange(e.target.value)}
                  autoComplete="off"
                />

                {/* Pin confirmed indicator */}
                {form.venueLat && form.venueLng && (
                  <div className="ne-venue-pin-indicator">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Location pinned on map
                  </div>
                )}

                {/* No API key warning */}
                {!MAPS_KEY && (
                  <div className="ne-maps-unavailable">
                    ⚠ Google Maps not configured — add <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to your environment to enable location search.
                  </div>
                )}

                {/* Map preview */}
                {mapPreviewUrl && (
                  <div className="ne-map-preview">
                    <img src={mapPreviewUrl} alt="Venue location map" />
                    <div className="ne-map-preview-overlay">
                      <a
                        href={form.venueMapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ne-map-directions"
                      >
                        📍 Open in Google Maps
                      </a>
                      <button
                        type="button"
                        className="ne-map-clear"
                        onClick={() => {
                          setField("venueAddress", "")
                          setField("venueLat", "")
                          setField("venueLng", "")
                          setField("venueMapUrl", "")
                          setMapPreviewUrl(null)
                          if (venueInputRef.current) venueInputRef.current.value = ""
                        }}
                      >
                        Clear pin
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <span className="ne-hint">
                {mapsReady
                  ? "Search and select a location to pin it on the map. Guests will see this in their invite and confirmation email."
                  : "This address will appear on your RSVP page and in guest emails."
                }
              </span>
            </div>

            <div className="ne-field">
              <label className="ne-label">Venue Capacity</label>
              <input type="number" className="ne-input" placeholder="e.g. 300" min="1"
                value={form.venueCapacity} onChange={e => setField("venueCapacity", e.target.value)} />
              <span className="ne-hint">The RSVP link closes automatically when this number is reached.</span>
            </div>

            <div className="ne-field">
              <label className="ne-label">Description</label>
              <textarea className="ne-textarea" placeholder="A brief description for your guests..."
                value={form.description} onChange={e => setField("description", e.target.value)} />
            </div>

            {/* ── Invitation Card ── */}
            <div className="ne-field">
              <label className="ne-label">Invitation Card</label>
              <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.pdf" style={{ display:"none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }} />
              {!cardFile ? (
                <div
                  className={`ne-upload-zone${isDragging ? " drag-over" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  role="button" tabIndex={0}
                  onKeyDown={e => e.key === "Enter" && fileInputRef.current?.click()}
                >
                  <div className="ne-upload-icon">🖼️</div>
                  <div className="ne-upload-title">Upload Invitation Card</div>
                  <div className="ne-upload-sub">Drag & drop or <strong>click to browse</strong></div>
                  <div className="ne-upload-types">
                    <span className="ne-upload-type-badge">JPEG</span>
                    <span className="ne-upload-type-badge">PNG</span>
                    <span className="ne-upload-type-badge">PDF</span>
                    <span className="ne-upload-type-badge">Max 10 MB</span>
                  </div>
                </div>
              ) : (
                <div className="ne-card-preview">
                  {cardPreview
                    ? <img src={cardPreview} alt="Invitation card preview" className="ne-card-preview-img" />
                    : <div className="ne-card-preview-pdf">
                        <div className="ne-card-preview-pdf-icon">📄</div>
                        <div>
                          <div className="ne-card-preview-pdf-name">{cardFile.name}</div>
                          <div className="ne-card-preview-pdf-size">{(cardFile.size / 1024 / 1024).toFixed(2)} MB · PDF</div>
                        </div>
                      </div>
                  }
                  <div className="ne-card-preview-actions">
                    <button type="button" className="ne-card-change" onClick={() => fileInputRef.current?.click()}>Change</button>
                    <button type="button" className="ne-card-remove" onClick={removeCard}>Remove</button>
                    {cardPreview && <span style={{ fontSize:"0.7rem", color:"var(--text-3)", marginLeft:"auto", alignSelf:"center" }}>{cardFile.name} · {(cardFile.size / 1024 / 1024).toFixed(2)} MB</span>}
                  </div>
                </div>
              )}
              {cardError && <div className="ne-upload-error">{cardError}</div>}
              <span className="ne-hint">Appears on your RSVP page and is sent to guests alongside their QR code.</span>
            </div>
          </div>
        )}

        {/* ══ STEP 2 — Invite Settings ══ */}
        {step === 2 && (
          <div className="ne-card">
            <h2 className="ne-title">Invite Settings</h2>
            <p className="ne-desc">Choose how guests access your RSVP form.</p>

            <div className="ne-field">
              <label className="ne-label">Invite Model <span className="ne-req">*</span></label>
              <div className="ne-model-group">
                {(["OPEN","CLOSED"] as InviteModel[]).map(model => (
                  <div key={model} className={`ne-model-card${form.inviteModel === model ? " selected" : ""}`}
                    onClick={() => setField("inviteModel", model)} role="button" tabIndex={0}
                    onKeyDown={e => e.key === "Enter" && setField("inviteModel", model)}>
                    {form.inviteModel === model && (
                      <div className="ne-check">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                    <div className="ne-model-icon">{model === "OPEN" ? "🔓" : "🔒"}</div>
                    <div className="ne-model-title">{model === "OPEN" ? "Open Invite" : "Closed Invite"}</div>
                    <div className="ne-model-desc">
                      {model === "OPEN"
                        ? "A single public RSVP link — anyone with the link can register. Best for large or casual events."
                        : "Each guest receives a personalised link pre-bound to their name and phone. Recommended for intimate events."}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ne-switch-row">
              <div className="ne-switch-info">
                <div className="ne-switch-title">Phone Verification (OTP)</div>
                <div className="ne-switch-desc">Require guests to verify their phone with a 6-digit SMS code during RSVP.</div>
              </div>
              <div className={`ne-switch${form.requireOtp ? " on" : ""}`}
                onClick={() => setField("requireOtp", !form.requireOtp)}
                role="switch" tabIndex={0} aria-checked={form.requireOtp}
                onKeyDown={e => e.key === "Enter" && setField("requireOtp", !form.requireOtp)}>
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
                <label className="ne-label">Brand Colour</label>
                <div className="ne-color-row">
                  <input type="color" className="ne-color-swatch" value={form.brandColor} onChange={e => setField("brandColor", e.target.value)} />
                  <input type="text" className="ne-input ne-color-text" value={form.brandColor} onChange={e => setField("brandColor", e.target.value)} maxLength={7} placeholder="#C9A84C" />
                </div>
                <span className="ne-hint">Used on your event RSVP page.</span>
              </div>
            </div>
          </div>
        )}

        {/* ══ STEP 3 — Guest Tiers ══ */}
        {step === 3 && (
          <div className="ne-card">
            <h2 className="ne-title">Guest Tiers</h2>
            <p className="ne-desc">Tiers let you treat different guest groups differently.</p>
            <div className="ne-tier-list">
              {form.tiers.map(tier => (
                <div key={tier.id} className="ne-tier-card" style={{ "--tier-accent": tier.color } as React.CSSProperties}>
                  <div className="ne-tier-header">
                    <input type="color" className="ne-tier-swatch" value={tier.color} onChange={e => updateTier(tier.id, "color", e.target.value)} />
                    <input type="text" className="ne-tier-name" placeholder="Tier name e.g. VIP" value={tier.name} onChange={e => updateTier(tier.id, "name", e.target.value)} />
                    <button type="button" className="ne-tier-remove" onClick={() => removeTier(tier.id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div className="ne-tier-pills">
                    <span className="ne-pill-label">Seating:</span>
                    <button type="button" className={`ne-pill${tier.seatingType === "PRE_ASSIGNED" ? " seat-on" : ""}`} onClick={() => updateTier(tier.id, "seatingType", "PRE_ASSIGNED")}>Pre-assigned</button>
                    <button type="button" className={`ne-pill${tier.seatingType === "DYNAMIC" ? " seat-on" : ""}`} onClick={() => updateTier(tier.id, "seatingType", "DYNAMIC")}>Dynamic</button>
                    <span className="ne-pill-label" style={{ marginLeft:"0.25rem" }}>Menu:</span>
                    <button type="button" className={`ne-pill${tier.menuAccess === "PRE_EVENT" ? " menu-on" : ""}`} onClick={() => updateTier(tier.id, "menuAccess", "PRE_EVENT")}>Pre-order</button>
                    <button type="button" className={`ne-pill${tier.menuAccess === "AT_EVENT" ? " menu-on" : ""}`} onClick={() => updateTier(tier.id, "menuAccess", "AT_EVENT")}>At event</button>
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Tier
            </button>
          </div>
        )}

        {/* ══ STEP 4 — Tables & Seating ══ */}
        {step === 4 && (
          <div className="ne-card">
            <h2 className="ne-title">Tables & Seating</h2>
            <p className="ne-desc">Configure your venue's table layout.</p>
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
            </div>
            {form.tiers.filter(t => t.seatingType === "PRE_ASSIGNED").length > 0 && (
              <div className="ne-seating-summary">
                <div className="ne-seating-summary-title">Pre-assigned Tiers</div>
                {form.tiers.filter(t => t.seatingType === "PRE_ASSIGNED").map(t => (
                  <div key={t.id} className="ne-seating-row">
                    <div className="ne-seating-dot" style={{ background: t.color }} />
                    <span>{t.name || "Unnamed tier"}</span>
                    {t.tablePrefix && <span style={{ color:"var(--text-3)", fontSize:"0.72rem" }}>· Tables prefixed &quot;{t.tablePrefix}&quot;</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ STEP 5 — Menu Builder ══ */}
        {step === 5 && (
          <div className="ne-card">
            <h2 className="ne-title">Menu Builder</h2>
            <p className="ne-desc">Add food and drinks. Pre-order tiers select from this during RSVP.</p>
            {MENU_CATEGORIES.map(cat => {
              const items = form.menuItems.filter(m => m.category === cat.value)
              return (
                <div key={cat.value} className="ne-menu-section">
                  <div className="ne-menu-cat-header">
                    <div>
                      <span className="ne-menu-cat-label">{cat.label}</span>
                      <span style={{ fontSize:"0.68rem", color:"var(--text-3)", marginLeft:"0.5rem" }}>{cat.desc}</span>
                    </div>
                    <button type="button" className="ne-add" onClick={() => addMenuItem(cat.value)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
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
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                  {items.length === 0 && <div style={{ fontSize:"0.75rem", color:"var(--text-3)", padding:"0.5rem 0" }}>No {cat.label.toLowerCase()} items yet.</div>}
                </div>
              )
            })}
          </div>
        )}

        {/* ══ STEP 6 — Review ══ */}
        {step === 6 && (
          <div className="ne-card">
            <h2 className="ne-title">Review & Publish</h2>
            <p className="ne-desc">Review everything before publishing. You can always edit after publishing.</p>

            <div className="ne-review-section">
              <div className="ne-review-title">Event Details</div>
              <div className="ne-review-row"><span className="ne-review-key">Name</span><span className="ne-review-val">{form.name}</span></div>
              <div className="ne-review-row"><span className="ne-review-key">Type</span><span className="ne-review-val">{EVENT_TYPES.find(t => t.value === form.eventType)?.label}</span></div>
              <div className="ne-review-row">
                <span className="ne-review-key">Date</span>
                <span className="ne-review-val">{form.eventDate ? new Date(form.eventDate).toLocaleDateString("en-NG", { weekday:"long", day:"numeric", month:"long", year:"numeric" }) : "—"}</span>
              </div>
              {form.venueName    && <div className="ne-review-row"><span className="ne-review-key">Venue</span><span className="ne-review-val">{form.venueName}</span></div>}
              {form.venueAddress && <div className="ne-review-row"><span className="ne-review-key">Address</span><span className="ne-review-val">{form.venueAddress}</span></div>}
              {form.venueLat     && <div className="ne-review-row"><span className="ne-review-key">Map Pin</span><span className="ne-review-val" style={{ color:"#22c55e" }}>✓ Location pinned</span></div>}
              {form.venueCapacity && <div className="ne-review-row"><span className="ne-review-key">Capacity</span><span className="ne-review-val">{form.venueCapacity} guests</span></div>}
              <div className="ne-review-row"><span className="ne-review-key">Invitation Card</span><span className="ne-review-val">{cardFile ? `${cardFile.name} · ${(cardFile.size / 1024 / 1024).toFixed(2)} MB` : "None"}</span></div>
            </div>

            <div className="ne-review-section">
              <div className="ne-review-title">Invite Settings</div>
              <div className="ne-review-row"><span className="ne-review-key">Model</span><span className="ne-review-val">{form.inviteModel === "CLOSED" ? "🔒 Closed" : "🔓 Open"}</span></div>
              <div className="ne-review-row"><span className="ne-review-key">Phone OTP</span><span className="ne-review-val">{form.requireOtp ? "✓ Enabled" : "Disabled"}</span></div>
              {form.rsvpDeadline && <div className="ne-review-row"><span className="ne-review-key">RSVP Closes</span><span className="ne-review-val">{new Date(form.rsvpDeadline).toLocaleDateString("en-NG")}</span></div>}
            </div>

            <div className="ne-review-section">
              <div className="ne-review-title">Guest Tiers ({form.tiers.length})</div>
              {form.tiers.map(t => (
                <div key={t.id} className="ne-review-row">
                  <span className="ne-review-key" style={{ display:"flex", alignItems:"center", gap:"0.4rem" }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background:t.color, display:"inline-block" }} />
                    {t.name || "Unnamed"}
                  </span>
                  <span className="ne-review-val" style={{ fontSize:"0.72rem", color:"var(--text-3)" }}>
                    {t.seatingType === "PRE_ASSIGNED" ? "Pre-assigned" : "Dynamic"} · {t.menuAccess === "PRE_EVENT" ? "Pre-order" : "At event"}
                  </span>
                </div>
              ))}
            </div>

            <div className="ne-review-section">
              <div className="ne-review-title">Seating</div>
              {form.totalTables          && <div className="ne-review-row"><span className="ne-review-key">Total Tables</span><span className="ne-review-val">{form.totalTables}</span></div>}
              {form.seatsPerTable         && <div className="ne-review-row"><span className="ne-review-key">Seats Per Table</span><span className="ne-review-val">{form.seatsPerTable}</span></div>}
              {form.releaseReservedAfter  && <div className="ne-review-row"><span className="ne-review-key">Release Reserved</span><span className="ne-review-val">After {form.releaseReservedAfter} mins</span></div>}
            </div>

            <div className="ne-review-section">
              <div className="ne-review-title">Menu ({form.menuItems.length} items)</div>
              {form.menuItems.length === 0
                ? <div style={{ fontSize:"0.8rem", color:"var(--text-3)" }}>No menu items. Add them later from the event page.</div>
                : MENU_CATEGORIES.map(cat => {
                    const items = form.menuItems.filter(m => m.category === cat.value)
                    if (!items.length) return null
                    return (
                      <div key={cat.value}>
                        <div style={{ fontSize:"0.68rem", color:"var(--text-3)", margin:"0.5rem 0 0.25rem", textTransform:"uppercase", letterSpacing:"0.08em" }}>{cat.label}</div>
                        {items.map(item => (
                          <div key={item.id} className="ne-review-row">
                            <span className="ne-review-key">·</span>
                            <span className="ne-review-val">{item.name || "Unnamed"}</span>
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
            ? <button type="button" className="ne-btn-back" onClick={back}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                Back
              </button>
            : <div />
          }
          {step < 6
            ? <button type="button" className="ne-btn-next" onClick={next} disabled={!canProceed()}>
                Continue
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            : <div className="ne-publish-row">
                <button type="button" className="ne-btn-draft"   onClick={() => submit(false)} disabled={saving || cardUploading}>{saving ? "Saving…"      : "Save as Draft"}</button>
                <button type="button" className="ne-btn-publish" onClick={() => submit(true)}  disabled={saving || cardUploading}>{saving ? "Publishing…" : cardUploading ? "Uploading…" : "Publish Event"}</button>
              </div>
          }
        </div>

      </div>
    </>
  )
}
