"use client"
// src/app/admin/page.tsx
// Product owner admin dashboard
// Protected by ADMIN_SECRET — not in dashboard layout
// Mobile-first

import { useState, useEffect, useCallback } from "react"

interface AdminData {
  stats: {
    totalPlanners: number; paidPlanners: number; freePlanners: number
    conversionRate: number; totalEvents: number; totalGuests: number
    totalVendors: number; activeSubscriptions: number; mrr: number
  }
  plannersByPlan: { plan: string; _count: { plan: number } }[]
  eventsByStatus: { status: string; _count: { status: number } }[]
  recentPlanners: {
    id: string; name: string | null; email: string | null
    plan: string; createdAt: string; _count: { events: number }
  }[]
  recentEvents: {
    id: string; name: string; status: string; eventDate: string; createdAt: string
    planner: { name: string | null; email: string | null }
    _count: { guests: number; vendors: number }
  }[]
  recentPayments: {
    id: string; plan: string; amount: number; status: string; createdAt: string
    user: { name: string | null; email: string | null }
  }[]
  failedPayments: {
    id: string; plan: string; createdAt: string
    user: { name: string | null; email: string | null }
  }[]
  recentLogs: {
    id: string; event: string; amount: number | null
    status: string; reference: string | null; createdAt: string
  }[]
}

const PLAN_COLORS: Record<string, string> = {
  free: "#6b7280", starter: "#b48c3c", pro: "#22c55e",
}

const EVENT_STATUS_COLORS: Record<string, string> = {
  DRAFT: "#6b7280", PUBLISHED: "#4a9eff", ONGOING: "#22c55e",
  COMPLETED: "#a78bfa", CANCELLED: "#ef4444",
}

const fmtNGN = (n: number) => `₦${n.toLocaleString("en-NG")}`
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-NG", { day:"numeric", month:"short", year:"numeric" })

export default function AdminPage() {
  const [secret,   setSecret]   = useState("")
  const [authed,   setAuthed]   = useState(false)
  const [data,     setData]     = useState<AdminData | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")
  const [tab,      setTab]      = useState<"overview"|"planners"|"events"|"payments"|"logs">("overview")

  // Plan override
  const [overrideUserId, setOverrideUserId] = useState("")
  const [overridePlan,   setOverridePlan]   = useState("starter")
  const [overrideNote,   setOverrideNote]   = useState("")
  const [overriding,     setOverriding]     = useState(false)
  const [overrideMsg,    setOverrideMsg]    = useState("")

  const fetchData = useCallback(async (s: string) => {
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/admin", { headers: { "x-admin-secret": s } })
      if (res.status === 401) { setError("Wrong secret."); return }
      if (!res.ok) { setError("Failed to load."); return }
      setData(await res.json())
      setAuthed(true)
    } catch { setError("Network error.") }
    finally { setLoading(false) }
  }, [])

  const handleLogin = () => { if (secret.trim()) fetchData(secret.trim()) }

  const handleOverride = async () => {
    if (!overrideUserId.trim()) { setOverrideMsg("Enter a user ID."); return }
    setOverriding(true); setOverrideMsg("")
    try {
      const res = await fetch(`/api/admin/users/${overrideUserId.trim()}`, {
        method:  "PATCH",
        headers: { "Content-Type":"application/json", "x-admin-secret": secret },
        body:    JSON.stringify({ plan: overridePlan, note: overrideNote }),
      })
      const d = await res.json()
      if (!res.ok) { setOverrideMsg(d.error ?? "Failed"); return }
      setOverrideMsg(`✓ ${d.user.name ?? d.user.email} → ${overridePlan}`)
      setTimeout(() => fetchData(secret), 1000)
    } catch { setOverrideMsg("Network error.") }
    finally { setOverriding(false) }
  }

  if (!authed) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#0a0a0a;color:#f0ece4;font-family:'DM Sans',sans-serif}
      `}</style>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", padding:"2rem" }}>
        <div style={{ width:"100%", maxWidth:380 }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"2rem", fontWeight:300, color:"#f0ece4", marginBottom:"0.375rem" }}>Admin</div>
          <div style={{ fontSize:"0.75rem", color:"rgba(240,236,228,0.35)", marginBottom:"2rem" }}>EventFlow product dashboard</div>
          <input
            type="password"
            placeholder="Admin secret"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            onKeyDown={e => e.key==="Enter" && handleLogin()}
            style={{ width:"100%", padding:"0.75rem 1rem", background:"#111", border:"1px solid rgba(180,140,60,0.2)", color:"#f0ece4", fontFamily:"'DM Sans',sans-serif", fontSize:"0.9rem", outline:"none", marginBottom:"0.75rem" }}
          />
          {error && <div style={{ fontSize:"0.75rem", color:"#ef4444", marginBottom:"0.75rem" }}>{error}</div>}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{ width:"100%", padding:"0.75rem", background:"#b48c3c", color:"#0a0a0a", border:"none", fontFamily:"'DM Sans',sans-serif", fontSize:"0.82rem", fontWeight:500, cursor:"pointer", letterSpacing:"0.05em", textTransform:"uppercase" }}
          >
            {loading ? "Loading…" : "Enter"}
          </button>
        </div>
      </div>
    </>
  )

  if (!data) return null

  const { stats } = data

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#0a0a0a;color:#f0ece4;font-family:'DM Sans',sans-serif}

        .ad{max-width:960px;margin:0 auto;padding:1.25rem 1rem 4rem;overflow-x:hidden;width:100%}
        @media(min-width:600px){.ad{padding:2rem 1.5rem 4rem}}

        .ad-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.75rem;flex-wrap:wrap;gap:0.75rem}
        .ad-title{font-family:'Cormorant Garamond',serif;font-size:clamp(1.375rem,4vw,1.75rem);font-weight:300;color:#f0ece4}

        /* Stats grid */
        .ad-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:0.625rem;margin-bottom:1.5rem}
        @media(min-width:480px){.ad-stats{grid-template-columns:repeat(4,1fr)}}
        .ad-stat{background:#111;border:1px solid rgba(180,140,60,0.12);padding:1rem;text-align:center}
        .ad-stat-num{font-family:'Cormorant Garamond',serif;font-size:1.75rem;font-weight:300;line-height:1;margin-bottom:0.25rem}
        .ad-stat-label{font-size:0.55rem;color:rgba(240,236,228,0.35);letter-spacing:0.1em;text-transform:uppercase}

        /* Tabs */
        .ad-tabs{display:flex;overflow-x:auto;-webkit-overflow-scrolling:touch;border-bottom:1px solid rgba(180,140,60,0.12);margin-bottom:1.5rem}
        .ad-tabs::-webkit-scrollbar{display:none}
        .ad-tab{padding:0.625rem 0.875rem;background:transparent;border:none;border-bottom:2px solid transparent;color:rgba(240,236,228,0.35);font-family:'DM Sans',sans-serif;font-size:0.75rem;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:all 0.2s}
        .ad-tab.on{color:#b48c3c;border-bottom-color:#b48c3c}

        /* Cards */
        .ad-card{background:#111;border:1px solid rgba(180,140,60,0.12);padding:1.125rem;margin-bottom:1rem;overflow:hidden}
        .ad-card-title{font-size:0.58rem;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:1rem;display:flex;align-items:center;gap:0.75rem;color:#b48c3c}
        .ad-card-title::after{content:'';flex:1;height:1px;background:rgba(180,140,60,0.12)}

        /* Table rows */
        .ad-row{padding:0.625rem 0;border-bottom:1px solid rgba(180,140,60,0.06);display:flex;align-items:flex-start;justify-content:space-between;gap:0.75rem;min-width:0}
        .ad-row:last-child{border-bottom:none}
        .ad-row-name{font-size:0.82rem;color:#f0ece4;font-weight:500;margin-bottom:0.15rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px}
        .ad-row-sub{font-size:0.68rem;color:rgba(240,236,228,0.35)}
        .ad-row-right{text-align:right;flex-shrink:0}

        /* Plan badge */
        .ad-plan{font-size:0.6rem;font-weight:500;letter-spacing:0.06em;padding:0.15rem 0.45rem;border-radius:99px;border:1px solid;white-space:nowrap}

        /* Inputs */
        .ad-input{padding:0.55rem 0.75rem;background:#1a1a1a;border:1px solid rgba(180,140,60,0.2);color:#f0ece4;font-family:'DM Sans',sans-serif;font-size:0.82rem;outline:none;width:100%;transition:border-color 0.2s}
        .ad-input:focus{border-color:#b48c3c}
        .ad-select{padding:0.55rem 0.75rem;background:#1a1a1a;border:1px solid rgba(180,140,60,0.2);color:#f0ece4;font-family:'DM Sans',sans-serif;font-size:0.82rem;outline:none;width:100%}
        .ad-btn-gold{padding:0.55rem 1.125rem;background:#b48c3c;color:#0a0a0a;border:none;font-family:'DM Sans',sans-serif;font-size:0.75rem;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;cursor:pointer}
        .ad-btn-gold:disabled{opacity:0.5;cursor:not-allowed}

        /* Log row */
        .ad-log-row{padding:0.5rem 0;border-bottom:1px solid rgba(180,140,60,0.06);font-size:0.72rem;min-width:0}
        .ad-log-row:last-child{border-bottom:none}
        .ad-log-event{color:#f0ece4;margin-bottom:0.15rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ad-log-meta{color:rgba(240,236,228,0.35)}

        /* MRR highlight */
        .ad-mrr{background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);padding:1.125rem;margin-bottom:1rem;text-align:center}
        .ad-mrr-num{font-family:'Cormorant Garamond',serif;font-size:2.5rem;font-weight:300;color:#22c55e;line-height:1;margin-bottom:0.25rem}
        .ad-mrr-label{font-size:0.6rem;color:rgba(34,197,94,0.6);letter-spacing:0.15em;text-transform:uppercase}

        .ad-success{font-size:0.72rem;color:#22c55e;margin-top:0.5rem}
        .ad-error  {font-size:0.72rem;color:#ef4444;margin-top:0.5rem}
        .ad-grid2  {display:grid;grid-template-columns:1fr;gap:0.625rem}
        @media(min-width:480px){.ad-grid2{grid-template-columns:1fr 1fr}}
      `}</style>

      <div className="ad">
        <div className="ad-header">
          <div className="ad-title">EventFlow Admin</div>
          <button onClick={() => fetchData(secret)} style={{ fontSize:"0.72rem",color:"rgba(240,236,228,0.4)",background:"transparent",border:"1px solid rgba(180,140,60,0.15)",padding:"0.35rem 0.75rem",cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>
            Refresh
          </button>
        </div>

        {/* MRR */}
        <div className="ad-mrr">
          <div className="ad-mrr-num">{fmtNGN(stats.mrr)}</div>
          <div className="ad-mrr-label">Monthly recurring revenue</div>
        </div>

        {/* Key stats */}
        <div className="ad-stats">
          {[
            { num:stats.totalPlanners,      label:"Planners",     color:"#b48c3c" },
            { num:stats.paidPlanners,        label:"Paid",         color:"#22c55e" },
            { num:`${stats.conversionRate}%`,label:"Conversion",   color:"#4a9eff" },
            { num:stats.activeSubscriptions, label:"Active subs",  color:"#a78bfa" },
            { num:stats.totalEvents,         label:"Events",       color:"#b48c3c" },
            { num:stats.totalGuests,         label:"Guests",       color:"#b48c3c" },
            { num:stats.totalVendors,        label:"Vendors",      color:"#b48c3c" },
            { num:stats.freePlanners,        label:"Free tier",    color:"#6b7280" },
          ].map(s => (
            <div className="ad-stat" key={s.label}>
              <div className="ad-stat-num" style={{ color:s.color }}>{s.num}</div>
              <div className="ad-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="ad-tabs">
          {(["overview","planners","events","payments","logs"] as const).map(t => (
            <button key={t} className={`ad-tab${tab===t?" on":""}`} onClick={()=>setTab(t)}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>

        {/* ══ OVERVIEW ══ */}
        {tab==="overview" && (
          <>
            {/* Plan breakdown */}
            <div className="ad-card">
              <div className="ad-card-title">Plans</div>
              {data.plannersByPlan.map(p => (
                <div className="ad-row" key={p.plan}>
                  <span className="ad-plan" style={{ color:PLAN_COLORS[p.plan]??"#6b7280", borderColor:`${PLAN_COLORS[p.plan]??'#6b7280'}44`, background:`${PLAN_COLORS[p.plan]??'#6b7280'}11` }}>
                    {p.plan}
                  </span>
                  <span style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:"1.25rem",fontWeight:300,color:"#f0ece4" }}>{p._count.plan}</span>
                </div>
              ))}
            </div>

            {/* Event status breakdown */}
            <div className="ad-card">
              <div className="ad-card-title">Events by status</div>
              {data.eventsByStatus.map(e => (
                <div className="ad-row" key={e.status}>
                  <span style={{ fontSize:"0.78rem",color:EVENT_STATUS_COLORS[e.status]??"#6b7280" }}>{e.status.charAt(0)+e.status.slice(1).toLowerCase()}</span>
                  <span style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:"1.25rem",fontWeight:300,color:"#f0ece4" }}>{e._count.status}</span>
                </div>
              ))}
            </div>

            {/* Manual plan override */}
            <div className="ad-card">
              <div className="ad-card-title">Manual plan override</div>
              <p style={{ fontSize:"0.72rem",color:"rgba(240,236,228,0.35)",marginBottom:"1rem",lineHeight:1.6 }}>Override any planner's plan — use when Paystack has an issue or for testing.</p>
              <div className="ad-grid2">
                <div>
                  <div style={{ fontSize:"0.63rem",color:"rgba(240,236,228,0.35)",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"0.35rem" }}>User ID</div>
                  <input className="ad-input" placeholder="cuid..." value={overrideUserId} onChange={e=>setOverrideUserId(e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize:"0.63rem",color:"rgba(240,236,228,0.35)",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"0.35rem" }}>Set plan to</div>
                  <select className="ad-select" value={overridePlan} onChange={e=>setOverridePlan(e.target.value)}>
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                  </select>
                </div>
                <div style={{ gridColumn:"1/-1" }}>
                  <div style={{ fontSize:"0.63rem",color:"rgba(240,236,228,0.35)",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"0.35rem" }}>Note (optional)</div>
                  <input className="ad-input" placeholder="Reason for override…" value={overrideNote} onChange={e=>setOverrideNote(e.target.value)} />
                </div>
              </div>
              <div style={{ marginTop:"0.875rem" }}>
                <button className="ad-btn-gold" onClick={handleOverride} disabled={overriding}>{overriding?"Saving…":"Apply override"}</button>
              </div>
              {overrideMsg && <div className={overrideMsg.startsWith("✓")?"ad-success":"ad-error"}>{overrideMsg}</div>}
            </div>

            {/* Failed payments */}
            {data.failedPayments.length > 0 && (
              <div className="ad-card" style={{ borderColor:"rgba(239,68,68,0.2)" }}>
                <div className="ad-card-title" style={{ color:"#ef4444" }}>Failed payments</div>
                {data.failedPayments.map(p => (
                  <div className="ad-row" key={p.id}>
                    <div style={{ minWidth:0 }}>
                      <div className="ad-row-name">{p.user.name ?? p.user.email ?? "Unknown"}</div>
                      <div className="ad-row-sub">{p.user.email} · {p.plan} plan · {fmtDate(p.createdAt)}</div>
                    </div>
                    <span style={{ fontSize:"0.6rem",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",padding:"0.15rem 0.45rem",borderRadius:"99px",flexShrink:0 }}>Past due</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══ PLANNERS ══ */}
        {tab==="planners" && (
          <div className="ad-card">
            <div className="ad-card-title">Recent planners</div>
            {data.recentPlanners.map(u => (
              <div className="ad-row" key={u.id}>
                <div style={{ minWidth:0 }}>
                  <div className="ad-row-name">{u.name ?? "—"}</div>
                  <div className="ad-row-sub">{u.email} · {u._count.events} event{u._count.events!==1?"s":""} · {fmtDate(u.createdAt)}</div>
                  <div style={{ fontSize:"0.62rem",color:"rgba(240,236,228,0.3)",marginTop:"0.15rem",fontFamily:"monospace" }}>{u.id}</div>
                </div>
                <div className="ad-row-right">
                  <span className="ad-plan" style={{ color:PLAN_COLORS[u.plan]??"#6b7280", borderColor:`${PLAN_COLORS[u.plan]??'#6b7280'}44`, background:`${PLAN_COLORS[u.plan]??'#6b7280'}11` }}>
                    {u.plan}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ EVENTS ══ */}
        {tab==="events" && (
          <div className="ad-card">
            <div className="ad-card-title">Recent events</div>
            {data.recentEvents.map(e => (
              <div className="ad-row" key={e.id}>
                <div style={{ minWidth:0 }}>
                  <div className="ad-row-name">{e.name}</div>
                  <div className="ad-row-sub">{e.planner.email} · {e._count.guests} guests · {e._count.vendors} vendors · {fmtDate(e.eventDate)}</div>
                </div>
                <div className="ad-row-right">
                  <span style={{ fontSize:"0.6rem",color:EVENT_STATUS_COLORS[e.status]??"#6b7280",border:`1px solid ${EVENT_STATUS_COLORS[e.status]??'#6b7280'}44`,padding:"0.15rem 0.45rem",borderRadius:"99px",whiteSpace:"nowrap" }}>
                    {e.status.charAt(0)+e.status.slice(1).toLowerCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ PAYMENTS ══ */}
        {tab==="payments" && (
          <div className="ad-card">
            <div className="ad-card-title">Recent subscriptions</div>
            {data.recentPayments.map(p => (
              <div className="ad-row" key={p.id}>
                <div style={{ minWidth:0 }}>
                  <div className="ad-row-name">{p.user.name ?? p.user.email ?? "Unknown"}</div>
                  <div className="ad-row-sub">{p.plan} plan · {fmtDate(p.createdAt)}</div>
                </div>
                <div className="ad-row-right">
                  <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:"1rem",fontWeight:300,color:"#22c55e" }}>{fmtNGN(Number(p.amount)/100)}</div>
                  <div style={{ fontSize:"0.6rem",color:p.status==="ACTIVE"?"#22c55e":"#ef4444" }}>{p.status.toLowerCase()}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ LOGS ══ */}
        {tab==="logs" && (
          <div className="ad-card">
            <div className="ad-card-title">Payment log</div>
            {data.recentLogs.map(l => (
              <div className="ad-log-row" key={l.id}>
                <div className="ad-log-event">{l.event}</div>
                <div className="ad-log-meta">
                  {l.reference && <span style={{ marginRight:"0.75rem" }}>{l.reference}</span>}
                  {l.amount && <span style={{ marginRight:"0.75rem" }}>{fmtNGN(l.amount/100)}</span>}
                  <span>{l.status}</span>
                  <span style={{ marginLeft:"0.75rem",opacity:0.5 }}>{fmtDate(l.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
