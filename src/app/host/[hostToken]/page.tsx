"use client"
// src/app/host/[hostToken]/page.tsx
// Read-only event dashboard for the host/celebrant
//
// Added vs previous version:
//   - Auto-refresh every 30s (stats, checkedIn, gifts, tributes)
//   - Vendor portal status tab — who has and hasn't opened their link
//   - Meal tallies tab — how many of each item ordered
//   - Tier breakdown on overview — per-tier guest counts
//   - Capacity bar — visual "280 / 300" progress
//   - Invitation card hero image at the top
//   - Venue address + Google Maps directions link
//   - Guest search + filter by tier and RSVP status
//   - Tier selector on "Add guest" form
//   - Mobile fixes — min-width:0 on flex children, overflow-x hidden

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"

// ── Types ─────────────────────────────────────────────────────

interface VendorStatus {
  id:              string
  name:            string
  role:            string
  portalToken:     string
  lastAccessed:    string | null
  staffCount:      number | null
  staffRegistered: number
}

interface MealTally {
  name:     string
  category: string
  total:    number
}

interface TierCount {
  id:    string
  name:  string
  color: string | null
  count: number
}

interface HostEventData {
  id:             string
  name:           string
  eventDate:      string
  startTime:      string | null
  venueName:      string | null
  venueAddress:   string | null
  venueLat:       number | null
  venueLng:       number | null
  venueMapUrl:    string | null
  invitationCard: string | null
  brandColor:     string | null
  status:         string
  venueCapacity:  number | null
  hostName:       string | null
  rsvpDeadline:   string | null
  _count:         { guests: number }
  guestTiers:     { id: string; name: string; color: string | null }[]
}

interface GuestRow {
  id:          string
  firstName:   string
  lastName:    string
  phone:       string | null
  rsvpStatus:  string
  checkedIn:   boolean
  checkedInAt: string | null
  tableNumber: string | null
  isPrivate:   boolean
  tier:        { name: string; color: string | null } | null
  meals:       { menuItem: { name: string; category: string } }[]
  gifts:       { amount: string | null; giftType: string; status: string }[]
}

interface GiftSummary {
  id:          string
  guestName:   string | null
  senderName:  string | null
  giftType:    string
  amount:      string | null
  status:      string
  createdAt:   string
}

interface Tribute {
  id:        string
  guestName: string
  message:   string
  createdAt: string
}

type Tab = "overview" | "guests" | "gifts" | "tributes" | "vendors" | "meals"

const RSVP_COLORS: Record<string, string> = {
  CONFIRMED:"#22c55e", PENDING:"#f59e0b",
  DECLINED:"#ef4444", WAITLISTED:"#a78bfa", NO_SHOW:"#6b7280",
}

const GIFT_TYPE_LABELS: Record<string, string> = {
  CASH_TRANSFER:"Bank Transfer", CASH_PHYSICAL:"Cash Envelope", PHYSICAL_ITEM:"Physical Gift",
}

const VENDOR_ROLE_LABELS: Record<string, string> = {
  CATERER:"Caterer", SECURITY:"Security", MEDIA:"Media", LIVE_BAND:"Live Band",
  DJ:"DJ", MC:"MC", HYPEMAN:"Hypeman", AFTER_PARTY:"After Party",
  DRINK_VENDOR:"Drink Vendor", DECORATOR:"Decorator",
  PHOTOGRAPHER:"Photographer", VIDEOGRAPHER:"Videographer", OTHER:"Other",
}

const MENU_CATEGORY_LABELS: Record<string, string> = {
  APPETIZER:"Starters", MAIN:"Main Course", DRINK:"Drinks",
  DESSERT:"Dessert", SPECIAL:"Chef's Special",
}

const fmtCurrency = (amount: string | null) =>
  amount ? `₦${Number(amount).toLocaleString("en-NG")}` : "—"

// ── Component ─────────────────────────────────────────────────

export default function HostPortal() {
  const { hostToken } = useParams<{ hostToken: string }>()

  const [event,        setEvent]        = useState<HostEventData | null>(null)
  const [guests,       setGuests]       = useState<GuestRow[]>([])
  const [gifts,        setGifts]        = useState<GiftSummary[]>([])
  const [tributes,     setTributes]     = useState<Tribute[]>([])
  const [vendorStatus, setVendorStatus] = useState<VendorStatus[]>([])
  const [mealTallies,  setMealTallies]  = useState<MealTally[]>([])
  const [tierCounts,   setTierCounts]   = useState<TierCount[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [tab,          setTab]          = useState<Tab>("overview")

  // Guest search / filter
  const [search,       setSearch]       = useState("")
  const [filterTier,   setFilterTier]   = useState("")
  const [filterStatus, setFilterStatus] = useState("")

  // Add guest form
  const [addForm,    setAddForm]    = useState({ firstName:"", lastName:"", phone:"", email:"", tierId:"" })
  const [adding,     setAdding]     = useState(false)
  const [addError,   setAddError]   = useState("")
  const [addSuccess, setAddSuccess] = useState(false)

  const gold = event?.brandColor ?? "#b48c3c"

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`/api/host/${hostToken}`)
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Access denied"); return }
      const d = await res.json()
      setEvent(d.event)
      setGuests(d.guests)
      setGifts(d.gifts)
      setTributes(d.tributes)
      setVendorStatus(d.vendorStatus ?? [])
      setMealTallies(d.mealTallies ?? [])
      setTierCounts(d.tierCounts ?? [])
    } catch { if (!silent) setError("Failed to load") }
    finally { if (!silent) setLoading(false) }
  }, [hostToken])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 30s — keeps checkedIn count, gifts, tributes live
  useEffect(() => {
    const interval = setInterval(() => load(true), 30_000)
    return () => clearInterval(interval)
  }, [load])

  const handleAddGuest = async () => {
    if (!addForm.firstName.trim() || !addForm.lastName.trim()) { setAddError("Name is required."); return }
    if (!addForm.phone.trim() && !addForm.email.trim()) { setAddError("Please provide at least a phone or email."); return }
    setAdding(true); setAddError("")
    try {
      const res = await fetch(`/api/host/${hostToken}/add-guest`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          firstName: addForm.firstName.trim(),
          lastName:  addForm.lastName.trim(),
          phone:     addForm.phone.trim()  || null,
          email:     addForm.email.trim()  || null,
          tierId:    addForm.tierId        || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); setAddError(d.error ?? "Failed to add guest"); return }
      const d = await res.json()
      setGuests(prev => [d.guest, ...prev])
      setEvent(prev => prev ? { ...prev, _count: { guests: prev._count.guests + 1 } } : prev)
      setAddForm({ firstName:"", lastName:"", phone:"", email:"", tierId:"" })
      setAddSuccess(true); setTimeout(() => setAddSuccess(false), 3000)
    } catch { setAddError("Failed to add guest") }
    finally { setAdding(false) }
  }

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#0a0a0a" }}>
      <div style={{ width:24, height:24, border:"2px solid rgba(180,140,60,0.2)", borderTopColor:"#b48c3c", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error || !event) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#0a0a0a", padding:"2rem", textAlign:"center" }}>
      <div style={{ fontSize:"2rem", marginBottom:"1rem" }}>🔒</div>
      <h2 style={{ color:"#f0ece4", fontFamily:"Georgia,serif", fontWeight:300, marginBottom:"0.5rem" }}>Access Denied</h2>
      <p style={{ color:"rgba(240,236,228,0.4)", fontSize:"0.875rem" }}>{error ?? "Invalid host link"}</p>
    </div>
  )

  const confirmed  = guests.filter(g => g.rsvpStatus === "CONFIRMED").length
  const checkedIn  = guests.filter(g => g.checkedIn).length
  const totalGifts = gifts.reduce((sum, g) => sum + (g.amount ? Number(g.amount) : 0), 0)
  const atCapacity = event.venueCapacity !== null && event._count.guests >= event.venueCapacity

  const eventDate = new Date(event.eventDate).toLocaleDateString("en-NG", {
    weekday:"long", year:"numeric", month:"long", day:"numeric",
  })

  // Maps directions link
  const mapsUrl = event.venueMapUrl
    ?? (event.venueLat && event.venueLng
        ? `https://www.google.com/maps/dir/?api=1&destination=${event.venueLat},${event.venueLng}`
        : event.venueAddress
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venueAddress)}`
        : null)

  // Filtered guest list
  const filteredGuests = guests.filter(g => {
    const name = `${g.firstName} ${g.lastName}`.toLowerCase()
    if (search && !name.includes(search.toLowerCase()) && !g.phone?.includes(search)) return false
    if (filterTier   && g.tier?.name !== filterTier)   return false
    if (filterStatus && g.rsvpStatus !== filterStatus) return false
    return true
  })

  const vendorAccessed    = vendorStatus.filter(v => v.lastAccessed).length
  const vendorNotAccessed = vendorStatus.filter(v => !v.lastAccessed).length

  const tabs: { key: Tab; label: string }[] = [
    { key:"overview", label:"Overview" },
    { key:"guests",   label:`Guests (${guests.length})` },
    { key:"gifts",    label:`Gifts (${gifts.length})` },
    { key:"tributes", label:`Tributes (${tributes.length})` },
    { key:"vendors",  label:`Vendors (${vendorStatus.length})` },
    { key:"meals",    label:"Meals" },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#0a0a0a;color:#f0ece4;font-family:'DM Sans',sans-serif;overflow-x:hidden}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

        .hp-wrap{min-height:100vh;max-width:900px;margin:0 auto;padding:0 0 5rem;animation:fadeUp 0.3s ease;overflow-x:hidden}
        .hp-header{padding:1.5rem 1.25rem 0}
        @media(min-width:600px){.hp-header{padding:1.5rem 1.5rem 0}}
        .hp-badge{font-size:0.6rem;font-weight:500;letter-spacing:0.15em;text-transform:uppercase;padding:0.25rem 0.625rem;border-radius:99px;border:1px solid;display:inline-flex;align-items:center;gap:0.35rem;margin-bottom:0.75rem}
        .hp-title{font-family:'Cormorant Garamond',serif;font-size:clamp(1.5rem,5vw,2.5rem);font-weight:300;color:#f0ece4;margin-bottom:0.375rem;line-height:1.15;word-break:break-word}
        .hp-meta{font-size:0.78rem;color:rgba(240,236,228,0.45);display:flex;gap:0.5rem 1.25rem;flex-wrap:wrap;margin-bottom:0.75rem}
        .hp-tabs{display:flex;border-bottom:1px solid rgba(180,140,60,0.12);overflow-x:auto;padding:0 1.25rem;gap:0;-webkit-overflow-scrolling:touch}
        @media(min-width:600px){.hp-tabs{padding:0 1.5rem}}
        .hp-tabs::-webkit-scrollbar{display:none}
        .hp-tab{padding:0.75rem 0.875rem;background:transparent;border:none;border-bottom:2px solid transparent;color:rgba(240,236,228,0.4);font-family:'DM Sans',sans-serif;font-size:0.75rem;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:all 0.2s;letter-spacing:0.03em}
        .hp-tab.active{color:var(--gold);border-bottom-color:var(--gold)}
        .hp-content{padding:1.25rem}
        @media(min-width:600px){.hp-content{padding:1.5rem}}

        /* Stats grid */
        .hp-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:0.625rem;margin-bottom:1.25rem}
        @media(min-width:420px){.hp-stats{grid-template-columns:repeat(4,1fr)}}
        .hp-stat{background:#111;border:1px solid rgba(180,140,60,0.12);padding:0.875rem 0.75rem;text-align:center;border-radius:6px}
        .hp-stat-num{font-family:'Cormorant Garamond',serif;font-size:1.75rem;font-weight:300;line-height:1;margin-bottom:0.25rem}
        .hp-stat-label{font-size:0.52rem;color:rgba(240,236,228,0.35);letter-spacing:0.1em;text-transform:uppercase}

        /* Cards */
        .hp-card{background:#111;border:1px solid rgba(180,140,60,0.12);border-radius:6px;padding:1.125rem;margin-bottom:1rem;overflow:hidden}
        .hp-card-title{font-size:0.58rem;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:1rem;display:flex;align-items:center;gap:0.75rem}
        .hp-card-title::after{content:'';flex:1;height:1px;background:rgba(180,140,60,0.12)}

        /* Guest rows */
        .hp-guest-row{padding:0.625rem 0;border-bottom:1px solid rgba(180,140,60,0.06);display:flex;align-items:flex-start;gap:0.625rem;min-width:0}
        .hp-guest-row:last-child{border-bottom:none}
        .hp-avatar{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:600;flex-shrink:0}
        .hp-pill{font-size:0.52rem;padding:0.1rem 0.4rem;border-radius:99px;border:1px solid;font-weight:500;letter-spacing:0.05em;white-space:nowrap}
        .hp-guest-name-row{display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;margin-bottom:0.2rem;min-width:0}

        /* Gift rows */
        .hp-gift-row{padding:0.625rem 0;border-bottom:1px solid rgba(180,140,60,0.06);display:flex;align-items:center;justify-content:space-between;gap:1rem;min-width:0}
        .hp-gift-row:last-child{border-bottom:none}

        /* Tributes */
        .hp-tribute{padding:0.875rem;background:rgba(180,140,60,0.04);border:1px solid rgba(180,140,60,0.1);border-radius:6px;margin-bottom:0.625rem}

        /* Vendor rows */
        .hp-vendor-row{padding:0.625rem 0;border-bottom:1px solid rgba(180,140,60,0.06);display:flex;align-items:center;justify-content:space-between;gap:0.75rem;min-width:0}
        .hp-vendor-row:last-child{border-bottom:none}

        /* Meal tally rows */
        .hp-meal-row{display:flex;align-items:center;justify-content:space-between;padding:0.55rem 0;border-bottom:1px solid rgba(180,140,60,0.06);gap:0.75rem;min-width:0}
        .hp-meal-row:last-child{border-bottom:none}

        /* Form inputs */
        .hp-input{width:100%;padding:0.575rem 0.75rem;background:#1a1a1a;border:1px solid rgba(180,140,60,0.2);color:#f0ece4;font-family:'DM Sans',sans-serif;font-size:0.8rem;outline:none;border-radius:5px;transition:border-color 0.15s}
        .hp-input:focus{border-color:var(--gold)}
        .hp-input::placeholder{color:rgba(240,236,228,0.2)}
        .hp-select{width:100%;padding:0.575rem 0.75rem;background:#1a1a1a;border:1px solid rgba(180,140,60,0.2);color:#f0ece4;font-family:'DM Sans',sans-serif;font-size:0.8rem;outline:none;border-radius:5px}
        .hp-select option{background:#1a1a1a}
        .hp-btn-gold{padding:0.575rem 1.125rem;background:var(--gold);color:#0a0a0a;border:none;border-radius:5px;font-family:'DM Sans',sans-serif;font-size:0.78rem;font-weight:500;cursor:pointer;transition:all 0.2s;white-space:nowrap}
        .hp-btn-gold:disabled{opacity:0.45;cursor:not-allowed}
        .hp-readonly-banner{padding:0.625rem 1rem;background:rgba(180,140,60,0.06);border:1px solid rgba(180,140,60,0.15);border-radius:5px;font-size:0.72rem;color:rgba(240,236,228,0.45);margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem}
        .hp-search-row{display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1rem}
        .hp-search-row .hp-input{flex:1;min-width:150px}
        .hp-search-row .hp-select{min-width:120px;flex-shrink:0}
      `}</style>
      <style>{`:root{--gold:${gold}}`}</style>

      <div className="hp-wrap">

        {/* Invitation card hero */}
        {event.invitationCard && (
          <div style={{ width:"100%", aspectRatio:"16/5", position:"relative", overflow:"hidden", maxHeight:240 }}>
            <Image src={event.invitationCard} alt={event.name} fill style={{ objectFit:"cover" }} unoptimized />
            <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, transparent 40%, #0a0a0a)" }} />
          </div>
        )}

        {/* Header */}
        <div className="hp-header">
          <div className="hp-badge" style={{ color:gold, borderColor:`${gold}44`, background:`${gold}10` }}>
            👁 Host View
          </div>
          <h1 className="hp-title">{event.name}</h1>
          <div className="hp-meta">
            <span>📅 {eventDate}{event.startTime && ` · ${event.startTime}`}</span>
            {event.venueName && <span>📍 {event.venueName}</span>}
          </div>

          {/* Venue address + maps link */}
          {event.venueAddress && (
            <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"0.875rem", flexWrap:"wrap" }}>
              <span style={{ fontSize:"0.75rem", color:"rgba(240,236,228,0.4)" }}>{event.venueAddress}</span>
              {mapsUrl && (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize:"0.7rem", color:gold, padding:"0.2rem 0.625rem", border:`1px solid ${gold}44`, borderRadius:99, textDecoration:"none", background:`${gold}0d`, whiteSpace:"nowrap" }}>
                  🗺 Directions
                </a>
              )}
            </div>
          )}

          {/* Capacity bar */}
          {event.venueCapacity && (
            <div style={{ marginBottom:"1rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.35rem" }}>
                <span style={{ fontSize:"0.68rem", color:"rgba(240,236,228,0.4)" }}>Capacity</span>
                <span style={{ fontSize:"0.68rem", color: atCapacity ? "#ef4444" : "rgba(240,236,228,0.4)" }}>
                  {event._count.guests} / {event.venueCapacity}
                  {atCapacity && " · Full"}
                </span>
              </div>
              <div style={{ height:3, background:"rgba(180,140,60,0.1)", borderRadius:2 }}>
                <div style={{
                  height:"100%",
                  width:`${Math.min((event._count.guests / event.venueCapacity) * 100, 100)}%`,
                  background: atCapacity ? "#ef4444" : gold,
                  borderRadius:2, transition:"width 0.4s",
                }} />
              </div>
            </div>
          )}

          <div className="hp-readonly-banner">
            🔒 Read-only access — you can view everything and add guests to available slots.
          </div>
        </div>

        {/* Tabs */}
        <div className="hp-tabs">
          {tabs.map(t => (
            <button key={t.key} className={`hp-tab${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="hp-content">

          {/* ══ OVERVIEW ══ */}
          {tab === "overview" && (
            <>
              <div className="hp-stats">
                {[
                  { num:guests.length,  label:"Total Guests", color:gold        },
                  { num:confirmed,      label:"Confirmed",    color:"#22c55e"   },
                  { num:checkedIn,      label:"Checked In",   color:"#4a9eff"   },
                  { num:gifts.length,   label:"Gifts",        color:"#a78bfa"   },
                ].map(s => (
                  <div className="hp-stat" key={s.label}>
                    <div className="hp-stat-num" style={{ color:s.color }}>{s.num}</div>
                    <div className="hp-stat-label">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Gift total */}
              {totalGifts > 0 && (
                <div className="hp-card" style={{ borderColor:"rgba(167,139,250,0.2)", background:"rgba(167,139,250,0.04)" }}>
                  <div className="hp-card-title" style={{ color:"#a78bfa" }}>Total Gifts Received</div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"2rem", fontWeight:300, color:"#a78bfa" }}>
                    {fmtCurrency(totalGifts.toString())}
                  </div>
                  <div style={{ fontSize:"0.72rem", color:"rgba(240,236,228,0.35)", marginTop:"0.375rem" }}>
                    Across {gifts.filter(g => g.amount).length} recorded gift{gifts.filter(g => g.amount).length !== 1 ? "s" : ""}
                  </div>
                </div>
              )}

              {/* Tier breakdown */}
              {tierCounts.length > 0 && (
                <div className="hp-card">
                  <div className="hp-card-title" style={{ color:gold }}>Guests by Tier</div>
                  {tierCounts.map(tier => (
                    <div key={tier.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0.5rem 0", borderBottom:"1px solid rgba(180,140,60,0.06)" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:tier.color ?? gold, flexShrink:0 }} />
                        <span style={{ fontSize:"0.78rem", color:"rgba(240,236,228,0.7)" }}>{tier.name}</span>
                      </div>
                      <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"1.125rem", fontWeight:300, color:tier.color ?? gold }}>{tier.count}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* RSVP breakdown */}
              <div className="hp-card">
                <div className="hp-card-title" style={{ color:gold }}>RSVP Breakdown</div>
                {(["CONFIRMED","PENDING","DECLINED","WAITLISTED","NO_SHOW"] as const).map(status => {
                  const count = guests.filter(g => g.rsvpStatus === status).length
                  if (!count) return null
                  const pct = guests.length ? Math.round((count / guests.length) * 100) : 0
                  return (
                    <div key={status} style={{ marginBottom:"0.625rem" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.25rem" }}>
                        <span style={{ fontSize:"0.72rem", color:"rgba(240,236,228,0.6)" }}>
                          {status.charAt(0) + status.slice(1).toLowerCase().replace("_"," ")}
                        </span>
                        <span style={{ fontSize:"0.72rem", color:RSVP_COLORS[status] }}>{count} · {pct}%</span>
                      </div>
                      <div style={{ height:3, background:"rgba(180,140,60,0.1)", borderRadius:2 }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:RSVP_COLORS[status], borderRadius:2, transition:"width 0.4s" }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Check-in progress */}
              <div className="hp-card">
                <div className="hp-card-title" style={{ color:gold }}>Check-in Progress</div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.5rem" }}>
                  <span style={{ fontSize:"0.78rem", color:"rgba(240,236,228,0.6)" }}>{checkedIn} of {confirmed} confirmed guests</span>
                  <span style={{ fontSize:"0.78rem", color:"#4a9eff" }}>{confirmed ? Math.round((checkedIn / confirmed) * 100) : 0}%</span>
                </div>
                <div style={{ height:5, background:"rgba(74,158,255,0.12)", borderRadius:3 }}>
                  <div style={{ height:"100%", width:`${confirmed ? (checkedIn / confirmed) * 100 : 0}%`, background:"#4a9eff", borderRadius:3, transition:"width 0.4s" }} />
                </div>
              </div>
            </>
          )}

          {/* ══ GUESTS ══ */}
          {tab === "guests" && (
            <>
              {/* Add guest */}
              {!atCapacity ? (
                <div className="hp-card">
                  <div className="hp-card-title" style={{ color:gold }}>Add a Guest</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.625rem", marginBottom:"0.625rem" }}>
                    <input className="hp-input" placeholder="First name *" value={addForm.firstName} onChange={e => setAddForm(p => ({...p,firstName:e.target.value}))} />
                    <input className="hp-input" placeholder="Last name *"  value={addForm.lastName}  onChange={e => setAddForm(p => ({...p,lastName:e.target.value}))} />
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.625rem", marginBottom:"0.625rem" }}>
                    <input className="hp-input" placeholder="Phone number"  value={addForm.phone} onChange={e => setAddForm(p => ({...p,phone:e.target.value}))} />
                    <input className="hp-input" placeholder="Email address" type="email" value={addForm.email} onChange={e => setAddForm(p => ({...p,email:e.target.value}))} />
                  </div>
                  {event.guestTiers.length > 0 && (
                    <div style={{ marginBottom:"0.625rem" }}>
                      <select className="hp-select" value={addForm.tierId} onChange={e => setAddForm(p => ({...p,tierId:e.target.value}))}>
                        <option value="">No tier</option>
                        {event.guestTiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  )}
                  <p style={{ fontSize:"0.65rem", color:"rgba(240,236,228,0.3)", marginBottom:"0.625rem", lineHeight:1.5 }}>
                    Provide at least one contact. Guest is added as Confirmed.
                  </p>
                  <button className="hp-btn-gold" onClick={handleAddGuest} disabled={adding} style={{ width:"100%" }}>
                    {adding ? "Adding…" : "Add Guest"}
                  </button>
                  {addError   && <p style={{ fontSize:"0.72rem", color:"#ef4444", marginTop:"0.5rem" }}>{addError}</p>}
                  {addSuccess && <p style={{ fontSize:"0.72rem", color:"#22c55e", marginTop:"0.5rem" }}>✓ Guest added successfully</p>}
                </div>
              ) : (
                <div style={{ padding:"0.75rem 1rem", background:"rgba(239,68,68,0.07)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:5, marginBottom:"1rem", fontSize:"0.78rem", color:"rgba(239,68,68,0.8)" }}>
                  🔴 Event is at full capacity — no more guests can be added.
                </div>
              )}

              {/* Search + filter */}
              <div className="hp-search-row">
                <input className="hp-input" placeholder="Search name or phone…" value={search} onChange={e => setSearch(e.target.value)} />
                {event.guestTiers.length > 1 && (
                  <select className="hp-select" value={filterTier} onChange={e => setFilterTier(e.target.value)} style={{ minWidth:110 }}>
                    <option value="">All tiers</option>
                    {event.guestTiers.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                )}
                <select className="hp-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ minWidth:110 }}>
                  <option value="">All statuses</option>
                  {["CONFIRMED","PENDING","DECLINED","WAITLISTED","NO_SHOW"].map(s => (
                    <option key={s} value={s}>{s.charAt(0)+s.slice(1).toLowerCase().replace("_"," ")}</option>
                  ))}
                </select>
              </div>

              <div className="hp-card">
                <div className="hp-card-title" style={{ color:gold }}>
                  {filteredGuests.length !== guests.length
                    ? `${filteredGuests.length} of ${guests.length} guests`
                    : `All Guests (${guests.length})`}
                </div>
                {filteredGuests.length === 0 ? (
                  <p style={{ fontSize:"0.78rem", color:"rgba(240,236,228,0.35)", textAlign:"center", padding:"1.5rem 0" }}>
                    {guests.length === 0 ? "No guests yet" : "No guests match your search"}
                  </p>
                ) : (
                  filteredGuests.map(g => {
                    const displayName = g.isPrivate ? "Private Guest" : `${g.firstName} ${g.lastName}`
                    return (
                      <div className="hp-guest-row" key={g.id}>
                        <div className="hp-avatar" style={{ background:`${g.tier?.color ?? gold}18`, border:`1.5px solid ${g.tier?.color ?? gold}44`, color:g.tier?.color ?? gold }}>
                          {g.isPrivate ? "?" : `${g.firstName[0]}${g.lastName[0]}`}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div className="hp-guest-name-row">
                            <span style={{ fontSize:"0.8rem", fontWeight:500, color:g.isPrivate?"rgba(240,236,228,0.35)":"#f0ece4", fontStyle:g.isPrivate?"italic":"normal", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"120px" }}>
                              {displayName}
                            </span>
                            {g.isPrivate && <span className="hp-pill" style={{ color:"rgba(240,236,228,0.35)", borderColor:"rgba(240,236,228,0.12)", fontSize:"0.5rem" }}>private</span>}
                            <span className="hp-pill" style={{ color:RSVP_COLORS[g.rsvpStatus], borderColor:`${RSVP_COLORS[g.rsvpStatus]}44` }}>
                              {g.rsvpStatus.toLowerCase().replace("_"," ")}
                            </span>
                            {g.checkedIn && <span className="hp-pill" style={{ color:"#4a9eff", borderColor:"rgba(74,158,255,0.35)" }}>✓ in</span>}
                          </div>
                          <div style={{ fontSize:"0.67rem", color:"rgba(240,236,228,0.3)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {g.tier?.name ?? "No tier"}{g.tableNumber ? ` · Table ${g.tableNumber}` : ""}
                          </div>
                          {g.meals?.length > 0 && (
                            <div style={{ fontSize:"0.65rem", color:"rgba(240,236,228,0.35)", marginTop:"0.2rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              🍽 {g.meals.map(m => m.menuItem.name).join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </>
          )}

          {/* ══ GIFTS ══ */}
          {tab === "gifts" && (
            <>
              {totalGifts > 0 && (
                <div className="hp-card" style={{ borderColor:"rgba(167,139,250,0.2)", background:"rgba(167,139,250,0.04)", marginBottom:"1rem" }}>
                  <div style={{ fontSize:"0.58rem", fontWeight:500, letterSpacing:"0.15em", textTransform:"uppercase", color:"#a78bfa", marginBottom:"0.375rem" }}>Total</div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"2.25rem", fontWeight:300, color:"#a78bfa" }}>{fmtCurrency(totalGifts.toString())}</div>
                </div>
              )}
              <div className="hp-card">
                <div className="hp-card-title" style={{ color:gold }}>Gift Records</div>
                {gifts.length === 0 ? (
                  <p style={{ fontSize:"0.78rem", color:"rgba(240,236,228,0.35)", textAlign:"center", padding:"1.5rem 0" }}>No gifts recorded yet</p>
                ) : (
                  gifts.map(g => (
                    <div className="hp-gift-row" key={g.id}>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:"0.8rem", fontWeight:500, color:"#f0ece4", marginBottom:"0.15rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {g.guestName ?? g.senderName ?? "Anonymous"}
                        </div>
                        <div style={{ fontSize:"0.68rem", color:"rgba(240,236,228,0.35)" }}>
                          {GIFT_TYPE_LABELS[g.giftType] ?? g.giftType} · {new Date(g.createdAt).toLocaleDateString("en-NG", { day:"numeric", month:"short" })}
                        </div>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <div style={{ fontSize:"0.875rem", fontWeight:500, color:"#a78bfa" }}>{fmtCurrency(g.amount)}</div>
                        <div style={{ fontSize:"0.6rem", color:"rgba(240,236,228,0.3)", textTransform:"lowercase" }}>{g.status.toLowerCase()}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* ══ TRIBUTES ══ */}
          {tab === "tributes" && (
            <div>
              {tributes.length === 0 ? (
                <div style={{ textAlign:"center", padding:"3rem 1rem" }}>
                  <div style={{ fontSize:"2rem", marginBottom:"0.875rem", opacity:0.3 }}>💌</div>
                  <p style={{ fontSize:"0.875rem", color:"rgba(240,236,228,0.35)" }}>No tributes yet</p>
                </div>
              ) : (
                tributes.map(t => (
                  <div className="hp-tribute" key={t.id}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.5rem", gap:"0.5rem" }}>
                      <span style={{ fontSize:"0.75rem", fontWeight:500, color:gold }}>{t.guestName}</span>
                      <span style={{ fontSize:"0.65rem", color:"rgba(240,236,228,0.3)", flexShrink:0 }}>
                        {new Date(t.createdAt).toLocaleDateString("en-NG", { day:"numeric", month:"short" })}
                      </span>
                    </div>
                    <p style={{ fontSize:"0.82rem", color:"rgba(240,236,228,0.65)", lineHeight:1.7, fontStyle:"italic" }}>"{t.message}"</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ══ VENDORS ══ */}
          {tab === "vendors" && (
            <>
              {/* Summary badges */}
              <div style={{ display:"flex", gap:"0.625rem", marginBottom:"1rem", flexWrap:"wrap" }}>
                <div style={{ padding:"0.5rem 0.875rem", background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.2)", borderRadius:5, fontSize:"0.72rem", color:"#22c55e" }}>
                  ✓ {vendorAccessed} portal{vendorAccessed !== 1 ? "s" : ""} accessed
                </div>
                {vendorNotAccessed > 0 && (
                  <div style={{ padding:"0.5rem 0.875rem", background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:5, fontSize:"0.72rem", color:"#f59e0b" }}>
                    ⏳ {vendorNotAccessed} not yet opened
                  </div>
                )}
              </div>

              <div className="hp-card">
                <div className="hp-card-title" style={{ color:gold }}>Vendor Portals</div>
                {vendorStatus.length === 0 ? (
                  <p style={{ fontSize:"0.78rem", color:"rgba(240,236,228,0.35)", textAlign:"center", padding:"1.5rem 0" }}>No vendors added yet</p>
                ) : (
                  vendorStatus.map(v => (
                    <div className="hp-vendor-row" key={v.id}>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:"0.82rem", fontWeight:500, color:"#f0ece4", marginBottom:"0.15rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {v.name}
                        </div>
                        <div style={{ fontSize:"0.68rem", color:"rgba(240,236,228,0.35)" }}>
                          {VENDOR_ROLE_LABELS[v.role] ?? v.role}
                          {v.staffCount != null && ` · ${v.staffRegistered}/${v.staffCount} staff`}
                        </div>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        {v.lastAccessed ? (
                          <div style={{ fontSize:"0.68rem", color:"#22c55e" }}>
                            Opened {new Date(v.lastAccessed).toLocaleDateString("en-NG", { day:"numeric", month:"short" })}
                          </div>
                        ) : (
                          <div style={{ fontSize:"0.68rem", color:"rgba(240,236,228,0.3)" }}>Not yet opened</div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* ══ MEALS ══ */}
          {tab === "meals" && (
            <>
              {mealTallies.length === 0 ? (
                <div style={{ textAlign:"center", padding:"3rem 1rem" }}>
                  <div style={{ fontSize:"2rem", marginBottom:"0.875rem", opacity:0.3 }}>🍽</div>
                  <p style={{ fontSize:"0.875rem", color:"rgba(240,236,228,0.35)" }}>No pre-ordered meals yet</p>
                </div>
              ) : (
                // Group by category
                Object.entries(
                  mealTallies.reduce((acc, m) => {
                    if (!acc[m.category]) acc[m.category] = []
                    acc[m.category].push(m)
                    return acc
                  }, {} as Record<string, MealTally[]>)
                ).map(([cat, items]) => (
                  <div className="hp-card" key={cat}>
                    <div className="hp-card-title" style={{ color:gold }}>
                      {MENU_CATEGORY_LABELS[cat] ?? cat}
                    </div>
                    {items.map((item, i) => {
                      const max = Math.max(...items.map(x => x.total))
                      const pct = max > 0 ? (item.total / max) * 100 : 0
                      return (
                        <div className="hp-meal-row" key={i}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:"0.8rem", color:"#f0ece4", marginBottom:"0.2rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {item.name}
                            </div>
                            <div style={{ height:3, background:"rgba(180,140,60,0.1)", borderRadius:2 }}>
                              <div style={{ height:"100%", width:`${pct}%`, background:gold, borderRadius:2, transition:"width 0.4s" }} />
                            </div>
                          </div>
                          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"1.25rem", fontWeight:300, color:gold, flexShrink:0 }}>
                            {item.total}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
            </>
          )}

        </div>
        <p style={{ fontSize:"0.65rem", color:"rgba(240,236,228,0.15)", textAlign:"center", padding:"1rem" }}>Powered by EventFlow</p>
      </div>
    </>
  )
}
