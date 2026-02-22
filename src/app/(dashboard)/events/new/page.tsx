"use client"

// ─────────────────────────────────────────────
// src/app/(dashboard)/events/new/page.tsx
// Multi-step event creation — 6 steps.
// All TypeScript flags resolved:
//   - All inputs are fully controlled (value + onChange)
//   - All buttons have explicit type="button" or type="submit"
//   - No inline style mixed with className conflicts
//   - Color inputs use separate className to avoid
//     width/height conflicts with .new-input
// ─────────────────────────────────────────────

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

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
  { value: "APPETIZER", label: "Appetizer",    desc: "Starters & small chops"        },
  { value: "MAIN",      label: "Main Course",  desc: "Rice, swallow, proteins"       },
  { value: "DRINK",     label: "Drinks",       desc: "Alcoholic & non-alcoholic"     },
  { value: "DESSERT",   label: "Dessert",      desc: "Cake, ice cream, pastries"     },
  { value: "SPECIAL",   label: "Chef Special", desc: "Custom or signature items"     },
]

const uid = () => Math.random().toString(36).slice(2, 9)

const DEFAULT_TIERS: GuestTier[] = [
  { id: uid(), name: "VIP",           color: "#b48c3c", seatingType: "PRE_ASSIGNED", menuAccess: "PRE_EVENT", maxGuests: "", tablePrefix: "VIP-" },
  { id: uid(), name: "Family",        color: "#4caf7d", seatingType: "PRE_ASSIGNED", menuAccess: "PRE_EVENT", maxGuests: "", tablePrefix: "FAM-" },
  { id: uid(), name: "Special Guest", color: "#a78bfa", seatingType: "PRE_ASSIGNED", menuAccess: "PRE_EVENT", maxGuests: "", tablePrefix: "SG-"  },
  { id: uid(), name: "Friends",       color: "#4a9eff", seatingType: "DYNAMIC",      menuAccess: "AT_EVENT",  maxGuests: "", tablePrefix: ""     },
  { id: uid(), name: "Workmates",     color: "#38bdf8", seatingType: "DYNAMIC",      menuAccess: "AT_EVENT",  maxGuests: "", tablePrefix: ""     },
  { id: uid(), name: "General",       color: "#6b7280", seatingType: "DYNAMIC",      menuAccess: "AT_EVENT",  maxGuests: "", tablePrefix: ""     },
]

// ── Component ──────────────────────────────────────────────────

export default function NewEventPage() {
  const router = useRouter()
  const [step,   setStep]   = useState(1)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState("")

  const [form, setForm] = useState<FormData>({
    name: "", eventType: "WEDDING",
    eventDate: "", startTime: "", endTime: "",
    venueName: "", venueAddress: "", venueCapacity: "",
    description: "", invitationCard: "",
    inviteModel: "OPEN", requireOtp: false,
    rsvpDeadline: "", brandColor: "#C9A84C",
    tiers: DEFAULT_TIERS,
    totalTables: "", seatsPerTable: "10",
    releaseReservedAfter: "30",
    menuItems: [],
  })

  // Generic updater — keeps FormData fully controlled
  const setField = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  // ── Tier helpers ────────────────────────────────────────────

  const updateTier = (id: string, field: keyof GuestTier, value: string) =>
    setField("tiers", form.tiers.map(t => t.id === id ? { ...t, [field]: value } : t))

  const addTier = () =>
    setField("tiers", [...form.tiers, {
      id: uid(), name: "", color: TIER_COLORS[form.tiers.length % TIER_COLORS.length],
      seatingType: "DYNAMIC", menuAccess: "AT_EVENT", maxGuests: "", tablePrefix: "",
    }])

  const removeTier = (id: string) =>
    setField("tiers", form.tiers.filter(t => t.id !== id))

  // ── Menu helpers ─────────────────────────────────────────────

  const addMenuItem = (category: MenuCat) =>
    setField("menuItems", [...form.menuItems, { id: uid(), category, name: "", description: "" }])

  const updateMenuItem = (id: string, field: keyof MenuItemRow, value: string) =>
    setField("menuItems", form.menuItems.map(m => m.id === id ? { ...m, [field]: value } : m))

  const removeMenuItem = (id: string) =>
    setField("menuItems", form.menuItems.filter(m => m.id !== id))

  // ── Navigation ───────────────────────────────────────────────

  const canProceed = () => step === 1 ? (!!form.name.trim() && !!form.eventDate) : true
  const next = () => { if (canProceed()) setStep(s => Math.min(s + 1, 6)) }
  const back = () => setStep(s => Math.max(s - 1, 1))

  // ── Submit ───────────────────────────────────────────────────

  const submit = async (publish: boolean) => {
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          venueCapacity:        form.venueCapacity        || null,
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

  // ── Render ───────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .ne-root { max-width: 780px; margin: 0 auto; }

        /* Back */
        .ne-back {
          display: inline-flex; align-items: center; gap: 0.4rem;
          font-size: 0.775rem; color: var(--text-3);
          text-decoration: none; margin-bottom: 1.75rem;
          transition: color 0.15s;
        }
        .ne-back:hover { color: var(--text-2); }
        .ne-back svg { width: 14px; height: 14px; }

        /* Progress */
        .ne-progress { display: flex; align-items: center; margin-bottom: 2.5rem; }

        .ne-step {
          display: flex; align-items: center; gap: 0.5rem;
          flex: 1; position: relative;
        }
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
          background: var(--bg-2); color: var(--text-3);
          transition: all 0.2s;
        }
        .ne-step.active .ne-dot { border-color: var(--gold); background: var(--gold-dim); color: var(--gold); }
        .ne-step.done   .ne-dot { border-color: var(--gold); background: var(--gold); color: #0a0a0a; }

        .ne-step-label {
          font-size: 0.68rem; color: var(--text-3);
          letter-spacing: 0.03em; white-space: nowrap;
          display: none;
        }
        .ne-step.active .ne-step-label { color: var(--gold); }
        .ne-step.done   .ne-step-label { color: var(--text-2); }
        @media (min-width: 600px) { .ne-step-label { display: block; } }

        /* Card */
        .ne-card {
          background: var(--bg-2); border: 1px solid var(--border);
          border-radius: 12px; padding: 2rem; margin-bottom: 1.5rem;
        }

        .ne-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.5rem; font-weight: 300;
          color: var(--text); letter-spacing: -0.01em; margin-bottom: 0.375rem;
        }

        .ne-desc {
          font-size: 0.8rem; color: var(--text-3); font-weight: 300;
          line-height: 1.6; margin-bottom: 1.75rem;
          padding-bottom: 1.5rem; border-bottom: 1px solid var(--border);
        }

        /* Fields */
        .ne-field { margin-bottom: 1.25rem; }

        .ne-label {
          display: block; font-size: 0.75rem; font-weight: 500;
          color: var(--text-2); letter-spacing: 0.03em; margin-bottom: 0.4rem;
        }

        .ne-hint {
          display: block; font-size: 0.7rem; color: var(--text-3);
          font-weight: 300; line-height: 1.5; margin-top: 0.3rem;
        }

        /* Base styles shared by text inputs, selects, textareas */
        .ne-input, .ne-select, .ne-textarea {
          width: 100%; padding: 0.625rem 0.875rem;
          background: var(--bg-3); border: 1px solid var(--border);
          border-radius: 6px; color: var(--text);
          font-family: 'DM Sans', sans-serif; font-size: 0.825rem;
          transition: border-color 0.15s; outline: none;
          box-sizing: border-box;
        }
        .ne-input:focus, .ne-select:focus, .ne-textarea:focus { border-color: var(--gold); }
        .ne-textarea { resize: vertical; min-height: 80px; line-height: 1.6; }
        .ne-select option { background: var(--bg-2); }

        /* Color picker — separate class so it doesn't inherit width:100% */
        .ne-color-swatch {
          width: 40px; height: 38px; padding: 2px;
          background: var(--bg-3); border: 1px solid var(--border);
          border-radius: 6px; cursor: pointer; flex-shrink: 0;
          display: block;
        }
        .ne-color-swatch:focus { outline: 2px solid var(--gold); }

        .ne-color-row { display: flex; gap: 0.5rem; align-items: center; }
        .ne-color-text { flex: 1; }

        /* Two-col row */
        .ne-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        @media (max-width: 480px) { .ne-row { grid-template-columns: 1fr; } }

        /* Required asterisk */
        .ne-req { color: var(--gold); margin-left: 2px; }

        /* ── Invite model toggle cards ── */
        .ne-model-group {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 0.875rem; margin-bottom: 1.25rem;
        }
        @media (max-width: 480px) { .ne-model-group { grid-template-columns: 1fr; } }

        .ne-model-card {
          padding: 1.125rem; border: 1.5px solid var(--border);
          border-radius: 8px; cursor: pointer;
          transition: all 0.2s; background: var(--bg-3); position: relative;
        }
        .ne-model-card:hover { border-color: var(--border-hover); }
        .ne-model-card.selected { border-color: var(--gold); background: var(--gold-dim); }

        .ne-model-icon  { font-size: 1.375rem; margin-bottom: 0.625rem; }
        .ne-model-title { font-size: 0.825rem; font-weight: 500; color: var(--text); margin-bottom: 0.375rem; }
        .ne-model-desc  { font-size: 0.72rem; color: var(--text-3); line-height: 1.55; font-weight: 300; }

        .ne-check {
          position: absolute; top: 0.75rem; right: 0.75rem;
          width: 18px; height: 18px; border-radius: 50%;
          background: var(--gold);
          display: flex; align-items: center; justify-content: center;
        }
        .ne-check svg { width: 10px; height: 10px; }

        /* ── OTP switch ── */
        .ne-switch-row {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 1rem; padding: 1rem; background: var(--bg-3);
          border: 1px solid var(--border); border-radius: 8px; margin-bottom: 1.25rem;
        }
        .ne-switch-info  { flex: 1; }
        .ne-switch-title { font-size: 0.825rem; font-weight: 500; color: var(--text); margin-bottom: 0.25rem; }
        .ne-switch-desc  { font-size: 0.72rem; color: var(--text-3); line-height: 1.5; font-weight: 300; }

        .ne-switch {
          width: 40px; height: 22px; border-radius: 11px;
          background: var(--bg); border: 1.5px solid var(--border);
          cursor: pointer; flex-shrink: 0; position: relative;
          transition: all 0.2s; margin-top: 2px;
        }
        .ne-switch.on { background: var(--gold); border-color: var(--gold); }
        .ne-switch-thumb {
          position: absolute; top: 2px; left: 2px;
          width: 14px; height: 14px; border-radius: 50%;
          background: var(--text-3); transition: all 0.2s;
        }
        .ne-switch.on .ne-switch-thumb { left: 20px; background: #0a0a0a; }

        /* ── Tier builder ── */
        .ne-tier-list { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem; }

        .ne-tier-card {
          background: var(--bg-3); border: 1px solid var(--border);
          border-radius: 8px; padding: 1rem; position: relative;
        }
        .ne-tier-card::before {
          content: ''; position: absolute;
          left: 0; top: 0; bottom: 0; width: 3px;
          border-radius: 8px 0 0 8px;
          background: var(--tier-accent, var(--gold));
        }

        .ne-tier-header {
          display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.875rem;
        }

        /* Color swatch inside tier — small circle variant */
        .ne-tier-swatch {
          width: 22px; height: 22px; padding: 0;
          border: none; border-radius: 50%;
          cursor: pointer; flex-shrink: 0;
          display: block;
        }
        .ne-tier-swatch:focus { outline: 2px solid var(--gold); }

        .ne-tier-name {
          flex: 1; padding: 0.375rem 0.625rem;
          background: var(--bg-2); border: 1px solid var(--border);
          border-radius: 5px; color: var(--text);
          font-family: 'DM Sans', sans-serif; font-size: 0.825rem; outline: none;
        }
        .ne-tier-name:focus { border-color: var(--gold); }

        .ne-tier-remove {
          background: transparent; border: none;
          color: var(--text-3); cursor: pointer;
          padding: 0.25rem; border-radius: 4px; transition: color 0.15s;
        }
        .ne-tier-remove:hover { color: #ef4444; }
        .ne-tier-remove svg { width: 14px; height: 14px; display: block; }

        .ne-tier-pills { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem; }

        .ne-pill {
          font-size: 0.65rem; font-weight: 500;
          letter-spacing: 0.06em; text-transform: uppercase;
          padding: 0.25rem 0.625rem; border-radius: 20px;
          border: 1px solid var(--border); background: transparent;
          cursor: pointer; color: var(--text-3); transition: all 0.15s;
          font-family: 'DM Sans', sans-serif;
        }
        .ne-pill:hover { border-color: var(--border-hover); color: var(--text-2); }
        .ne-pill.seat-on { border-color: #4a9eff; background: rgba(74,158,255,0.1); color: #4a9eff; }
        .ne-pill.menu-on { border-color: #4caf7d; background: rgba(76,175,125,0.1); color: #4caf7d; }

        .ne-pill-label { font-size: 0.68rem; color: var(--text-3); }

        .ne-tier-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }

        .ne-tier-meta-input {
          padding: 0.35rem 0.625rem;
          background: var(--bg-2); border: 1px solid var(--border);
          border-radius: 5px; color: var(--text);
          font-family: 'DM Sans', sans-serif; font-size: 0.775rem; outline: none;
          box-sizing: border-box; width: 100%;
        }
        .ne-tier-meta-input:focus { border-color: var(--gold); }

        /* Add button (dashed outline style) */
        .ne-add {
          display: inline-flex; align-items: center; gap: 0.4rem;
          padding: 0.5rem 1rem; border: 1px dashed var(--border);
          border-radius: 6px; background: transparent;
          color: var(--text-3); font-family: 'DM Sans', sans-serif;
          font-size: 0.775rem; cursor: pointer; transition: all 0.15s;
        }
        .ne-add:hover { border-color: var(--gold); color: var(--gold); }
        .ne-add svg { width: 13px; height: 13px; display: block; }

        /* ── Menu builder ── */
        .ne-menu-section { margin-bottom: 1.5rem; }
        .ne-menu-cat-header {
          display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 0.75rem;
        }
        .ne-menu-cat-label {
          font-size: 0.72rem; font-weight: 500;
          letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-2);
        }
        .ne-menu-item-row {
          background: var(--bg-3); border: 1px solid var(--border);
          border-radius: 7px; padding: 0.875rem; margin-bottom: 0.5rem;
          display: flex; gap: 0.75rem; align-items: flex-start;
        }
        .ne-menu-item-fields { flex: 1; display: flex; flex-direction: column; gap: 0.4rem; }

        /* ── Review ── */
        .ne-review-section {
          margin-bottom: 1.25rem; padding-bottom: 1.25rem;
          border-bottom: 1px solid var(--border);
        }
        .ne-review-section:last-child { border-bottom: none; margin-bottom: 0; }
        .ne-review-title {
          font-size: 0.72rem; font-weight: 500;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--gold); margin-bottom: 0.875rem;
        }
        .ne-review-row {
          display: flex; justify-content: space-between;
          align-items: baseline; font-size: 0.8rem;
          padding: 0.3rem 0; gap: 1rem;
        }
        .ne-review-key { color: var(--text-3); flex-shrink: 0; }
        .ne-review-val { color: var(--text); text-align: right; }

        /* ── Actions bar ── */
        .ne-actions {
          display: flex; justify-content: space-between;
          align-items: center; gap: 1rem;
        }
        .ne-btn-back {
          display: flex; align-items: center; gap: 0.4rem;
          padding: 0.625rem 1.125rem; border: 1px solid var(--border);
          border-radius: 6px; background: transparent; color: var(--text-2);
          font-family: 'DM Sans', sans-serif; font-size: 0.8rem;
          cursor: pointer; transition: all 0.15s;
        }
        .ne-btn-back:hover { border-color: var(--border-hover); color: var(--text); }
        .ne-btn-back svg { width: 14px; height: 14px; display: block; }

        .ne-btn-next {
          display: flex; align-items: center; gap: 0.4rem;
          padding: 0.625rem 1.5rem; background: var(--gold); color: #0a0a0a;
          font-family: 'DM Sans', sans-serif; font-size: 0.8rem; font-weight: 500;
          border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s;
        }
        .ne-btn-next:hover:not(:disabled) { background: #c9a84c; transform: translateY(-1px); }
        .ne-btn-next:disabled { opacity: 0.45; cursor: not-allowed; }
        .ne-btn-next svg { width: 14px; height: 14px; display: block; }

        .ne-btn-draft {
          display: flex; align-items: center; gap: 0.4rem;
          padding: 0.625rem 1.125rem; border: 1px solid var(--border);
          border-radius: 6px; background: transparent; color: var(--text-2);
          font-family: 'DM Sans', sans-serif; font-size: 0.8rem;
          cursor: pointer; transition: all 0.15s;
        }
        .ne-btn-draft:hover:not(:disabled) { border-color: var(--border-hover); color: var(--text); }
        .ne-btn-draft:disabled { opacity: 0.45; cursor: not-allowed; }

        .ne-btn-publish {
          display: flex; align-items: center; gap: 0.4rem;
          padding: 0.625rem 1.5rem; background: #4caf7d; color: #fff;
          font-family: 'DM Sans', sans-serif; font-size: 0.8rem; font-weight: 500;
          border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s;
        }
        .ne-btn-publish:hover:not(:disabled) { background: #43a070; transform: translateY(-1px); }
        .ne-btn-publish:disabled { opacity: 0.45; cursor: not-allowed; }

        .ne-error {
          font-size: 0.775rem; color: #ef4444;
          padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 1rem;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
        }

        .ne-publish-row { display: flex; gap: 0.75rem; }

        /* Seating summary box */
        .ne-seating-summary {
          margin-top: 1.5rem; padding: 1rem;
          background: var(--bg-3); border-radius: 8px;
          border: 1px solid var(--border);
        }
        .ne-seating-summary-title {
          font-size: 0.72rem; font-weight: 500;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-2); margin-bottom: 0.75rem;
        }
        .ne-seating-row {
          display: flex; align-items: center; gap: 0.625rem;
          padding: 0.35rem 0; font-size: 0.8rem; color: var(--text-2);
        }
        .ne-seating-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }

        /* Release row */
        .ne-release-row { display: flex; align-items: center; gap: 0.75rem; }
        .ne-release-input { max-width: 120px; }
        .ne-release-label { font-size: 0.8rem; color: var(--text-3); }
      `}</style>

      <div className="ne-root">

        {/* Back */}
        <Link href="/events" className="ne-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back to Events
        </Link>

        {/* Step progress */}
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
              Tell us about your event. This information appears on the RSVP page
              your guests will see when they register.
            </p>

            <div className="ne-field">
              <label className="ne-label">Event Name <span className="ne-req">*</span></label>
              <input
                type="text"
                className="ne-input"
                placeholder="e.g. Tunde & Amaka's Wedding"
                value={form.name}
                onChange={e => setField("name", e.target.value)}
              />
            </div>

            <div className="ne-row">
              <div className="ne-field">
                <label className="ne-label">Event Type</label>
                <select
                  className="ne-select"
                  value={form.eventType}
                  onChange={e => setField("eventType", e.target.value)}
                >
                  {EVENT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="ne-field">
                <label className="ne-label">Event Date <span className="ne-req">*</span></label>
                <input
                  type="date"
                  className="ne-input"
                  value={form.eventDate}
                  onChange={e => setField("eventDate", e.target.value)}
                />
              </div>
            </div>

            <div className="ne-row">
              <div className="ne-field">
                <label className="ne-label">Start Time</label>
                <input
                  type="time"
                  className="ne-input"
                  value={form.startTime}
                  onChange={e => setField("startTime", e.target.value)}
                />
              </div>
              <div className="ne-field">
                <label className="ne-label">End Time</label>
                <input
                  type="time"
                  className="ne-input"
                  value={form.endTime}
                  onChange={e => setField("endTime", e.target.value)}
                />
              </div>
            </div>

            <div className="ne-field">
              <label className="ne-label">Venue Name</label>
              <input
                type="text"
                className="ne-input"
                placeholder="e.g. Eko Hotels & Suites"
                value={form.venueName}
                onChange={e => setField("venueName", e.target.value)}
              />
            </div>

            <div className="ne-row">
              <div className="ne-field">
                <label className="ne-label">Venue Address</label>
                <input
                  type="text"
                  className="ne-input"
                  placeholder="e.g. Victoria Island, Lagos"
                  value={form.venueAddress}
                  onChange={e => setField("venueAddress", e.target.value)}
                />
              </div>
              <div className="ne-field">
                <label className="ne-label">Venue Capacity</label>
                <input
                  type="number"
                  className="ne-input"
                  placeholder="e.g. 300"
                  min="1"
                  value={form.venueCapacity}
                  onChange={e => setField("venueCapacity", e.target.value)}
                />
                <span className="ne-hint">The RSVP link closes automatically when this number is reached.</span>
              </div>
            </div>

            <div className="ne-field">
              <label className="ne-label">Description</label>
              <textarea
                className="ne-textarea"
                placeholder="A brief description of the event for your guests..."
                value={form.description}
                onChange={e => setField("description", e.target.value)}
              />
            </div>

            <div className="ne-field">
              <label className="ne-label">Invitation Card</label>
              <input
                type="url"
                className="ne-input"
                placeholder="Paste image URL (upload coming soon)"
                value={form.invitationCard}
                onChange={e => setField("invitationCard", e.target.value)}
              />
              <span className="ne-hint">
                The host's invitation card. It appears as the hero image on the RSVP page
                and is sent to guests alongside their QR code.
              </span>
            </div>
          </div>
        )}

        {/* ══ STEP 2 — Invite Settings ══ */}
        {step === 2 && (
          <div className="ne-card">
            <h2 className="ne-title">Invite Settings</h2>
            <p className="ne-desc">
              Choose how guests access your RSVP form. This is your first line of
              defence against gate crashing.
            </p>

            <div className="ne-field">
              <label className="ne-label">Invite Model <span className="ne-req">*</span></label>
              <div className="ne-model-group">

                <div
                  className={`ne-model-card${form.inviteModel === "OPEN" ? " selected" : ""}`}
                  onClick={() => setField("inviteModel", "OPEN")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === "Enter" && setField("inviteModel", "OPEN")}
                  aria-pressed={form.inviteModel === "OPEN"}
                >
                  {form.inviteModel === "OPEN" && (
                    <div className="ne-check">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  )}
                  <div className="ne-model-icon">🔓</div>
                  <div className="ne-model-title">Open Invite</div>
                  <div className="ne-model-desc">
                    A single public RSVP link — anyone with the link can register.
                    Best for large or casual events. QR codes generated are unique
                    and single-use.
                  </div>
                </div>

                <div
                  className={`ne-model-card${form.inviteModel === "CLOSED" ? " selected" : ""}`}
                  onClick={() => setField("inviteModel", "CLOSED")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === "Enter" && setField("inviteModel", "CLOSED")}
                  aria-pressed={form.inviteModel === "CLOSED"}
                >
                  {form.inviteModel === "CLOSED" && (
                    <div className="ne-check">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  )}
                  <div className="ne-model-icon">🔒</div>
                  <div className="ne-model-title">Closed Invite</div>
                  <div className="ne-model-desc">
                    Each guest receives a personalised link pre-bound to their name
                    and phone number. Nobody else can use their link.
                    Recommended for intimate or high-security events.
                  </div>
                </div>

              </div>
            </div>

            {/* OTP switch */}
            <div className="ne-switch-row">
              <div className="ne-switch-info">
                <div className="ne-switch-title">Phone Verification (OTP)</div>
                <div className="ne-switch-desc">
                  Require guests to verify their phone with a 6-digit SMS code during
                  RSVP. Ties each QR code to a confirmed number. Note: SMS charges
                  apply per event based on guest count.
                </div>
              </div>
              <div
                className={`ne-switch${form.requireOtp ? " on" : ""}`}
                onClick={() => setField("requireOtp", !form.requireOtp)}
                role="switch"
                tabIndex={0}
                aria-checked={form.requireOtp}
                onKeyDown={e => e.key === "Enter" && setField("requireOtp", !form.requireOtp)}
              >
                <div className="ne-switch-thumb" />
              </div>
            </div>

            <div className="ne-row">
              <div className="ne-field">
                <label className="ne-label">RSVP Deadline</label>
                <input
                  type="date"
                  className="ne-input"
                  value={form.rsvpDeadline}
                  onChange={e => setField("rsvpDeadline", e.target.value)}
                />
                <span className="ne-hint">RSVP form closes on this date. Leave blank to close manually.</span>
              </div>
              <div className="ne-field">
                <label className="ne-label">Brand Colour</label>
                <div className="ne-color-row">
                  <input
                    type="color"
                    className="ne-color-swatch"
                    value={form.brandColor}
                    onChange={e => setField("brandColor", e.target.value)}
                    title="Pick brand colour"
                    aria-label="Pick brand colour"
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
                <span className="ne-hint">Used on your event's RSVP page.</span>
              </div>
            </div>
          </div>
        )}

        {/* ══ STEP 3 — Guest Tiers ══ */}
        {step === 3 && (
          <div className="ne-card">
            <h2 className="ne-title">Guest Tiers</h2>
            <p className="ne-desc">
              Tiers let you treat different guest groups differently. Premium tiers
              (VIP, Family, Special Guests) get pre-assigned seats and can pre-select
              meals during RSVP. Other tiers get dynamic seating and order at the event.
            </p>

            <div className="ne-tier-list">
              {form.tiers.map(tier => (
                <div
                  key={tier.id}
                  className="ne-tier-card"
                  style={{ "--tier-accent": tier.color } as React.CSSProperties}
                >
                  <div className="ne-tier-header">
                    <input
                      type="color"
                      className="ne-tier-swatch"
                      value={tier.color}
                      onChange={e => updateTier(tier.id, "color", e.target.value)}
                      title="Pick tier colour"
                      aria-label={`Colour for ${tier.name || "tier"}`}
                    />
                    <input
                      type="text"
                      className="ne-tier-name"
                      placeholder="Tier name e.g. VIP"
                      value={tier.name}
                      onChange={e => updateTier(tier.id, "name", e.target.value)}
                    />
                    <button
                      type="button"
                      className="ne-tier-remove"
                      onClick={() => removeTier(tier.id)}
                      title="Remove this tier"
                      aria-label={`Remove ${tier.name || "tier"}`}
                    >
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
                    <input
                      type="number"
                      className="ne-tier-meta-input"
                      placeholder="Max guests (optional)"
                      min="1"
                      value={tier.maxGuests}
                      onChange={e => updateTier(tier.id, "maxGuests", e.target.value)}
                    />
                    {tier.seatingType === "PRE_ASSIGNED" && (
                      <input
                        type="text"
                        className="ne-tier-meta-input"
                        placeholder='Table prefix e.g. VIP-'
                        value={tier.tablePrefix}
                        onChange={e => updateTier(tier.id, "tablePrefix", e.target.value)}
                      />
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

        {/* ══ STEP 4 — Tables & Seating ══ */}
        {step === 4 && (
          <div className="ne-card">
            <h2 className="ne-title">Tables & Seating</h2>
            <p className="ne-desc">
              Configure your venue's table layout. Tables reserved for premium tiers
              are pre-assigned before the event. General tables are filled dynamically
              as guests arrive and scan at the gate.
            </p>

            <div className="ne-row">
              <div className="ne-field">
                <label className="ne-label">Total Tables</label>
                <input
                  type="number"
                  className="ne-input"
                  placeholder="e.g. 30"
                  min="1"
                  value={form.totalTables}
                  onChange={e => setField("totalTables", e.target.value)}
                />
                <span className="ne-hint">Total number of tables at the venue.</span>
              </div>
              <div className="ne-field">
                <label className="ne-label">Seats Per Table</label>
                <input
                  type="number"
                  className="ne-input"
                  placeholder="e.g. 10"
                  min="1"
                  value={form.seatsPerTable}
                  onChange={e => setField("seatsPerTable", e.target.value)}
                />
                <span className="ne-hint">Default seats at each table.</span>
              </div>
            </div>

            <div className="ne-field">
              <label className="ne-label">Release Reserved Seats After</label>
              <div className="ne-release-row">
                <input
                  type="number"
                  className="ne-input ne-release-input"
                  placeholder="e.g. 30"
                  min="0"
                  value={form.releaseReservedAfter}
                  onChange={e => setField("releaseReservedAfter", e.target.value)}
                />
                <span className="ne-release-label">minutes after event start</span>
              </div>
              <span className="ne-hint">
                If a pre-assigned guest hasn't arrived after this time, their reserved
                seat is released to the general pool. Leave blank to never release.
              </span>
            </div>

            {form.tiers.filter(t => t.seatingType === "PRE_ASSIGNED").length > 0 && (
              <div className="ne-seating-summary">
                <div className="ne-seating-summary-title">Pre-assigned Tiers</div>
                {form.tiers.filter(t => t.seatingType === "PRE_ASSIGNED").map(t => (
                  <div key={t.id} className="ne-seating-row">
                    <div className="ne-seating-dot" style={{ background: t.color }} />
                    <span>{t.name || "Unnamed tier"}</span>
                    {t.tablePrefix && (
                      <span style={{ color: "var(--text-3)", fontSize: "0.72rem" }}>
                        · Tables prefixed &quot;{t.tablePrefix}&quot;
                      </span>
                    )}
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
            <p className="ne-desc">
              Add the food and drinks for your event. Only guests in pre-order tiers
              (VIP, Family, Special Guests) will select from this menu during RSVP.
              All other guests order directly from waitstaff at the event.
              The caterer can also manage this menu from their vendor portal.
            </p>

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
                        <input
                          type="text"
                          className="ne-input"
                          placeholder={`${cat.label} name e.g. Jollof Rice & Chicken`}
                          value={item.name}
                          onChange={e => updateMenuItem(item.id, "name", e.target.value)}
                        />
                        <input
                          type="text"
                          className="ne-input"
                          placeholder="Description (optional) e.g. Served with coleslaw"
                          value={item.description}
                          onChange={e => updateMenuItem(item.id, "description", e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="ne-tier-remove"
                        onClick={() => removeMenuItem(item.id)}
                        title="Remove item"
                        aria-label={`Remove ${item.name || "menu item"}`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  ))}

                  {items.length === 0 && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-3)", padding: "0.5rem 0" }}>
                      No {cat.label.toLowerCase()} items yet.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ══ STEP 6 — Review & Publish ══ */}
        {step === 6 && (
          <div className="ne-card">
            <h2 className="ne-title">Review & Publish</h2>
            <p className="ne-desc">
              Review everything before publishing. You can always edit after publishing.
              Save as Draft if you&apos;re not ready to go live yet.
            </p>

            <div className="ne-review-section">
              <div className="ne-review-title">Event Details</div>
              <div className="ne-review-row"><span className="ne-review-key">Name</span><span className="ne-review-val">{form.name}</span></div>
              <div className="ne-review-row"><span className="ne-review-key">Type</span><span className="ne-review-val">{EVENT_TYPES.find(t => t.value === form.eventType)?.label}</span></div>
              <div className="ne-review-row">
                <span className="ne-review-key">Date</span>
                <span className="ne-review-val">
                  {form.eventDate ? new Date(form.eventDate).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "—"}
                </span>
              </div>
              {form.venueName     && <div className="ne-review-row"><span className="ne-review-key">Venue</span><span className="ne-review-val">{form.venueName}</span></div>}
              {form.venueCapacity && <div className="ne-review-row"><span className="ne-review-key">Capacity</span><span className="ne-review-val">{form.venueCapacity} guests</span></div>}
            </div>

            <div className="ne-review-section">
              <div className="ne-review-title">Invite Settings</div>
              <div className="ne-review-row"><span className="ne-review-key">Model</span><span className="ne-review-val">{form.inviteModel === "CLOSED" ? "🔒 Closed Invite" : "🔓 Open Invite"}</span></div>
              <div className="ne-review-row"><span className="ne-review-key">Phone OTP</span><span className="ne-review-val">{form.requireOtp ? "✓ Enabled" : "Disabled"}</span></div>
              {form.rsvpDeadline && <div className="ne-review-row"><span className="ne-review-key">RSVP Closes</span><span className="ne-review-val">{new Date(form.rsvpDeadline).toLocaleDateString("en-NG")}</span></div>}
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
                    {t.seatingType === "PRE_ASSIGNED" ? "Pre-assigned" : "Dynamic"} · {t.menuAccess === "PRE_EVENT" ? "Pre-order menu" : "At-event ordering"}
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
                ? <div style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>No menu items added. You can add them later from the event page.</div>
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

        {/* Error */}
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
                <button type="button" className="ne-btn-draft"   onClick={() => submit(false)} disabled={saving}>{saving ? "Saving..."      : "Save as Draft"  }</button>
                <button type="button" className="ne-btn-publish" onClick={() => submit(true)}  disabled={saving}>{saving ? "Publishing..." : "Publish Event"  }</button>
              </div>
            )
          }
        </div>

      </div>
    </>
  )
}
