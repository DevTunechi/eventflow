// ─────────────────────────────────────────────
// FILE: src/app/usher/[accessToken]/page.tsx
// Mobile-first rewrite — tightened padding,
// fixed stat grid, action cards sized for touch.
// ─────────────────────────────────────────────

"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

interface UsherPortalData {
  usher: { id:string; name:string; role:"MAIN"|"FLOOR"; phone:string|null; isActive:boolean }
  event: { id:string; name:string; eventDate:string; startTime:string|null; venueName:string|null; venueAddress:string|null; status:string; invitationCard:string|null }
  stats: { totalGuests:number; checkedIn:number; pending:number; flagged:number }
  expiry:{ isExpired:boolean; isInFeedbackWindow:boolean; expiresAt:string }
}

export default function UsherPortalPage() {
  const { accessToken } = useParams<{ accessToken:string }>()

  const [data,             setData]             = useState<UsherPortalData|null>(null)
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState<string|null>(null)
  const [expired,          setExpired]          = useState(false)
  const [expiredEventName, setExpiredEventName] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/usher/${accessToken}`)
        if (res.status===410) { const d=await res.json(); setExpiredEventName(d.eventName??"this event"); setExpired(true); return }
        if (res.status===404) { setError("This usher link is invalid or has expired."); return }
        if (!res.ok)          { setError("Failed to load your portal. Try again."); return }
        setData(await res.json())
      } catch { setError("Network error — please check your connection.") }
      finally { setLoading(false) }
    }
    load()
  }, [accessToken])

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",gap:"0.75rem"}}>
      <div style={{width:22,height:22,border:"1.5px solid rgba(180,140,60,0.2)",borderTopColor:"#b48c3c",borderRadius:"50%",animation:"spin 0.7s linear infinite"}} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (expired) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Cormorant+Garamond:wght@300;400&display=swap');
        *,*::before,*::after{box-sizing:border-box}
        body{margin:0;background:#0a0a0a;color:#f0ede6;font-family:'DM Sans',sans-serif}
      `}</style>
      <div style={{maxWidth:480,margin:"0 auto",padding:"4rem 1.25rem",textAlign:"center"}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.75rem",fontWeight:300,marginBottom:"0.75rem"}}>{expiredEventName}</div>
        <p style={{fontSize:"0.82rem",color:"#6b7280",lineHeight:1.7,marginBottom:"2rem"}}>This event has ended and your usher access has closed.<br/>Thank you for your service.</p>
        <div style={{fontSize:"0.7rem",color:"#4b4b4b",letterSpacing:"0.1em",textTransform:"uppercase"}}>Powered by EventFlow</div>
      </div>
    </>
  )

  if (error||!data) return (
    <div style={{padding:"3rem 1.25rem",textAlign:"center",fontFamily:"sans-serif"}}>
      <p style={{color:"#6b7280",marginBottom:"0.5rem",fontSize:"0.9rem"}}>{error??"Portal unavailable"}</p>
      <p style={{fontSize:"0.75rem",color:"#9ca3af"}}>Contact your event planner for a new link.</p>
    </div>
  )

  const { usher, event, stats } = data
  const eventDate  = new Date(event.eventDate).toLocaleDateString("en-NG",{weekday:"long",year:"numeric",month:"long",day:"numeric"})
  const checkinPct = stats.totalGuests>0 ? Math.round((stats.checkedIn/stats.totalGuests)*100) : 0

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Cormorant+Garamond:wght@300;400&display=swap');
        *,*::before,*::after{box-sizing:border-box}
        body{margin:0;background:#0a0a0a;color:#f0ede6;font-family:'DM Sans',sans-serif}

        .up-wrap { max-width:480px; margin:0 auto; padding:1.5rem 1rem 4rem; width:100%; overflow-x:hidden; }
        @media(min-width:480px){ .up-wrap { padding:2rem 1.25rem 4rem; } }

        /* Identity badge */
        .up-badge { display:inline-flex; align-items:center; gap:0.5rem; padding:0.3rem 0.75rem; border:1px solid #2a2a2a; background:#161616; font-size:0.7rem; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:1.25rem; }
        .up-role-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }

        /* Event hero */
        .up-hero { background:#111; border:1px solid #2a2a2a; padding:1.125rem; margin-bottom:1rem; }
        .up-event-name { font-family:'Cormorant Garamond',serif; font-size:clamp(1.25rem,5vw,1.5rem); font-weight:300; margin-bottom:0.5rem; color:#f0ede6; word-break:break-word; }
        .up-meta { font-size:0.75rem; color:#6b7280; line-height:1.8; }

        /* Stats — 2x2 grid */
        .up-stats { display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-bottom:1rem; }
        .up-stat  { background:#111; border:1px solid #2a2a2a; padding:0.875rem 0.75rem; text-align:center; }
        .up-stat-num   { font-family:'Cormorant Garamond',serif; font-size:clamp(1.5rem,6vw,2rem); font-weight:300; color:#b48c3c; line-height:1; margin-bottom:0.2rem; }
        .up-stat-label { font-size:0.55rem; color:#6b7280; letter-spacing:0.08em; text-transform:uppercase; }

        /* Progress */
        .up-progress-wrap  { background:#111; border:1px solid #2a2a2a; padding:1rem; margin-bottom:1rem; }
        .up-progress-label { display:flex; justify-content:space-between; font-size:0.72rem; color:#6b7280; margin-bottom:0.5rem; }
        .up-progress-track { height:4px; background:#2a2a2a; border-radius:2px; overflow:hidden; }
        .up-progress-fill  { height:100%; background:#b48c3c; border-radius:2px; transition:width 0.6s ease; }

        /* Flagged */
        .up-flagged { padding:0.875rem 1rem; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); margin-bottom:1rem; font-size:0.78rem; color:rgba(239,68,68,0.85); line-height:1.5; }
        .up-flagged strong { display:block; color:#ef4444; margin-bottom:0.1rem; font-weight:500; }

        /* Action nav cards — large touch targets */
        .up-actions { display:flex; flex-direction:column; gap:0.625rem; }
        .up-action  { display:flex; align-items:center; gap:1rem; padding:1rem; background:#111; border:1px solid #2a2a2a; text-decoration:none; transition:border-color 0.2s; -webkit-tap-highlight-color:transparent; }
        .up-action:hover { border-color:#b48c3c; }
        .up-action:active { background:rgba(180,140,60,0.06); }
        .up-action-icon  { font-size:1.25rem; flex-shrink:0; width:32px; text-align:center; }
        .up-action-label { font-size:0.875rem; font-weight:500; color:#f0ede6; margin-bottom:0.15rem; }
        .up-action-desc  { font-size:0.7rem; color:#6b7280; }
        .up-action-arrow { margin-left:auto; color:#4b4b4b; font-size:0.8rem; flex-shrink:0; transition:transform 0.2s,color 0.2s; }
        .up-action:hover .up-action-arrow { transform:translateX(3px); color:#b48c3c; }
      `}</style>

      <div className="up-wrap">
        {/* Identity badge */}
        <div className="up-badge">
          <span className="up-role-dot" style={{background:usher.role==="MAIN"?"#22c55e":"#b48c3c"}} />
          {usher.name} · {usher.role==="MAIN"?"Gate Scanner":"Floor Usher"}
        </div>

        {/* Event hero */}
        <div className="up-hero">
          <div className="up-event-name">{event.name}</div>
          <div className="up-meta">
            {eventDate}{event.startTime&&` · ${event.startTime}`}
            {event.venueName&&<><br/>{event.venueName}{event.venueAddress&&`, ${event.venueAddress}`}</>}
          </div>
        </div>

        {/* Stats */}
        <div className="up-stats">
          <div className="up-stat"><div className="up-stat-num">{stats.checkedIn}</div><div className="up-stat-label">Checked in</div></div>
          <div className="up-stat"><div className="up-stat-num">{stats.pending}</div><div className="up-stat-label">Pending</div></div>
          <div className="up-stat"><div className="up-stat-num">{stats.totalGuests}</div><div className="up-stat-label">Total guests</div></div>
          <div className="up-stat">
            <div className="up-stat-num" style={{color:stats.flagged>0?"#ef4444":"#b48c3c"}}>{stats.flagged}</div>
            <div className="up-stat-label">Flagged</div>
          </div>
        </div>

        {/* Progress */}
        <div className="up-progress-wrap">
          <div className="up-progress-label"><span>Check-in progress</span><span>{checkinPct}%</span></div>
          <div className="up-progress-track"><div className="up-progress-fill" style={{width:`${checkinPct}%`}} /></div>
        </div>

        {/* Flagged warning */}
        {stats.flagged>0&&(
          <div className="up-flagged">
            <strong>⚠ {stats.flagged} flagged guest{stats.flagged!==1?"s":""}</strong>
            QR codes scanned more than once or guests not on the confirmed list. Alert your supervisor.
          </div>
        )}

        {/* Action buttons */}
        <div className="up-actions">
          {usher.role==="MAIN" ? (
            <>
              <Link href={`/checkin/${accessToken}`} className="up-action">
                <span className="up-action-icon">📷</span>
                <div><div className="up-action-label">Scan QR Code</div><div className="up-action-desc">Point camera at guest QR to check them in</div></div>
                <span className="up-action-arrow">→</span>
              </Link>
              <Link href={`/checkin/${accessToken}/search`} className="up-action">
                <span className="up-action-icon">🔍</span>
                <div><div className="up-action-label">Search Guest</div><div className="up-action-desc">Find guest by name or phone number</div></div>
                <span className="up-action-arrow">→</span>
              </Link>
            </>
          ) : (
            <>
              <Link href={`/checkin/${accessToken}/tables`} className="up-action">
                <span className="up-action-icon">🪑</span>
                <div><div className="up-action-label">Table Assignments</div><div className="up-action-desc">See which guests are at each table</div></div>
                <span className="up-action-arrow">→</span>
              </Link>
              <Link href={`/checkin/${accessToken}/search`} className="up-action">
                <span className="up-action-icon">🔍</span>
                <div><div className="up-action-label">Find a Guest</div><div className="up-action-desc">Look up a guest's table by name or phone</div></div>
                <span className="up-action-arrow">→</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  )
}
