// ─────────────────────────────────────────────
// FILE: src/app/vendor/[portalToken]/page.tsx
//
// PUBLIC portal for vendors — no login required.
// Vendor accesses via the unique link:
//   https://eventflowng.vercel.app/vendor/[portalToken]
//
// The portalToken maps to Vendor.portalToken in
// the database (a cuid).
//
// PRIVACY RULE (from schema comments):
//   Vendors never see guest names or personal
//   details. They only see:
//     - Total guest headcount
//     - Meal tallies (caterers only)
//     - Check-in progress numbers
//
// What vendors see by role:
//   CATERER     → headcount + meal selection breakdown
//   SECURITY    → headcount + check-in progress + walk-in override
//   MEDIA/OTHER → event details + their role + staff info
// ─────────────────────────────────────────────

"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

// ── Types ─────────────────────────────────────

interface MealTally {
  menuItemId:  string
  name:        string
  category:    string
  totalOrders: number
}

interface VendorPortalData {
  vendor: {
    id:                     string
    name:                   string
    contactName:            string | null
    role:                   string
    staffCount:             number | null
    canOverrideCapacity:    boolean
    capacityOverrideActive: boolean
    notes:                  string | null
  }
  event: {
    id:             string
    name:           string
    eventDate:      string
    startTime:      string | null
    endTime:        string | null
    venueName:      string | null
    venueAddress:   string | null
    status:         string
    invitationCard: string | null
  }
  stats: {
    totalGuests:  number
    checkedIn:    number
    pending:      number
  }
  // Only populated for CATERER vendors
  mealTallies: MealTally[]
}

// ── Role label helper ─────────────────────────
// Converts enum value (e.g. LIVE_BAND) to display label

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    CATERER:      "Caterer",
    SECURITY:     "Security",
    MEDIA:        "Media",
    LIVE_BAND:    "Live Band",
    DJ:           "DJ",
    MC:           "MC",
    HYPEMAN:      "Hypeman",
    AFTER_PARTY:  "After Party",
    DECORATOR:    "Decorator",
    PHOTOGRAPHER: "Photographer",
    VIDEOGRAPHER: "Videographer",
    OTHER:        "Vendor",
  }
  return map[role] ?? role
}

// ── Main Component ────────────────────────────

export default function VendorPortalPage() {
  const { portalToken } = useParams<{ portalToken: string }>()

  const [data,      setData]      = useState<VendorPortalData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [toggling,  setToggling]  = useState(false) // Walk-in mode toggle loading state

  // Fetch vendor + event data on mount
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/vendor/${portalToken}`)
        if (res.status === 404) { setError("This vendor link is invalid or has expired."); return }
        if (!res.ok)            { setError("Failed to load your portal. Please try again."); return }
        setData(await res.json())
      } catch {
        setError("Network error — please check your connection.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [portalToken])

  // Toggle walk-in (capacity override) mode for SECURITY vendors
  const handleOverrideToggle = async () => {
    if (!data || toggling) return
    setToggling(true)
    try {
      const res = await fetch(`/api/vendor/${portalToken}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Send the opposite of current state to toggle it
          active: !data.vendor.capacityOverrideActive,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        // Update just the override state without re-fetching everything
        setData(prev => prev ? {
          ...prev,
          vendor: { ...prev.vendor, capacityOverrideActive: updated.capacityOverrideActive }
        } : prev)
      }
    } catch {
      // Silent fail — state stays unchanged
    } finally {
      setToggling(false)
    }
  }

  // ── Loading state ──────────────────────────
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", gap: "0.75rem" }}>
      <div style={{ width: 22, height: 22, border: "1.5px solid rgba(180,140,60,0.2)", borderTopColor: "#b48c3c", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ── Error state ────────────────────────────
  if (error || !data) return (
    <div style={{ padding: "3rem", textAlign: "center", fontFamily: "sans-serif" }}>
      <p style={{ color: "#6b7280", marginBottom: "0.5rem", fontSize: "0.9rem" }}>{error ?? "Portal unavailable"}</p>
      <p style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Contact your event planner for a new link.</p>
    </div>
  )

  const { vendor, event, stats, mealTallies } = data
  const isCaterer  = vendor.role === "CATERER"
  const isSecurity = vendor.role === "SECURITY"

  const eventDate = new Date(event.eventDate).toLocaleDateString("en-NG", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  })
  const checkinPct = stats.totalGuests > 0
    ? Math.round((stats.checkedIn / stats.totalGuests) * 100)
    : 0

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Cormorant+Garamond:wght@300;400&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; background: #0a0a0a; color: #f0ede6; font-family: 'DM Sans', sans-serif; }

        .vp-wrap  { max-width: 480px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }

        .vp-badge { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0.75rem; border: 1px solid #2a2a2a; background: #161616; font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 1.25rem; color: #b48c3c; }

        .vp-hero  { background: #111; border: 1px solid #2a2a2a; padding: 1.25rem; margin-bottom: 1rem; }
        .vp-event-name { font-family: 'Cormorant Garamond', serif; font-size: 1.5rem; font-weight: 300; margin-bottom: 0.5rem; color: #f0ede6; }
        .vp-meta  { font-size: 0.75rem; color: #6b7280; line-height: 1.8; }

        .vp-card  { background: #111; border: 1px solid #2a2a2a; padding: 1.25rem; margin-bottom: 1rem; }
        .vp-card-title { font-size: 0.6rem; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; color: #b48c3c; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.75rem; }
        .vp-card-title::after { content: ''; flex: 1; height: 1px; background: #2a2a2a; }

        .vp-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.625rem; margin-bottom: 1rem; }
        .vp-stat  { background: #161616; border: 1px solid #2a2a2a; padding: 0.875rem; text-align: center; }
        .vp-stat-num   { font-family: 'Cormorant Garamond', serif; font-size: 1.75rem; font-weight: 300; color: #b48c3c; line-height: 1; margin-bottom: 0.2rem; }
        .vp-stat-label { font-size: 0.58rem; color: #6b7280; letter-spacing: 0.1em; text-transform: uppercase; }

        .vp-progress-label { display: flex; justify-content: space-between; font-size: 0.72rem; color: #6b7280; margin-bottom: 0.5rem; }
        .vp-progress-track { height: 4px; background: #2a2a2a; border-radius: 2px; overflow: hidden; }
        .vp-progress-fill  { height: 100%; background: #b48c3c; border-radius: 2px; }

        /* Meal tally rows for caterers */
        .vp-meal-row { display: flex; justify-content: space-between; align-items: center; padding: 0.625rem 0; border-bottom: 1px solid #1a1a1a; }
        .vp-meal-row:last-child { border-bottom: none; }
        .vp-meal-name { font-size: 0.82rem; color: #f0ede6; }
        .vp-meal-cat  { font-size: 0.65rem; color: #6b7280; margin-top: 0.1rem; }
        .vp-meal-count { font-family: 'Cormorant Garamond', serif; font-size: 1.25rem; font-weight: 300; color: #b48c3c; }

        /* Info rows */
        .vp-info-row { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #1a1a1a; font-size: 0.78rem; }
        .vp-info-row:last-child { border-bottom: none; }
        .vp-info-k { color: #6b7280; }
        .vp-info-v { color: #f0ede6; font-weight: 500; text-align: right; }

        /* Walk-in mode toggle for SECURITY vendors */
        .vp-override { padding: 1rem 1.25rem; border: 1px solid; margin-bottom: 1rem; }
        .vp-override-active   { border-color: rgba(34,197,94,0.3);  background: rgba(34,197,94,0.06); }
        .vp-override-inactive { border-color: #2a2a2a; background: #111; }
        .vp-override-title { font-size: 0.78rem; font-weight: 500; margin-bottom: 0.25rem; }
        .vp-override-desc  { font-size: 0.72rem; color: #6b7280; margin-bottom: 0.875rem; line-height: 1.5; }
        .vp-override-btn { width: 100%; padding: 0.625rem; font-family: 'DM Sans', sans-serif; font-size: 0.78rem; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer; border: none; transition: all 0.2s; }
        .vp-override-btn-on  { background: #22c55e; color: #0a0a0a; }
        .vp-override-btn-off { background: #2a2a2a; color: #f0ede6; }
        .vp-override-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div className="vp-wrap">

        {/* Vendor identity badge */}
        <div className="vp-badge">
          {vendor.name} · {roleLabel(vendor.role)}
        </div>

        {/* Event summary card */}
        <div className="vp-hero">
          <div className="vp-event-name">{event.name}</div>
          <div className="vp-meta">
            {eventDate}
            {event.startTime && ` · ${event.startTime}`}
            {event.endTime   && ` – ${event.endTime}`}
            <br />
            {event.venueName && <>{event.venueName}{event.venueAddress && `, ${event.venueAddress}`}</>}
          </div>
        </div>

        {/* Headcount stats — visible to all vendors */}
        <div className="vp-stats">
          <div className="vp-stat">
            <div className="vp-stat-num">{stats.totalGuests}</div>
            <div className="vp-stat-label">Expected</div>
          </div>
          <div className="vp-stat">
            <div className="vp-stat-num">{stats.checkedIn}</div>
            <div className="vp-stat-label">Arrived</div>
          </div>
          <div className="vp-stat">
            <div className="vp-stat-num">{stats.pending}</div>
            <div className="vp-stat-label">Pending</div>
          </div>
        </div>

        {/* Check-in progress bar */}
        <div className="vp-card">
          <div className="vp-card-title">Arrival progress</div>
          <div className="vp-progress-label">
            <span>{stats.checkedIn} of {stats.totalGuests} guests</span>
            <span>{checkinPct}%</span>
          </div>
          <div className="vp-progress-track">
            <div className="vp-progress-fill" style={{ width: `${checkinPct}%` }} />
          </div>
        </div>

        {/* CATERER ONLY: Meal tallies breakdown */}
        {isCaterer && mealTallies.length > 0 && (
          <div className="vp-card">
            <div className="vp-card-title">Meal orders</div>
            {mealTallies.map(meal => (
              <div className="vp-meal-row" key={meal.menuItemId}>
                <div>
                  <div className="vp-meal-name">{meal.name}</div>
                  <div className="vp-meal-cat">{meal.category.charAt(0) + meal.category.slice(1).toLowerCase()}</div>
                </div>
                <div className="vp-meal-count">{meal.totalOrders}</div>
              </div>
            ))}
          </div>
        )}

        {/* SECURITY ONLY: Walk-in mode toggle */}
        {isSecurity && vendor.canOverrideCapacity && (
          <div className={`vp-override ${vendor.capacityOverrideActive ? "vp-override-active" : "vp-override-inactive"}`}>
            <div className="vp-override-title" style={{ color: vendor.capacityOverrideActive ? "#22c55e" : "#f0ede6" }}>
              {vendor.capacityOverrideActive ? "Walk-in mode is ON" : "Walk-in mode is off"}
            </div>
            <div className="vp-override-desc">
              When active, you can admit guests beyond the venue capacity limit.
              Only activate when instructed by the event planner.
            </div>
            <button
              className={`vp-override-btn ${vendor.capacityOverrideActive ? "vp-override-btn-off" : "vp-override-btn-on"}`}
              onClick={handleOverrideToggle}
              disabled={toggling}
            >
              {toggling
                ? "Updating…"
                : vendor.capacityOverrideActive
                ? "Deactivate walk-in mode"
                : "Activate walk-in mode"}
            </button>
          </div>
        )}

        {/* Vendor info card */}
        <div className="vp-card">
          <div className="vp-card-title">Your details</div>
          {vendor.contactName && (
            <div className="vp-info-row">
              <span className="vp-info-k">Contact</span>
              <span className="vp-info-v">{vendor.contactName}</span>
            </div>
          )}
          {vendor.staffCount != null && (
            <div className="vp-info-row">
              <span className="vp-info-k">Staff admitted</span>
              <span className="vp-info-v">{vendor.staffCount}</span>
            </div>
          )}
          {vendor.notes && (
            <div className="vp-info-row">
              <span className="vp-info-k">Notes</span>
              <span className="vp-info-v" style={{ maxWidth: "60%", wordBreak: "break-word" }}>{vendor.notes}</span>
            </div>
          )}
          <div className="vp-info-row">
            <span className="vp-info-k">Role</span>
            <span className="vp-info-v">{roleLabel(vendor.role)}</span>
          </div>
        </div>

      </div>
    </>
  )
}
