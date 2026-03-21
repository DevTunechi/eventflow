"use client"
// src/app/(dashboard)/pricing/page.tsx
// Pricing page with Starter tier + Paystack integration

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Cookies from "js-cookie"

type BillingMode = "monthly" | "per-event"

const PLANS = {
  free: {
    name:     "Free",
    tagline:  "Get started at no cost",
    monthly:  0,
    perEvent: 0,
    color:    "#6b7280",
    features: [
      { text: "1 active event",                    included: true  },
      { text: "Up to 100 guests per event",         included: true  },
      { text: "Email invitations",                  included: true  },
      { text: "OTP phone verification",             included: true  },
      { text: "RSVP management",                    included: true  },
      { text: "Basic check-in (QR scan)",           included: true  },
      { text: "Guest tiers",                        included: true  },
      { text: "Vendor portals",                     included: false },
      { text: "WhatsApp invites",                   included: false },
      { text: "Unlimited guests",                   included: false },
      { text: "Multiple active events",             included: false },
      { text: "CSV & Google Sheets import",         included: false },
      { text: "Analytics & reports",                included: false },
      { text: "Priority support",                   included: false },
    ],
  },
  starter: {
    name:     "Starter",
    tagline:  "For growing event planners",
    monthly:  5000,
    perEvent: 3000,
    color:    "#b48c3c",
    features: [
      { text: "3 active events",                    included: true  },
      { text: "Up to 500 guests per event",         included: true  },
      { text: "Email invitations",                  included: true  },
      { text: "OTP phone verification",             included: true  },
      { text: "RSVP management",                    included: true  },
      { text: "Advanced check-in (QR scan)",        included: true  },
      { text: "Guest tiers",                        included: true  },
      { text: "Vendor portals",                     included: true  },
      { text: "WhatsApp invites",                   included: false },
      { text: "Unlimited guests",                   included: false },
      { text: "Multiple active events",             included: false },
      { text: "CSV & Google Sheets import",         included: false },
      { text: "Analytics & reports",                included: false },
      { text: "Priority support",                   included: false },
    ],
  },
  pro: {
    name:     "Pro",
    tagline:  "For professional event planners",
    monthly:  15000,
    perEvent: 8000,
    color:    "#b48c3c",
    features: [
      { text: "Unlimited active events",            included: true },
      { text: "Unlimited guests per event",         included: true },
      { text: "Email invitations",                  included: true },
      { text: "OTP phone verification",             included: true },
      { text: "RSVP management",                    included: true },
      { text: "Advanced check-in (QR scan)",        included: true },
      { text: "Guest tiers",                        included: true },
      { text: "Vendor portals",                     included: true },
      { text: "WhatsApp invites",                   included: true },
      { text: "Unlimited guests",                   included: true },
      { text: "Multiple active events",             included: true },
      { text: "CSV & Google Sheets import",         included: true },
      { text: "Analytics & reports",                included: true },
      { text: "Priority support",                   included: true },
    ],
  },
}

const TOPUPS = [
  { name:"Extra Guests Pack",        desc:"+200 guests added to one event. Stackable.",                price:"₦2,000" },
  { name:"WhatsApp QR Delivery",     desc:"Send QR codes via WhatsApp to all confirmed guests.",       price:"₦1,500" },
  { name:"Priority Check-in Tools",  desc:"Multi-usher dashboard, live alerts and check-in analytics.", price:"₦2,500" },
]

const fmt = (n: number) =>
  n === 0 ? "₦0" : `₦${n.toLocaleString("en-NG")}`

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("ef-session") ?? ""
    : ""
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function PricingPage() {
  const [billing,   setBilling]   = useState<BillingMode>("monthly")
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const router = useRouter()

  const handleContinueFree = () => {
    Cookies.set("ef-plan", "free-acknowledged", { expires: 365 })
    router.push("/dashboard")
  }

  const handleUpgrade = async (plan: "starter" | "pro") => {
    setUpgrading(plan)
    try {
      const res = await fetch("/api/payments/subscribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify({ plan }),
      })
      const d = await res.json()
      if (d.authorizationUrl) {
        window.location.href = d.authorizationUrl
      } else {
        alert(d.error ?? "Something went wrong. Please try again.")
      }
    } catch {
      alert("Network error. Please try again.")
    } finally {
      setUpgrading(null)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .pp { max-width: 960px; margin: 0 auto; padding: 2rem 1.25rem 5rem; animation: ppIn 0.35s ease; overflow-x: hidden; }
        @media(min-width:600px){ .pp { padding: 2rem 1.5rem 5rem; } }
        @keyframes ppIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }

        .pp-back { font-size:0.78rem; color:var(--text-3); text-decoration:none; display:inline-flex; align-items:center; gap:0.35rem; transition:color 0.2s; margin-bottom:2rem; }
        .pp-back:hover { color:var(--gold); }

        .pp-hero { text-align:center; margin-bottom:2.5rem; }
        .pp-eyebrow { font-size:0.6rem; font-weight:500; letter-spacing:0.25em; text-transform:uppercase; color:var(--gold); margin-bottom:0.75rem; }
        .pp-headline { font-family:'Cormorant Garamond',serif; font-size:clamp(2rem,5vw,3.25rem); font-weight:300; color:var(--text); line-height:1.1; letter-spacing:-0.02em; margin-bottom:0.875rem; }
        .pp-sub { font-size:0.875rem; color:var(--text-3); max-width:480px; margin:0 auto; line-height:1.7; font-weight:300; }

        .pp-toggle-wrap { display:flex; justify-content:center; margin-bottom:2.5rem; }
        .pp-toggle { display:flex; background:var(--bg-2); border:1px solid var(--border); border-radius:8px; padding:3px; gap:3px; }
        .pp-toggle-btn { padding:0.45rem 1.125rem; font-family:'DM Sans',sans-serif; font-size:0.75rem; letter-spacing:0.04em; border:none; border-radius:6px; cursor:pointer; transition:all 0.2s; color:var(--text-3); background:transparent; }
        .pp-toggle-btn.on { background:var(--gold); color:#0a0a0a; font-weight:500; }
        .pp-save-badge { font-size:0.58rem; font-weight:500; letter-spacing:0.06em; text-transform:uppercase; padding:0.15rem 0.45rem; border-radius:99px; background:rgba(34,197,94,0.12); border:1px solid rgba(34,197,94,0.3); color:#22c55e; margin-left:0.5rem; vertical-align:middle; }

        /* 3-column on desktop, 1-column on mobile */
        .pp-grid { display:grid; grid-template-columns:1fr; gap:1rem; align-items:start; }
        @media(min-width:640px){ .pp-grid { grid-template-columns:1fr 1fr; } }
        @media(min-width:900px){ .pp-grid { grid-template-columns:1fr 1fr 1fr; } }

        .pp-card { background:var(--bg-2); border:1px solid var(--border); border-radius:10px; overflow:hidden; transition:border-color 0.2s; }
        .pp-card.starter { border-color:rgba(180,140,60,0.25); }
        .pp-card.pro     { border-color:rgba(180,140,60,0.45); }
        .pp-card-top { padding:1.375rem 1.375rem 1.125rem; border-bottom:1px solid var(--border); }
        .pp-plan-badge { display:inline-flex; align-items:center; gap:0.375rem; font-size:0.6rem; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; padding:0.2rem 0.625rem; border-radius:99px; border:1px solid; margin-bottom:0.875rem; }
        .pp-price-wrap { margin-bottom:0.5rem; }
        .pp-price { font-family:'Cormorant Garamond',serif; font-size:2.5rem; font-weight:300; color:var(--text); line-height:1; letter-spacing:-0.02em; }
        .pp-price-period { font-size:0.72rem; color:var(--text-3); margin-left:0.25rem; font-family:'DM Sans',sans-serif; }
        .pp-tagline { font-size:0.75rem; color:var(--text-3); line-height:1.5; font-weight:300; }

        .pp-card-body { padding:1.125rem 1.375rem 1.375rem; }
        .pp-features { list-style:none; padding:0; margin:0 0 1.25rem; display:flex; flex-direction:column; gap:0.55rem; }
        .pp-feature { display:flex; align-items:flex-start; gap:0.55rem; font-size:0.76rem; }
        .pp-feature-icon { font-size:0.65rem; flex-shrink:0; margin-top:0.15rem; width:14px; text-align:center; }
        .pp-feature-text { color:var(--text-2); line-height:1.4; }
        .pp-feature-text.off { color:var(--text-3); text-decoration:line-through; }

        .pp-cta { width:100%; padding:0.7rem; font-family:'DM Sans',sans-serif; font-size:0.8rem; font-weight:500; letter-spacing:0.04em; border:none; border-radius:7px; cursor:pointer; transition:all 0.2s; }
        .pp-cta:disabled { opacity:0.5; cursor:not-allowed; }
        .pp-cta-free    { background:transparent; border:1px solid var(--border); color:var(--text-2); }
        .pp-cta-free:hover { border-color:var(--border-hover); color:var(--text); }
        .pp-cta-starter { background:rgba(180,140,60,0.12); border:1px solid rgba(180,140,60,0.4); color:var(--gold); }
        .pp-cta-starter:hover:not(:disabled) { background:rgba(180,140,60,0.2); }
        .pp-cta-pro     { background:var(--gold); color:#0a0a0a; }
        .pp-cta-pro:hover:not(:disabled) { background:#c9a050; }

        .pp-pro-band { background:rgba(180,140,60,0.07); border-bottom:1px solid rgba(180,140,60,0.18); padding:0.45rem 1.375rem; display:flex; align-items:center; gap:0.5rem; }
        .pp-pro-band-text { font-size:0.62rem; color:rgba(180,140,60,0.8); letter-spacing:0.05em; }

        /* Top-ups section */
        .pp-topups { margin-top:2.5rem; }
        .pp-section-title { font-family:'Cormorant Garamond',serif; font-size:1.375rem; font-weight:300; color:var(--text); margin-bottom:0.375rem; text-align:center; }
        .pp-section-sub { font-size:0.78rem; color:var(--text-3); text-align:center; margin-bottom:1.5rem; line-height:1.6; }
        .pp-topup-grid { display:grid; grid-template-columns:1fr; gap:0.75rem; }
        @media(min-width:540px){ .pp-topup-grid { grid-template-columns:1fr 1fr 1fr; } }
        .pp-topup-card { background:var(--bg-2); border:1px solid var(--border); border-radius:8px; padding:1.125rem; }
        .pp-topup-name  { font-size:0.82rem; font-weight:500; color:var(--text); margin-bottom:0.35rem; }
        .pp-topup-desc  { font-size:0.72rem; color:var(--text-3); line-height:1.6; margin-bottom:0.75rem; }
        .pp-topup-price { font-family:'Cormorant Garamond',serif; font-size:1.375rem; font-weight:300; color:var(--gold); }
        .pp-topup-note  { font-size:0.65rem; color:var(--text-3); margin-top:0.2rem; }

        /* FAQ */
        .pp-faq { margin-top:3rem; }
        .pp-faq-list { display:flex; flex-direction:column; gap:0.625rem; max-width:640px; margin:0 auto; }
        .pp-faq-item { background:var(--bg-2); border:1px solid var(--border); border-radius:7px; overflow:hidden; }
        .pp-faq-q { width:100%; display:flex; align-items:center; justify-content:space-between; padding:0.875rem 1.125rem; background:transparent; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:0.8rem; font-weight:500; color:var(--text); text-align:left; gap:1rem; transition:background 0.15s; }
        .pp-faq-q:hover { background:rgba(180,140,60,0.04); }
        .pp-faq-chevron { color:var(--text-3); font-size:0.7rem; flex-shrink:0; transition:transform 0.2s; }
        .pp-faq-a { padding:0 1.125rem 0.875rem; font-size:0.78rem; color:var(--text-3); line-height:1.7; font-weight:300; }

        .pp-note { margin-top:2.5rem; text-align:center; font-size:0.72rem; color:var(--text-3); line-height:1.7; }
        .pp-note a { color:var(--gold); text-decoration:none; }
        .pp-note a:hover { text-decoration:underline; }
      `}</style>

      <div className="pp">
        <Link href="/dashboard" className="pp-back">← Dashboard</Link>

        <div className="pp-hero">
          <div className="pp-eyebrow">Plans & Pricing</div>
          <h1 className="pp-headline">Simple pricing,<br />powerful events</h1>
          <p className="pp-sub">
            Start free and upgrade when you need more events,
            vendor portals, WhatsApp invites, and advanced tools.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="pp-toggle-wrap">
          <div className="pp-toggle">
            <button className={`pp-toggle-btn${billing === "monthly" ? " on" : ""}`} onClick={() => setBilling("monthly")}>
              Monthly
            </button>
            <button className={`pp-toggle-btn${billing === "per-event" ? " on" : ""}`} onClick={() => setBilling("per-event")}>
              Per Event
              <span className="pp-save-badge">Flexible</span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="pp-grid">

          {/* Free */}
          <div className="pp-card">
            <div className="pp-card-top">
              <div className="pp-plan-badge" style={{ color:"#6b7280", borderColor:"rgba(107,114,128,0.3)", background:"rgba(107,114,128,0.08)" }}>
                Free
              </div>
              <div className="pp-price-wrap">
                <span className="pp-price">₦0</span>
                <span className="pp-price-period">forever</span>
              </div>
              <p className="pp-tagline">{PLANS.free.tagline}</p>
            </div>
            <div className="pp-card-body">
              <ul className="pp-features">
                {PLANS.free.features.map((f, i) => (
                  <li className="pp-feature" key={i}>
                    <span className="pp-feature-icon" style={{ color: f.included ? "#22c55e" : "var(--text-3)" }}>{f.included ? "✓" : "–"}</span>
                    <span className={`pp-feature-text${f.included ? "" : " off"}`}>{f.text}</span>
                  </li>
                ))}
              </ul>
              <button className="pp-cta pp-cta-free" onClick={handleContinueFree}>
                Continue with Free
              </button>
            </div>
          </div>

          {/* Starter */}
          <div className="pp-card starter">
            <div className="pp-card-top">
              <div className="pp-plan-badge" style={{ color:"#b48c3c", borderColor:"rgba(180,140,60,0.35)", background:"rgba(180,140,60,0.08)" }}>
                ✦ Starter
              </div>
              <div className="pp-price-wrap">
                <span className="pp-price">
                  {billing === "monthly" ? fmt(PLANS.starter.monthly) : fmt(PLANS.starter.perEvent)}
                </span>
                <span className="pp-price-period">
                  {billing === "monthly" ? "/ month" : "/ event"}
                </span>
              </div>
              <p className="pp-tagline">{PLANS.starter.tagline}</p>
            </div>
            <div className="pp-card-body">
              <ul className="pp-features">
                {PLANS.starter.features.map((f, i) => (
                  <li className="pp-feature" key={i}>
                    <span className="pp-feature-icon" style={{ color: f.included ? "#b48c3c" : "var(--text-3)" }}>{f.included ? "✓" : "–"}</span>
                    <span className={`pp-feature-text${f.included ? "" : " off"}`}>{f.text}</span>
                  </li>
                ))}
              </ul>
              <button
                className="pp-cta pp-cta-starter"
                onClick={() => handleUpgrade("starter")}
                disabled={upgrading === "starter"}
              >
                {upgrading === "starter" ? "Redirecting…" : "Get Starter →"}
              </button>
            </div>
          </div>

          {/* Pro */}
          <div className="pp-card pro">
            <div className="pp-pro-band">
              <span style={{ fontSize:"0.75rem" }}>⚡</span>
              <span className="pp-pro-band-text">Most popular for professional planners</span>
            </div>
            <div className="pp-card-top">
              <div className="pp-plan-badge" style={{ color:"#b48c3c", borderColor:"rgba(180,140,60,0.35)", background:"rgba(180,140,60,0.08)" }}>
                ✦ Pro
              </div>
              <div className="pp-price-wrap">
                <span className="pp-price">
                  {billing === "monthly" ? fmt(PLANS.pro.monthly) : fmt(PLANS.pro.perEvent)}
                </span>
                <span className="pp-price-period">
                  {billing === "monthly" ? "/ month" : "/ event"}
                </span>
              </div>
              <p className="pp-tagline">{PLANS.pro.tagline}</p>
            </div>
            <div className="pp-card-body">
              <ul className="pp-features">
                {PLANS.pro.features.map((f, i) => (
                  <li className="pp-feature" key={i}>
                    <span className="pp-feature-icon" style={{ color:"#b48c3c" }}>✓</span>
                    <span className="pp-feature-text">{f.text}</span>
                  </li>
                ))}
              </ul>
              <button
                className="pp-cta pp-cta-pro"
                onClick={() => handleUpgrade("pro")}
                disabled={!!upgrading}
              >
                {upgrading === "pro" ? "Redirecting…" : "Upgrade to Pro →"}
              </button>
            </div>
          </div>

        </div>

        {/* Top-ups */}
        <div className="pp-topups">
          <div className="pp-section-title">Event top-ups</div>
          <p className="pp-section-sub">
            One-time add-ons for a specific event. Available on any plan — pay only when you need it.
          </p>
          <div className="pp-topup-grid">
            {TOPUPS.map(t => (
              <div className="pp-topup-card" key={t.name}>
                <div className="pp-topup-name">{t.name}</div>
                <div className="pp-topup-desc">{t.desc}</div>
                <div className="pp-topup-price">{t.price}</div>
                <div className="pp-topup-note">Per event · one-time charge</div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="pp-faq">
          <div className="pp-section-title" style={{ marginBottom:"1.25rem" }}>Common questions</div>
          <div className="pp-faq-list">
            {[
              { q:"What happens when I hit 100 guests on Free?", a:"Once your event reaches 100 guests, new RSVPs are paused. Upgrade to Starter or Pro at any time — all existing guests and data are preserved." },
              { q:"How does per-event billing work?", a:"You pay once per event before publishing. The event stays active until it's marked Completed or Cancelled. No recurring charge — only pay when you need it." },
              { q:"What's included in Starter vs Pro?", a:"Starter gives you 3 events and 500 guests per event with vendor portals. Pro removes all limits and adds WhatsApp, CSV import, analytics, and priority support." },
              { q:"Can I buy top-ups on the Free plan?", a:"Yes. Top-ups work on any plan. If you need more guests for a specific event, buy an Extra Guests Pack without upgrading your subscription." },
              { q:"What payment methods are supported?", a:"We accept card payments, bank transfers, and USSD via Paystack. All transactions are in Nigerian Naira (₦)." },
              { q:"Can I cancel my subscription?", a:"Yes. Cancel anytime from your billing settings. You'll be downgraded to Free immediately with no further charges." },
            ].map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} />
            ))}
          </div>
        </div>

        <p className="pp-note">
          Prices are in Nigerian Naira (₦) and exclude applicable taxes.<br />
          Questions? <a href="mailto:support@eventflowng.com">Contact support</a>
        </p>
      </div>
    </>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="pp-faq-item">
      <button className="pp-faq-q" onClick={() => setOpen(p => !p)}>
        {q}
        <span className="pp-faq-chevron" style={{ transform: open ? "rotate(180deg)" : "none" }}>▾</span>
      </button>
      {open && <div className="pp-faq-a">{a}</div>}
    </div>
  )
}
