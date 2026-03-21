"use client"
// src/app/(dashboard)/pricing/page.tsx
// Mobile-first — 3 plans + top-up modal with event selector

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Cookies from "js-cookie"

type BillingMode = "monthly" | "per-event"
type TopUpType   = "GUESTS" | "WHATSAPP" | "CHECKIN"

const PLANS = {
  free: {
    name:"Free", tagline:"Get started at no cost",
    monthly:0, perEvent:0, color:"#6b7280",
    features:[
      { text:"1 active event",              included:true  },
      { text:"Up to 100 guests per event",  included:true  },
      { text:"Email invitations",           included:true  },
      { text:"OTP phone verification",      included:true  },
      { text:"RSVP management",             included:true  },
      { text:"Basic check-in (QR scan)",    included:true  },
      { text:"Guest tiers",                 included:true  },
      { text:"Vendor portals",              included:false },
      { text:"WhatsApp invites",            included:false },
      { text:"Unlimited guests",            included:false },
      { text:"Multiple active events",      included:false },
      { text:"CSV & Google Sheets import",  included:false },
      { text:"Analytics & reports",         included:false },
      { text:"Priority support",            included:false },
    ],
  },
  starter: {
    name:"Starter", tagline:"For growing event planners",
    monthly:5000, perEvent:3000, color:"#b48c3c",
    features:[
      { text:"3 active events",             included:true  },
      { text:"Up to 500 guests per event",  included:true  },
      { text:"Email invitations",           included:true  },
      { text:"OTP phone verification",      included:true  },
      { text:"RSVP management",             included:true  },
      { text:"Advanced check-in (QR scan)", included:true  },
      { text:"Guest tiers",                 included:true  },
      { text:"Vendor portals",              included:true  },
      { text:"WhatsApp invites",            included:false },
      { text:"Unlimited guests",            included:false },
      { text:"Multiple active events",      included:false },
      { text:"CSV & Google Sheets import",  included:false },
      { text:"Analytics & reports",         included:false },
      { text:"Priority support",            included:false },
    ],
  },
  pro: {
    name:"Pro", tagline:"For professional event planners",
    monthly:15000, perEvent:8000, color:"#b48c3c",
    features:[
      { text:"Unlimited active events",     included:true },
      { text:"Unlimited guests per event",  included:true },
      { text:"Email invitations",           included:true },
      { text:"OTP phone verification",      included:true },
      { text:"RSVP management",             included:true },
      { text:"Advanced check-in (QR scan)", included:true },
      { text:"Guest tiers",                 included:true },
      { text:"Vendor portals",              included:true },
      { text:"WhatsApp invites",            included:true },
      { text:"Unlimited guests",            included:true },
      { text:"Multiple active events",      included:true },
      { text:"CSV & Google Sheets import",  included:true },
      { text:"Analytics & reports",         included:true },
      { text:"Priority support",            included:true },
    ],
  },
}

const TOPUPS: { type: TopUpType; name: string; desc: string; price: string; amount: number }[] = [
  { type:"GUESTS",   name:"Extra Guests Pack",        desc:"+200 guests added to one event. Can be stacked.", price:"₦2,000", amount:200_000 },
  { type:"WHATSAPP", name:"WhatsApp QR Delivery",     desc:"Send QR codes via WhatsApp to all confirmed guests.", price:"₦1,500", amount:150_000 },
  { type:"CHECKIN",  name:"Priority Check-in Tools",  desc:"Multi-usher dashboard, live alerts, check-in analytics.", price:"₦2,500", amount:250_000 },
]

const fmt = (n: number) => n === 0 ? "₦0" : `₦${n.toLocaleString("en-NG")}`

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("ef-session") ?? "" : ""
  return token ? { Authorization: `Bearer ${token}` } : {}
}

interface EventOption { id: string; name: string; eventDate: string }

export default function PricingPage() {
  const [billing,   setBilling]   = useState<BillingMode>("monthly")
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const router = useRouter()

  // Top-up modal state
  const [topupModal,    setTopupModal]    = useState<(typeof TOPUPS)[0] | null>(null)
  const [events,        setEvents]        = useState<EventOption[]>([])
  const [selectedEvent, setSelectedEvent] = useState("")
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [buyingTopup,   setBuyingTopup]   = useState(false)
  const [topupError,    setTopupError]    = useState("")

  // Load planner's events when modal opens
  useEffect(() => {
    if (!topupModal) return
    setLoadingEvents(true); setTopupError(""); setSelectedEvent("")
    fetch("/api/events", { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : []
        setEvents(list.filter((e: EventOption & { status: string }) =>
          ["PUBLISHED","ONGOING","DRAFT"].includes(e.status)
        ))
      })
      .catch(() => setTopupError("Failed to load events"))
      .finally(() => setLoadingEvents(false))
  }, [topupModal])

  const handleContinueFree = () => {
    Cookies.set("ef-plan", "free-acknowledged", { expires: 365 })
    router.push("/dashboard")
  }

  const handleUpgrade = async (plan: "starter" | "pro") => {
    setUpgrading(plan)
    try {
      const res = await fetch("/api/payments/subscribe", {
        method:  "POST",
        headers: { "Content-Type":"application/json", ...getAuthHeaders() },
        body:    JSON.stringify({ plan }),
      })
      const d = await res.json()
      if (d.authorizationUrl) {
        window.location.href = d.authorizationUrl
      } else {
        alert(d.error ?? "Something went wrong. Please try again.")
      }
    } catch { alert("Network error. Please try again.") }
    finally { setUpgrading(null) }
  }

  const handleBuyTopup = async () => {
    if (!topupModal || !selectedEvent) { setTopupError("Please select an event."); return }
    setBuyingTopup(true); setTopupError("")
    try {
      const res = await fetch("/api/payments/topup", {
        method:  "POST",
        headers: { "Content-Type":"application/json", ...getAuthHeaders() },
        body:    JSON.stringify({ eventId: selectedEvent, type: topupModal.type }),
      })
      const d = await res.json()
      if (d.authorizationUrl) {
        window.location.href = d.authorizationUrl
      } else {
        setTopupError(d.error ?? "Payment initialisation failed")
      }
    } catch { setTopupError("Network error. Please try again.") }
    finally { setBuyingTopup(false) }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        /* ── Root ── */
        .pp { max-width: 960px; margin: 0 auto; padding: 1.25rem 1rem 5rem; overflow-x: hidden; width: 100%; }
        @media(min-width:600px){ .pp { padding: 2rem 1.5rem 5rem; } }

        .pp-back { font-size:0.78rem; color:var(--text-3); text-decoration:none; display:inline-flex; align-items:center; gap:0.35rem; transition:color 0.2s; margin-bottom:1.75rem; }
        .pp-back:hover { color:var(--gold); }

        .pp-hero { text-align:center; margin-bottom:2rem; }
        .pp-eyebrow { font-size:0.6rem; font-weight:500; letter-spacing:0.25em; text-transform:uppercase; color:var(--gold); margin-bottom:0.625rem; }
        .pp-headline { font-family:'Cormorant Garamond',serif; font-size:clamp(1.75rem,5vw,3rem); font-weight:300; color:var(--text); line-height:1.1; letter-spacing:-0.02em; margin-bottom:0.75rem; }
        .pp-sub { font-size:0.82rem; color:var(--text-3); max-width:420px; margin:0 auto; line-height:1.7; font-weight:300; }

        /* Toggle */
        .pp-toggle-wrap { display:flex; justify-content:center; margin-bottom:2rem; }
        .pp-toggle { display:flex; background:var(--bg-2); border:1px solid var(--border); border-radius:8px; padding:3px; gap:3px; }
        .pp-toggle-btn { padding:0.4rem 1rem; font-family:'DM Sans',sans-serif; font-size:0.72rem; letter-spacing:0.04em; border:none; border-radius:6px; cursor:pointer; transition:all 0.2s; color:var(--text-3); background:transparent; white-space:nowrap; }
        .pp-toggle-btn.on { background:var(--gold); color:#0a0a0a; font-weight:500; }
        .pp-save-badge { font-size:0.55rem; font-weight:500; letter-spacing:0.06em; text-transform:uppercase; padding:0.12rem 0.4rem; border-radius:99px; background:rgba(34,197,94,0.12); border:1px solid rgba(34,197,94,0.3); color:#22c55e; margin-left:0.4rem; vertical-align:middle; }

        /* Plan grid — single col → 2 col → 3 col */
        .pp-grid { display:grid; grid-template-columns:1fr; gap:0.875rem; align-items:start; margin-bottom:2.5rem; }
        @media(min-width:560px){ .pp-grid { grid-template-columns:1fr 1fr; } }
        @media(min-width:860px){ .pp-grid { grid-template-columns:1fr 1fr 1fr; } }

        .pp-card { background:var(--bg-2); border:1px solid var(--border); border-radius:10px; overflow:hidden; }
        .pp-card.starter { border-color:rgba(180,140,60,0.25); }
        .pp-card.pro     { border-color:rgba(180,140,60,0.45); }
        .pp-pro-band { background:rgba(180,140,60,0.07); border-bottom:1px solid rgba(180,140,60,0.18); padding:0.4rem 1.25rem; display:flex; align-items:center; gap:0.4rem; }
        .pp-pro-band-text { font-size:0.6rem; color:rgba(180,140,60,0.8); letter-spacing:0.05em; }
        .pp-card-top { padding:1.25rem 1.25rem 1rem; border-bottom:1px solid var(--border); }
        .pp-plan-badge { display:inline-flex; align-items:center; gap:0.35rem; font-size:0.58rem; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; padding:0.2rem 0.55rem; border-radius:99px; border:1px solid; margin-bottom:0.75rem; }
        .pp-price { font-family:'Cormorant Garamond',serif; font-size:clamp(2rem,5vw,2.5rem); font-weight:300; color:var(--text); line-height:1; letter-spacing:-0.02em; }
        .pp-price-period { font-size:0.7rem; color:var(--text-3); margin-left:0.2rem; font-family:'DM Sans',sans-serif; }
        .pp-tagline { font-size:0.72rem; color:var(--text-3); margin-top:0.4rem; line-height:1.5; font-weight:300; }
        .pp-card-body { padding:1rem 1.25rem 1.25rem; }
        .pp-features { list-style:none; padding:0; margin:0 0 1.125rem; display:flex; flex-direction:column; gap:0.5rem; }
        .pp-feature { display:flex; align-items:flex-start; gap:0.5rem; font-size:0.74rem; }
        .pp-feature-icon { font-size:0.62rem; flex-shrink:0; margin-top:0.15rem; width:13px; text-align:center; }
        .pp-feature-text { color:var(--text-2); line-height:1.4; }
        .pp-feature-text.off { color:var(--text-3); text-decoration:line-through; }

        .pp-cta { width:100%; padding:0.675rem; font-family:'DM Sans',sans-serif; font-size:0.78rem; font-weight:500; letter-spacing:0.04em; border:none; border-radius:7px; cursor:pointer; transition:all 0.2s; }
        .pp-cta:disabled { opacity:0.5; cursor:not-allowed; }
        .pp-cta-free    { background:transparent; border:1px solid var(--border); color:var(--text-2); }
        .pp-cta-free:hover { border-color:var(--border-hover); color:var(--text); }
        .pp-cta-starter { background:rgba(180,140,60,0.1); border:1px solid rgba(180,140,60,0.4); color:var(--gold); }
        .pp-cta-starter:hover:not(:disabled) { background:rgba(180,140,60,0.18); }
        .pp-cta-pro     { background:var(--gold); color:#0a0a0a; }
        .pp-cta-pro:hover:not(:disabled) { background:#c9a050; }

        /* Top-ups section */
        .pp-section-title { font-family:'Cormorant Garamond',serif; font-size:clamp(1.125rem,3vw,1.375rem); font-weight:300; color:var(--text); margin-bottom:0.375rem; text-align:center; }
        .pp-section-sub   { font-size:0.75rem; color:var(--text-3); text-align:center; margin-bottom:1.25rem; line-height:1.6; }

        .pp-topup-grid { display:grid; grid-template-columns:1fr; gap:0.75rem; margin-bottom:2.5rem; }
        @media(min-width:540px){ .pp-topup-grid { grid-template-columns:1fr 1fr 1fr; } }

        .pp-topup-card { background:var(--bg-2); border:1px solid var(--border); border-radius:8px; padding:1rem; display:flex; flex-direction:column; }
        .pp-topup-name  { font-size:0.8rem; font-weight:500; color:var(--text); margin-bottom:0.35rem; }
        .pp-topup-desc  { font-size:0.7rem; color:var(--text-3); line-height:1.6; margin-bottom:0.75rem; flex:1; }
        .pp-topup-footer { display:flex; align-items:center; justify-content:space-between; gap:0.5rem; flex-wrap:wrap; }
        .pp-topup-price { font-family:'Cormorant Garamond',serif; font-size:1.25rem; font-weight:300; color:var(--gold); }
        .pp-topup-btn   { padding:0.4rem 0.875rem; background:var(--gold); color:#0a0a0a; border:none; font-family:'DM Sans',sans-serif; font-size:0.7rem; font-weight:500; cursor:pointer; border-radius:5px; white-space:nowrap; transition:background 0.2s; }
        .pp-topup-btn:hover { background:#c9a050; }

        /* FAQ */
        .pp-faq-list { display:flex; flex-direction:column; gap:0.5rem; max-width:640px; margin:0 auto 2rem; }
        .pp-faq-item { background:var(--bg-2); border:1px solid var(--border); border-radius:7px; overflow:hidden; }
        .pp-faq-q { width:100%; display:flex; align-items:center; justify-content:space-between; padding:0.8rem 1rem; background:transparent; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:0.78rem; font-weight:500; color:var(--text); text-align:left; gap:1rem; transition:background 0.15s; }
        .pp-faq-q:hover { background:rgba(180,140,60,0.04); }
        .pp-faq-chevron { color:var(--text-3); font-size:0.65rem; flex-shrink:0; transition:transform 0.2s; }
        .pp-faq-a { padding:0 1rem 0.8rem; font-size:0.75rem; color:var(--text-3); line-height:1.7; font-weight:300; }

        .pp-note { text-align:center; font-size:0.7rem; color:var(--text-3); line-height:1.7; }
        .pp-note a { color:var(--gold); text-decoration:none; }

        /* ── Top-up modal ── */
        .pp-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:200; display:flex; align-items:flex-end; justify-content:center; padding:0; }
        @media(min-width:540px){ .pp-modal-overlay { align-items:center; padding:1.25rem; } }
        .pp-modal { background:var(--bg-2); border:1px solid var(--border); width:100%; max-width:440px; padding:1.5rem; border-radius:12px 12px 0 0; animation:slideUp 0.25s ease; max-height:90vh; overflow-y:auto; }
        @media(min-width:540px){ .pp-modal { border-radius:12px; } }
        @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        .pp-modal-title { font-family:'Cormorant Garamond',serif; font-size:1.25rem; font-weight:300; color:var(--text); margin-bottom:0.375rem; }
        .pp-modal-sub   { font-size:0.75rem; color:var(--text-3); line-height:1.6; margin-bottom:1.25rem; }
        .pp-modal-label { font-size:0.65rem; font-weight:500; letter-spacing:0.06em; text-transform:uppercase; color:var(--text-3); margin-bottom:0.35rem; display:block; }
        .pp-modal-select { width:100%; padding:0.6rem 0.75rem; background:var(--bg-3); border:1px solid var(--border); color:var(--text); font-family:'DM Sans',sans-serif; font-size:0.82rem; outline:none; border-radius:5px; margin-bottom:1rem; }
        .pp-modal-select:focus { border-color:var(--gold); }
        .pp-modal-select option { background:var(--bg-2); }
        .pp-modal-footer { display:flex; gap:0.625rem; flex-wrap:wrap; }
        .pp-modal-btn-gold  { flex:1; padding:0.65rem; background:var(--gold); color:#0a0a0a; border:none; font-family:'DM Sans',sans-serif; font-size:0.78rem; font-weight:500; cursor:pointer; border-radius:6px; }
        .pp-modal-btn-gold:disabled { opacity:0.5; cursor:not-allowed; }
        .pp-modal-btn-ghost { padding:0.65rem 1rem; background:transparent; border:1px solid var(--border); color:var(--text-2); font-family:'DM Sans',sans-serif; font-size:0.78rem; cursor:pointer; border-radius:6px; white-space:nowrap; }
        .pp-modal-error { font-size:0.72rem; color:#ef4444; margin-bottom:0.75rem; }
        .pp-modal-price { font-family:'Cormorant Garamond',serif; font-size:1.5rem; font-weight:300; color:var(--gold); margin-bottom:1rem; }
      `}</style>

      <div className="pp">
        <Link href="/dashboard" className="pp-back">← Dashboard</Link>

        <div className="pp-hero">
          <div className="pp-eyebrow">Plans & Pricing</div>
          <h1 className="pp-headline">Simple pricing,<br />powerful events</h1>
          <p className="pp-sub">Start free and upgrade when you need more events, vendor portals, WhatsApp and advanced tools.</p>
        </div>

        {/* Toggle */}
        <div className="pp-toggle-wrap">
          <div className="pp-toggle">
            <button className={`pp-toggle-btn${billing==="monthly"?"  on":""}`} onClick={()=>setBilling("monthly")}>Monthly</button>
            <button className={`pp-toggle-btn${billing==="per-event"?" on":""}`} onClick={()=>setBilling("per-event")}>
              Per Event <span className="pp-save-badge">Flexible</span>
            </button>
          </div>
        </div>

        {/* Plans */}
        <div className="pp-grid">

          {/* Free */}
          <div className="pp-card">
            <div className="pp-card-top">
              <div className="pp-plan-badge" style={{ color:"#6b7280", borderColor:"rgba(107,114,128,0.3)", background:"rgba(107,114,128,0.08)" }}>Free</div>
              <div><span className="pp-price">₦0</span><span className="pp-price-period">forever</span></div>
              <div className="pp-tagline">{PLANS.free.tagline}</div>
            </div>
            <div className="pp-card-body">
              <ul className="pp-features">
                {PLANS.free.features.map((f,i)=>(
                  <li className="pp-feature" key={i}>
                    <span className="pp-feature-icon" style={{ color:f.included?"#22c55e":"var(--text-3)" }}>{f.included?"✓":"–"}</span>
                    <span className={`pp-feature-text${f.included?"":" off"}`}>{f.text}</span>
                  </li>
                ))}
              </ul>
              <button className="pp-cta pp-cta-free" onClick={handleContinueFree}>Continue with Free</button>
            </div>
          </div>

          {/* Starter */}
          <div className="pp-card starter">
            <div className="pp-card-top">
              <div className="pp-plan-badge" style={{ color:"#b48c3c", borderColor:"rgba(180,140,60,0.35)", background:"rgba(180,140,60,0.08)" }}>✦ Starter</div>
              <div>
                <span className="pp-price">{billing==="monthly"?fmt(PLANS.starter.monthly):fmt(PLANS.starter.perEvent)}</span>
                <span className="pp-price-period">{billing==="monthly"?"/ month":"/ event"}</span>
              </div>
              <div className="pp-tagline">{PLANS.starter.tagline}</div>
            </div>
            <div className="pp-card-body">
              <ul className="pp-features">
                {PLANS.starter.features.map((f,i)=>(
                  <li className="pp-feature" key={i}>
                    <span className="pp-feature-icon" style={{ color:f.included?"#b48c3c":"var(--text-3)" }}>{f.included?"✓":"–"}</span>
                    <span className={`pp-feature-text${f.included?"":" off"}`}>{f.text}</span>
                  </li>
                ))}
              </ul>
              <button className="pp-cta pp-cta-starter" onClick={()=>handleUpgrade("starter")} disabled={upgrading==="starter"}>
                {upgrading==="starter"?"Redirecting…":"Get Starter →"}
              </button>
            </div>
          </div>

          {/* Pro */}
          <div className="pp-card pro">
            <div className="pp-pro-band">
              <span style={{ fontSize:"0.72rem" }}>⚡</span>
              <span className="pp-pro-band-text">Most popular for professional planners</span>
            </div>
            <div className="pp-card-top">
              <div className="pp-plan-badge" style={{ color:"#b48c3c", borderColor:"rgba(180,140,60,0.35)", background:"rgba(180,140,60,0.08)" }}>✦ Pro</div>
              <div>
                <span className="pp-price">{billing==="monthly"?fmt(PLANS.pro.monthly):fmt(PLANS.pro.perEvent)}</span>
                <span className="pp-price-period">{billing==="monthly"?"/ month":"/ event"}</span>
              </div>
              <div className="pp-tagline">{PLANS.pro.tagline}</div>
            </div>
            <div className="pp-card-body">
              <ul className="pp-features">
                {PLANS.pro.features.map((f,i)=>(
                  <li className="pp-feature" key={i}>
                    <span className="pp-feature-icon" style={{ color:"#b48c3c" }}>✓</span>
                    <span className="pp-feature-text">{f.text}</span>
                  </li>
                ))}
              </ul>
              <button className="pp-cta pp-cta-pro" onClick={()=>handleUpgrade("pro")} disabled={!!upgrading}>
                {upgrading==="pro"?"Redirecting…":"Upgrade to Pro →"}
              </button>
            </div>
          </div>

        </div>

        {/* Top-ups */}
        <div className="pp-section-title">Event top-ups</div>
        <p className="pp-section-sub">One-time add-ons for a specific event. Available on any plan — pay only when you need it.</p>
        <div className="pp-topup-grid">
          {TOPUPS.map(t => (
            <div className="pp-topup-card" key={t.type}>
              <div className="pp-topup-name">{t.name}</div>
              <div className="pp-topup-desc">{t.desc}</div>
              <div className="pp-topup-footer">
                <div className="pp-topup-price">{t.price}</div>
                <button className="pp-topup-btn" onClick={() => setTopupModal(t)}>Buy →</button>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="pp-section-title" style={{ marginBottom:"1.125rem" }}>Common questions</div>
        <div className="pp-faq-list">
          {[
            { q:"What happens when I hit 100 guests on Free?", a:"New RSVPs are paused once you reach 100 guests. Upgrade to Starter or Pro — all existing guests and data are preserved." },
            { q:"How does per-event billing work?", a:"Pay once before publishing an event. No recurring charge — only pay when you need it." },
            { q:"What's the difference between Starter and Pro?", a:"Starter gives you 3 events and 500 guests per event with vendor portals. Pro removes all limits and adds WhatsApp, CSV import, analytics, and priority support." },
            { q:"Can I buy top-ups on the Free plan?", a:"Yes. Top-ups work on any plan. Buy an Extra Guests Pack to extend a single event without upgrading your subscription." },
            { q:"What payment methods are supported?", a:"Card payments, bank transfers, and USSD via Paystack. All transactions are in Nigerian Naira (₦)." },
            { q:"Can I cancel my subscription?", a:"Yes. Cancel anytime from Settings → Billing. You'll be downgraded to Free immediately with no further charges." },
          ].map((item,i) => <FaqItem key={i} q={item.q} a={item.a} />)}
        </div>

        <p className="pp-note">
          Prices in Nigerian Naira (₦) · <a href="mailto:support@eventflowng.com">Contact support</a>
        </p>
      </div>

      {/* ── Top-up modal ── */}
      {topupModal && (
        <div className="pp-modal-overlay" onClick={() => setTopupModal(null)}>
          <div className="pp-modal" onClick={e => e.stopPropagation()}>
            <div className="pp-modal-title">{topupModal.name}</div>
            <div className="pp-modal-sub">{topupModal.desc}</div>
            <div className="pp-modal-price">{topupModal.price} · one-time</div>

            <label className="pp-modal-label">Select event</label>
            {loadingEvents ? (
              <div style={{ fontSize:"0.78rem", color:"var(--text-3)", marginBottom:"1rem" }}>Loading your events…</div>
            ) : events.length === 0 ? (
              <div style={{ fontSize:"0.78rem", color:"var(--text-3)", marginBottom:"1rem" }}>
                No published events found. Create and publish an event first.
              </div>
            ) : (
              <select className="pp-modal-select" value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}>
                <option value="">Choose an event…</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} · {new Date(ev.eventDate).toLocaleDateString("en-NG",{day:"numeric",month:"short",year:"numeric"})}
                  </option>
                ))}
              </select>
            )}

            {topupError && <div className="pp-modal-error">{topupError}</div>}

            <div className="pp-modal-footer">
              <button
                className="pp-modal-btn-gold"
                onClick={handleBuyTopup}
                disabled={buyingTopup || !selectedEvent || events.length === 0}
              >
                {buyingTopup ? "Redirecting…" : `Pay ${topupModal.price} →`}
              </button>
              <button className="pp-modal-btn-ghost" onClick={() => setTopupModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function FaqItem({ q, a }: { q:string; a:string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="pp-faq-item">
      <button className="pp-faq-q" onClick={() => setOpen(p => !p)}>
        {q}
        <span className="pp-faq-chevron" style={{ transform:open?"rotate(180deg)":"none" }}>▾</span>
      </button>
      {open && <div className="pp-faq-a">{a}</div>}
    </div>
  )
}
