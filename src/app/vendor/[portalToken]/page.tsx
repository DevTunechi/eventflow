// ─────────────────────────────────────────────
// FILE: src/app/vendor/[portalToken]/page.tsx
//
// PUBLIC portal — no login required.
// Mobile-first. Token is the auth mechanism.
//
// Screens:
//   1. Loading
//   2. Expired (410) — event ended + 24hrs
//   3. Invalid link (404)
//   4. Active portal
//
// Sections shown based on role:
//   ALL:          vendor brief (if written), event info, stats
//   CATERER:      vendor crew count breakdown, food tallies
//   DRINK_VENDOR: drink tallies
//   SECURITY:     walk-in override toggle
//   ALL:          event schedule, staff registration
//   POST-EVENT:   feedback form (24hr window)
//
// Auto-refreshes stats every 30 seconds.
// ─────────────────────────────────────────────

"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"

// ── Types ─────────────────────────────────────

interface TimelineItem { id:string; time:string; title:string; description:string|null; sortOrder:number }
interface StaffMember  { id:string; name:string; phone:string|null; qrToken:string; checkedIn:boolean; checkedInAt:string|null }
interface TallyItem    { menuItemId:string; name:string; category:string; totalOrders:number }
interface VendorStaffCount { name:string; role:string; staffAllotted:number; staffRegistered:number }

interface VendorPortalData {
  vendor: {
    id:string; name:string; contactName:string|null; role:string
    // ── Brief ──────────────────────────────────
    arriveTime:string|null; arriveLocation:string|null; instructions:string|null
    notes:string|null
    staffCount:number|null; staffRegistered:number
    canOverrideCapacity:boolean; capacityOverrideActive:boolean
    staff:StaffMember[]
    existingFeedback:{ rating:number; message:string|null }|null
  }
  event: {
    id:string; name:string; eventDate:string
    startTime:string|null; endTime:string|null
    venueName:string|null; venueAddress:string|null; status:string
    plannerName:string|null; plannerPhone:string|null; plannerEmail:string|null
    timeline:TimelineItem[]
  }
  stats:  { totalGuests:number; checkedIn:number; pending:number }
  foodTallies:    TallyItem[]
  drinkTallies:   TallyItem[]
  allVendorStaff: VendorStaffCount[] // Caterer only — other vendors' staff counts
  expiry: { isExpired:boolean; isInFeedbackWindow:boolean; expiresAt:string }
}

function roleLabel(role:string): string {
  const map:Record<string,string> = {
    CATERER:"Caterer", SECURITY:"Security", MEDIA:"Media", LIVE_BAND:"Live Band",
    DJ:"DJ", MC:"MC", HYPEMAN:"Hypeman", AFTER_PARTY:"After Party",
    DRINK_VENDOR:"Drinks", DECORATOR:"Decorator",
    PHOTOGRAPHER:"Photographer", VIDEOGRAPHER:"Videographer", OTHER:"Vendor",
  }
  return map[role] ?? role
}

export default function VendorPortalPage() {
  const { portalToken } = useParams<{ portalToken:string }>()

  const [data,    setData]    = useState<VendorPortalData|null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string|null>(null)
  const [expired, setExpired] = useState(false)
  const [expiredEventName, setExpiredEventName] = useState("")

  const [staffForm,     setStaffForm]     = useState({ name:"", phone:"" })
  const [addingStaff,   setAddingStaff]   = useState(false)
  const [showStaffForm, setShowStaffForm] = useState(false)
  const [staffError,    setStaffError]    = useState("")
  const [removingId,    setRemovingId]    = useState<string|null>(null)

  const [feedbackRating,     setFeedbackRating]     = useState(0)
  const [feedbackMessage,    setFeedbackMessage]    = useState("")
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [feedbackDone,       setFeedbackDone]       = useState(false)
  const [feedbackError,      setFeedbackError]      = useState("")
  const [toggling,           setToggling]           = useState(false)

  // ── Fetch ──────────────────────────────────

  const fetchData = useCallback(async (silent=false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`/api/vendor/${portalToken}`)
      if (res.status===410) { const d=await res.json(); setExpiredEventName(d.eventName??"this event"); setExpired(true); return }
      if (res.status===404) { setError("This vendor link is invalid or has expired."); return }
      if (!res.ok)          { setError("Failed to load your portal. Please try again."); return }
      const d = await res.json()
      setData(d)
      if (d.vendor.existingFeedback) {
        setFeedbackRating(d.vendor.existingFeedback.rating)
        setFeedbackMessage(d.vendor.existingFeedback.message ?? "")
        setFeedbackDone(true)
      }
    } catch { if (!silent) setError("Network error — please check your connection.") }
    finally { setLoading(false) }
  }, [portalToken])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 30s on event day
  useEffect(() => {
    const i = setInterval(() => fetchData(true), 30_000)
    return () => clearInterval(i)
  }, [fetchData])

  // ── Staff add/remove ───────────────────────

  const handleAddStaff = async () => {
    if (!staffForm.name.trim()) { setStaffError("Staff name is required."); return }
    setAddingStaff(true); setStaffError("")
    try {
      const res = await fetch(`/api/vendor/${portalToken}/staff`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ name:staffForm.name, phone:staffForm.phone }),
      })
      const d = await res.json()
      if (!res.ok) { setStaffError(d.error??"Failed"); return }
      setData(prev => prev ? { ...prev, vendor:{ ...prev.vendor, staff:[...prev.vendor.staff, d.staff], staffRegistered:prev.vendor.staffRegistered+1 } } : prev)
      setStaffForm({ name:"", phone:"" }); setShowStaffForm(false)
    } catch { setStaffError("Network error.") }
    finally  { setAddingStaff(false) }
  }

  const handleRemoveStaff = async (staffId:string) => {
    setRemovingId(staffId)
    try {
      await fetch(`/api/vendor/${portalToken}/staff?staffId=${staffId}`, { method:"DELETE" })
      setData(prev => prev ? { ...prev, vendor:{ ...prev.vendor, staff:prev.vendor.staff.filter(s=>s.id!==staffId), staffRegistered:prev.vendor.staffRegistered-1 } } : prev)
    } catch { /* silent */ }
    finally { setRemovingId(null) }
  }

  // ── Override toggle ────────────────────────

  const handleOverrideToggle = async () => {
    if (!data||toggling) return; setToggling(true)
    try {
      const res = await fetch(`/api/vendor/${portalToken}/override`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ active:!data.vendor.capacityOverrideActive }),
      })
      if (res.ok) { const u=await res.json(); setData(prev=>prev?{...prev,vendor:{...prev.vendor,capacityOverrideActive:u.capacityOverrideActive}}:prev) }
    } catch { /* silent */ }
    finally { setToggling(false) }
  }

  // ── Feedback submit ────────────────────────

  const handleFeedbackSubmit = async () => {
    if (feedbackRating===0) { setFeedbackError("Please select a rating."); return }
    setSubmittingFeedback(true); setFeedbackError("")
    try {
      const res = await fetch(`/api/vendor/${portalToken}/feedback`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ rating:feedbackRating, message:feedbackMessage }),
      })
      const d = await res.json()
      if (!res.ok) { setFeedbackError(d.error??"Failed"); return }
      setFeedbackDone(true)
    } catch { setFeedbackError("Network error.") }
    finally  { setSubmittingFeedback(false) }
  }

  // ── Loading ────────────────────────────────

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",gap:"0.75rem"}}>
      <div style={{width:22,height:22,border:"1.5px solid rgba(180,140,60,0.2)",borderTopColor:"#b48c3c",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ── Expired ────────────────────────────────

  if (expired) return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Cormorant+Garamond:wght@300;400&display=swap');*,*::before,*::after{box-sizing:border-box}body{margin:0;background:#0a0a0a;color:#f0ede6;font-family:'DM Sans',sans-serif}`}</style>
      <div style={{maxWidth:480,margin:"0 auto",padding:"4rem 1.25rem",textAlign:"center"}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.75rem",fontWeight:300,marginBottom:"0.75rem"}}>{expiredEventName}</div>
        <p style={{fontSize:"0.82rem",color:"#6b7280",lineHeight:1.7,marginBottom:"2rem"}}>This event has ended and the vendor portal has closed.<br/>Thank you for being part of the event.</p>
        <div style={{fontSize:"0.7rem",color:"#4b4b4b",letterSpacing:"0.1em",textTransform:"uppercase"}}>Powered by EventFlow</div>
      </div>
    </>
  )

  // ── Error ──────────────────────────────────

  if (error||!data) return (
    <div style={{padding:"3rem 1.25rem",textAlign:"center",fontFamily:"sans-serif"}}>
      <p style={{color:"#6b7280",marginBottom:"0.5rem",fontSize:"0.9rem"}}>{error??"Portal unavailable"}</p>
      <p style={{fontSize:"0.75rem",color:"#9ca3af"}}>Contact your event planner for a new link.</p>
    </div>
  )

  const { vendor, event, stats, foodTallies, drinkTallies, allVendorStaff } = data
  const isCaterer     = vendor.role==="CATERER"
  const isDrinkVendor = vendor.role==="DRINK_VENDOR"
  const isSecurity    = vendor.role==="SECURITY"
  const hasBrief      = !!(vendor.arriveTime||vendor.arriveLocation||vendor.instructions)
  const totalCrewCount = allVendorStaff.reduce((sum,v)=>sum+v.staffAllotted, 0)

  const eventDate  = new Date(event.eventDate).toLocaleDateString("en-NG",{ weekday:"long",year:"numeric",month:"long",day:"numeric" })
  const checkinPct = stats.totalGuests>0 ? Math.round((stats.checkedIn/stats.totalGuests)*100) : 0
  const staffSlotsLeft = (vendor.staffCount??0)-vendor.staffRegistered
  const canAddStaff    = staffSlotsLeft>0

  const inputStyle:React.CSSProperties = { padding:"0.55rem 0.75rem", background:"#161616", border:"1px solid #2a2a2a", color:"#f0ede6", fontFamily:"'DM Sans',sans-serif", fontSize:"0.82rem", outline:"none", width:"100%" }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Cormorant+Garamond:wght@300;400&display=swap');
        *,*::before,*::after{box-sizing:border-box}
        body{margin:0;background:#0a0a0a;color:#f0ede6;font-family:'DM Sans',sans-serif}

        /* ── Root ── */
        .vp-wrap{max-width:480px;margin:0 auto;padding:1.5rem 1rem 5rem;width:100%;overflow-x:hidden}
        @media(min-width:480px){.vp-wrap{padding:2rem 1.25rem 5rem}}

        .vp-badge{display:inline-flex;align-items:center;gap:0.5rem;padding:0.3rem 0.75rem;border:1px solid #2a2a2a;background:#161616;font-size:0.7rem;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:1.25rem;color:#b48c3c;word-break:break-all}

        .vp-hero{background:#111;border:1px solid #2a2a2a;padding:1.125rem;margin-bottom:1rem}
        .vp-event-name{font-family:'Cormorant Garamond',serif;font-size:clamp(1.25rem,5vw,1.5rem);font-weight:300;margin-bottom:0.5rem;color:#f0ede6;word-break:break-word}
        .vp-meta{font-size:0.75rem;color:#6b7280;line-height:1.8}

        /* ── Vendor brief — prominent at top ── */
        .vp-brief{background:#111;border:1px solid rgba(180,140,60,0.3);padding:1.125rem;margin-bottom:1rem}
        .vp-brief-title{font-size:0.6rem;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;color:#b48c3c;margin-bottom:0.875rem;display:flex;align-items:center;gap:0.75rem}
        .vp-brief-title::after{content:'';flex:1;height:1px;background:rgba(180,140,60,0.2)}
        .vp-brief-row{display:flex;gap:0.75rem;padding:0.5rem 0;border-bottom:1px solid #1a1a1a;align-items:flex-start}
        .vp-brief-row:last-child{border-bottom:none}
        .vp-brief-icon{font-size:0.9rem;flex-shrink:0;width:20px;text-align:center;padding-top:2px}
        .vp-brief-text{color:#f0ede6;line-height:1.6;word-break:break-word;flex:1;min-width:0;font-size:0.82rem}
        .vp-brief-label{font-size:0.62rem;color:#6b7280;margin-bottom:0.15rem;letter-spacing:0.04em}

        .vp-card{background:#111;border:1px solid #2a2a2a;padding:1.125rem;margin-bottom:1rem}
        .vp-card-title{font-size:0.6rem;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;color:#b48c3c;margin-bottom:1rem;display:flex;align-items:center;gap:0.75rem}
        .vp-card-title::after{content:'';flex:1;height:1px;background:#2a2a2a}

        /* Stats */
        .vp-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-bottom:1rem}
        .vp-stat{background:#161616;border:1px solid #2a2a2a;padding:0.75rem 0.5rem;text-align:center}
        .vp-stat-num{font-family:'Cormorant Garamond',serif;font-size:clamp(1.375rem,5vw,1.75rem);font-weight:300;color:#b48c3c;line-height:1;margin-bottom:0.2rem}
        .vp-stat-label{font-size:0.55rem;color:#6b7280;letter-spacing:0.08em;text-transform:uppercase}

        /* Progress */
        .vp-progress-label{display:flex;justify-content:space-between;font-size:0.72rem;color:#6b7280;margin-bottom:0.5rem}
        .vp-progress-track{height:4px;background:#2a2a2a;border-radius:2px;overflow:hidden}
        .vp-progress-fill{height:100%;background:#b48c3c;border-radius:2px;transition:width 0.6s ease}

        /* Crew table (caterer) */
        .vp-crew-row{display:flex;justify-content:space-between;align-items:center;padding:0.55rem 0;border-bottom:1px solid #1a1a1a;gap:0.5rem}
        .vp-crew-row:last-child{border-bottom:none}
        .vp-crew-name{color:#f0ede6;flex:1;min-width:0;word-break:break-word;font-size:0.82rem}
        .vp-crew-role{font-size:0.65rem;color:#6b7280;margin-top:0.1rem}
        .vp-crew-count{font-family:'Cormorant Garamond',serif;font-size:1.25rem;font-weight:300;color:#b48c3c;flex-shrink:0}
        .vp-crew-total{display:flex;justify-content:space-between;padding:0.625rem 0;margin-top:0.25rem;border-top:1px solid #2a2a2a;font-size:0.82rem}
        .vp-crew-total-label{color:#6b7280}
        .vp-crew-total-num{font-family:'Cormorant Garamond',serif;font-size:1.25rem;font-weight:300;color:#f0ede6}

        /* Tallies */
        .vp-tally-row{display:flex;justify-content:space-between;align-items:center;padding:0.625rem 0;border-bottom:1px solid #1a1a1a;gap:0.5rem}
        .vp-tally-row:last-child{border-bottom:none}
        .vp-tally-name{font-size:0.82rem;color:#f0ede6;word-break:break-word;flex:1;min-width:0}
        .vp-tally-cat{font-size:0.65rem;color:#6b7280;margin-top:0.1rem}
        .vp-tally-count{font-family:'Cormorant Garamond',serif;font-size:1.25rem;font-weight:300;color:#b48c3c;flex-shrink:0}

        /* Timeline */
        .vp-tl-item{display:flex;gap:0.875rem;padding:0.75rem 0;border-bottom:1px solid #1a1a1a}
        .vp-tl-item:last-child{border-bottom:none}
        .vp-tl-time{font-size:0.72rem;color:#b48c3c;white-space:nowrap;font-weight:500;padding-top:2px;min-width:55px}
        .vp-tl-title{font-size:0.85rem;font-weight:500;color:#f0ede6;margin-bottom:0.15rem;word-break:break-word}
        .vp-tl-desc{font-size:0.72rem;color:#6b7280;line-height:1.5;word-break:break-word}

        /* Staff */
        .vp-staff-row{display:flex;align-items:center;justify-content:space-between;gap:0.75rem;padding:0.625rem 0;border-bottom:1px solid #1a1a1a}
        .vp-staff-row:last-child{border-bottom:none}
        .vp-staff-name{font-size:0.85rem;color:#f0ede6;font-weight:500;word-break:break-word}
        .vp-staff-phone{font-size:0.7rem;color:#6b7280}
        .vp-staff-badge{font-size:0.6rem;letter-spacing:0.06em;padding:0.2rem 0.55rem;border-radius:99px;white-space:nowrap;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.08);color:#22c55e}
        .vp-staff-form{background:#161616;border:1px solid #2a2a2a;padding:1rem;margin-top:0.75rem;display:flex;flex-direction:column;gap:0.5rem}
        .vp-staff-cap{font-size:0.7rem;color:#6b7280}

        /* Info rows */
        .vp-info-row{display:flex;justify-content:space-between;align-items:flex-start;padding:0.5rem 0;border-bottom:1px solid #1a1a1a;font-size:0.78rem;gap:0.75rem}
        .vp-info-row:last-child{border-bottom:none}
        .vp-info-k{color:#6b7280;flex-shrink:0}
        .vp-info-v{color:#f0ede6;font-weight:500;text-align:right;word-break:break-word;min-width:0}

        /* Override */
        .vp-override{padding:1rem;border:1px solid;margin-bottom:1rem}
        .vp-override-on{border-color:rgba(34,197,94,0.3);background:rgba(34,197,94,0.06)}
        .vp-override-off{border-color:#2a2a2a;background:#111}
        .vp-override-title{font-size:0.78rem;font-weight:500;margin-bottom:0.25rem}
        .vp-override-desc{font-size:0.72rem;color:#6b7280;margin-bottom:0.875rem;line-height:1.5}

        /* Feedback */
        .vp-stars{display:flex;gap:0.625rem;margin-bottom:0.875rem}
        .vp-star{font-size:clamp(1.5rem,7vw,2rem);cursor:pointer;transition:transform 0.1s;line-height:1;-webkit-tap-highlight-color:transparent}
        .vp-star:hover{transform:scale(1.15)}
        .vp-star-filled{color:#b48c3c}
        .vp-star-empty{color:#2a2a2a}
        .vp-feedback-done{padding:1rem;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);font-size:0.82rem;color:#22c55e;line-height:1.5}

        /* Buttons */
        .vp-btn-gold{padding:0.55rem 1rem;background:#b48c3c;color:#0a0a0a;border:none;font-family:'DM Sans',sans-serif;font-size:0.75rem;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;cursor:pointer}
        .vp-btn-gold:disabled{opacity:0.5;cursor:not-allowed}
        .vp-btn-ghost{padding:0.5rem 0.875rem;background:transparent;border:1px solid #2a2a2a;color:#9ca3af;font-family:'DM Sans',sans-serif;font-size:0.72rem;cursor:pointer}
        .vp-btn-ghost:hover{border-color:#4b4b4b;color:#f0ede6}
        .vp-btn-ghost:disabled{opacity:0.4;cursor:not-allowed}
        .vp-btn-red{padding:0.4rem 0.7rem;background:transparent;border:1px solid rgba(239,68,68,0.2);color:rgba(239,68,68,0.6);font-family:'DM Sans',sans-serif;font-size:0.68rem;cursor:pointer}
        .vp-btn-red:hover{border-color:#ef4444;color:#ef4444}
        .vp-btn-red:disabled{opacity:0.3;cursor:not-allowed}
        .vp-btn-full{width:100%;padding:0.625rem;font-family:'DM Sans',sans-serif;font-size:0.78rem;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;cursor:pointer;border:none}
        .vp-btn-on{background:#22c55e;color:#0a0a0a}
        .vp-btn-off{background:#2a2a2a;color:#f0ede6}
        .vp-btn-full:disabled{opacity:0.5;cursor:not-allowed}
        .vp-btn-row{display:flex;gap:0.5rem}

        .vp-error{font-size:0.72rem;color:#ef4444;margin-top:0.35rem}
        .vp-textarea{padding:0.55rem 0.75rem;background:#161616;border:1px solid #2a2a2a;color:#f0ede6;font-family:'DM Sans',sans-serif;font-size:0.82rem;outline:none;width:100%;resize:vertical;min-height:80px}
        .vp-empty{font-size:0.78rem;color:#4b4b4b;padding:1rem 0;text-align:center}
      `}</style>

      <div className="vp-wrap">

        {/* Identity badge */}
        <div className="vp-badge">{vendor.name} · {roleLabel(vendor.role)}</div>

        {/* Event hero */}
        <div className="vp-hero">
          <div className="vp-event-name">{event.name}</div>
          <div className="vp-meta">
            {eventDate}{event.startTime&&` · ${event.startTime}`}{event.endTime&&` – ${event.endTime}`}
            {(event.venueName||event.venueAddress)&&<><br/>{event.venueName}{event.venueAddress&&`, ${event.venueAddress}`}</>}
          </div>
        </div>

        {/* ── VENDOR BRIEF — shown prominently if written ── */}
        {hasBrief && (
          <div className="vp-brief">
            <div className="vp-brief-title">Your brief</div>
            {vendor.arriveTime && (
              <div className="vp-brief-row">
                <span className="vp-brief-icon">🕐</span>
                <div>
                  <div className="vp-brief-label">Arrive by</div>
                  <div className="vp-brief-text">{vendor.arriveTime}</div>
                </div>
              </div>
            )}
            {vendor.arriveLocation && (
              <div className="vp-brief-row">
                <span className="vp-brief-icon">📍</span>
                <div>
                  <div className="vp-brief-label">Location</div>
                  <div className="vp-brief-text">{vendor.arriveLocation}</div>
                </div>
              </div>
            )}
            {vendor.instructions && (
              <div className="vp-brief-row">
                <span className="vp-brief-icon">📋</span>
                <div>
                  <div className="vp-brief-label">Instructions from planner</div>
                  <div className="vp-brief-text" style={{whiteSpace:"pre-wrap"}}>{vendor.instructions}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="vp-stats">
          <div className="vp-stat"><div className="vp-stat-num">{stats.totalGuests}</div><div className="vp-stat-label">Expected</div></div>
          <div className="vp-stat"><div className="vp-stat-num">{stats.checkedIn}</div><div className="vp-stat-label">Arrived</div></div>
          <div className="vp-stat"><div className="vp-stat-num">{stats.pending}</div><div className="vp-stat-label">Pending</div></div>
        </div>

        {/* Progress bar */}
        <div className="vp-card">
          <div className="vp-card-title">Arrival progress</div>
          <div className="vp-progress-label"><span>{stats.checkedIn} of {stats.totalGuests} guests</span><span>{checkinPct}%</span></div>
          <div className="vp-progress-track"><div className="vp-progress-fill" style={{width:`${checkinPct}%`}}/></div>
        </div>

        {/* ── CATERER: other vendor crew counts ── */}
        {isCaterer && allVendorStaff.length > 0 && (
          <div className="vp-card">
            <div className="vp-card-title">Vendor crew to cater for</div>
            <p style={{fontSize:"0.75rem",color:"#6b7280",marginBottom:"0.875rem",lineHeight:1.6}}>
              These are the other vendors and their crew sizes. Prepare food for guests + this crew total.
            </p>
            {allVendorStaff.map((v,i) => (
              <div className="vp-crew-row" key={i}>
                <div>
                  <div className="vp-crew-name">{v.name}</div>
                  <div className="vp-crew-role">{roleLabel(v.role)}</div>
                </div>
                <div className="vp-crew-count">{v.staffAllotted}</div>
              </div>
            ))}
            <div className="vp-crew-total">
              <span className="vp-crew-total-label">Total (guests + crew)</span>
              <span className="vp-crew-total-num">{stats.totalGuests + totalCrewCount}</span>
            </div>
          </div>
        )}

        {/* ── CATERER: food tallies ── */}
        {isCaterer && (
          <div className="vp-card">
            <div className="vp-card-title">Pre-ordered food</div>
            {foodTallies.length===0 ? <div className="vp-empty">No pre-ordered meals yet.</div> : foodTallies.map(item => (
              <div className="vp-tally-row" key={item.menuItemId}>
                <div><div className="vp-tally-name">{item.name}</div><div className="vp-tally-cat">{item.category.charAt(0)+item.category.slice(1).toLowerCase()}</div></div>
                <div className="vp-tally-count">{item.totalOrders}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── DRINK_VENDOR: drink tallies ── */}
        {isDrinkVendor && (
          <div className="vp-card">
            <div className="vp-card-title">Pre-ordered drinks</div>
            {drinkTallies.length===0 ? <div className="vp-empty">No pre-ordered drinks yet.</div> : drinkTallies.map(item => (
              <div className="vp-tally-row" key={item.menuItemId}>
                <div><div className="vp-tally-name">{item.name}</div><div className="vp-tally-cat">Drink</div></div>
                <div className="vp-tally-count">{item.totalOrders}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── SECURITY: walk-in toggle ── */}
        {isSecurity && vendor.canOverrideCapacity && (
          <div className={`vp-override ${vendor.capacityOverrideActive?"vp-override-on":"vp-override-off"}`}>
            <div className="vp-override-title" style={{color:vendor.capacityOverrideActive?"#22c55e":"#f0ede6"}}>
              {vendor.capacityOverrideActive?"Walk-in mode is ON":"Walk-in mode is off"}
            </div>
            <div className="vp-override-desc">When active, you can admit guests beyond the venue capacity limit. Only activate when instructed by the event planner.</div>
            <button className={`vp-btn-full ${vendor.capacityOverrideActive?"vp-btn-off":"vp-btn-on"}`} onClick={handleOverrideToggle} disabled={toggling}>
              {toggling?"Updating…":vendor.capacityOverrideActive?"Deactivate walk-in mode":"Activate walk-in mode"}
            </button>
          </div>
        )}

        {/* Event schedule */}
        {event.timeline.length > 0 && (
          <div className="vp-card">
            <div className="vp-card-title">Event schedule</div>
            {event.timeline.map(item => (
              <div className="vp-tl-item" key={item.id}>
                <div className="vp-tl-time">{item.time}</div>
                <div><div className="vp-tl-title">{item.title}</div>{item.description&&<div className="vp-tl-desc">{item.description}</div>}</div>
              </div>
            ))}
          </div>
        )}

        {/* Staff registration */}
        {(vendor.staffCount??0) > 0 && (
          <div className="vp-card">
            <div className="vp-card-title">
              My staff
              <span style={{fontSize:"0.65rem",color:"#6b7280",fontWeight:400,letterSpacing:0,textTransform:"none"}}>{vendor.staffRegistered} / {vendor.staffCount} registered</span>
            </div>
            {vendor.staff.length===0 ? <div className="vp-empty">No staff registered yet.</div> : vendor.staff.map(member => (
              <div className="vp-staff-row" key={member.id}>
                <div style={{minWidth:0}}><div className="vp-staff-name">{member.name}</div>{member.phone&&<div className="vp-staff-phone">{member.phone}</div>}</div>
                <div style={{display:"flex",alignItems:"center",gap:"0.5rem",flexShrink:0}}>
                  {member.checkedIn&&<span className="vp-staff-badge">Checked in</span>}
                  {!member.checkedIn&&<button className="vp-btn-red" onClick={()=>handleRemoveStaff(member.id)} disabled={removingId===member.id}>{removingId===member.id?"…":"Remove"}</button>}
                </div>
              </div>
            ))}
            {canAddStaff&&!showStaffForm&&(
              <button className="vp-btn-ghost" style={{marginTop:"0.875rem",width:"100%"}} onClick={()=>{setShowStaffForm(true);setStaffError("")}}>
                + Add staff member ({staffSlotsLeft} slot{staffSlotsLeft!==1?"s":""} remaining)
              </button>
            )}
            {showStaffForm&&(
              <div className="vp-staff-form">
                <div className="vp-staff-cap">{staffSlotsLeft} slot{staffSlotsLeft!==1?"s":""} remaining of {vendor.staffCount} allocated</div>
                <input style={inputStyle} placeholder="Staff name *" value={staffForm.name} onChange={e=>setStaffForm(f=>({...f,name:e.target.value}))}/>
                <input style={inputStyle} placeholder="Phone (optional)" type="tel" value={staffForm.phone} onChange={e=>setStaffForm(f=>({...f,phone:e.target.value}))}/>
                {staffError&&<div className="vp-error">{staffError}</div>}
                <div className="vp-btn-row">
                  <button className="vp-btn-gold" onClick={handleAddStaff} disabled={addingStaff} style={{flex:1}}>{addingStaff?"Adding…":"Add"}</button>
                  <button className="vp-btn-ghost" onClick={()=>{setShowStaffForm(false);setStaffError("")}}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Vendor details */}
        <div className="vp-card">
          <div className="vp-card-title">Your details</div>
          {vendor.contactName&&<div className="vp-info-row"><span className="vp-info-k">Contact</span><span className="vp-info-v">{vendor.contactName}</span></div>}
          <div className="vp-info-row"><span className="vp-info-k">Role</span><span className="vp-info-v">{roleLabel(vendor.role)}</span></div>
          {event.plannerPhone&&<div className="vp-info-row"><span className="vp-info-k">Planner phone</span><span className="vp-info-v">{event.plannerPhone}</span></div>}
          {event.plannerEmail&&<div className="vp-info-row"><span className="vp-info-k">Planner email</span><span className="vp-info-v">{event.plannerEmail}</span></div>}
        </div>

        {/* Post-event feedback */}
        {data.expiry.isInFeedbackWindow && (
          <div className="vp-card">
            <div className="vp-card-title">{feedbackDone?"Feedback submitted":"How did it go?"}</div>
            {feedbackDone ? (
              <div className="vp-feedback-done">
                ✓ Thank you for your feedback. The event planner will see your response.
                <br/><button className="vp-btn-ghost" style={{marginTop:"0.75rem",fontSize:"0.7rem"}} onClick={()=>setFeedbackDone(false)}>Edit my feedback</button>
              </div>
            ) : (
              <>
                <p style={{fontSize:"0.78rem",color:"#6b7280",marginBottom:"0.875rem",lineHeight:1.6}}>Share how the event went from your end. Goes directly to the planner.</p>
                <div className="vp-stars">{[1,2,3,4,5].map(star=><span key={star} className={`vp-star ${star<=feedbackRating?"vp-star-filled":"vp-star-empty"}`} onClick={()=>setFeedbackRating(star)}>★</span>)}</div>
                <textarea className="vp-textarea" placeholder="Any comments for the planner? (optional)" value={feedbackMessage} onChange={e=>setFeedbackMessage(e.target.value)} style={{marginBottom:"0.75rem"}}/>
                {feedbackError&&<div className="vp-error">{feedbackError}</div>}
                <button className="vp-btn-gold" onClick={handleFeedbackSubmit} disabled={submittingFeedback||feedbackRating===0} style={{width:"100%"}}>
                  {submittingFeedback?"Submitting…":"Submit feedback"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
