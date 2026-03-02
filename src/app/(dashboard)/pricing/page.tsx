"use client"

// ─────────────────────────────────────────────
// src/app/(dashboard)/pricing/page.tsx
//
// Free vs Pro pricing page.
// Billing: monthly subscription OR per-event.
// Payment: Paystack (NGN).
// ─────────────────────────────────────────────

import { useState } from "react"
import Link from "next/link"

type BillingMode = "monthly" | "per-event"

const PLANS = {
  free: {
    name:        "Free",
    tagline:     "Get started at no cost",
    monthly:     0,
    perEvent:    0,
    color:       "#6b7280",
    features: [
      { text: "1 active event",                    included: true  },
      { text: "Up to 100 guests per event",         included: true  },
      { text: "Email invitations",                  included: true  },
      { text: "OTP phone verification",             included: true  },
      { text: "RSVP management",                    included: true  },
      { text: "Basic check-in (QR scan)",           included: true  },
      { text: "Guest tiers",                        included: true  },
      { text: "WhatsApp invites",                   included: false },
      { text: "Unlimited guests",                   included: false },
      { text: "Multiple active events",             included: false },
      { text: "CSV & Google Sheets import",         included: false },
      { text: "Analytics & reports",                included: false },
      { text: "Priority support",                   included: false },
    ],
  },
  pro: {
    name:        "Pro",
    tagline:     "For professional event planners",
    monthly:     15000,
    perEvent:    8000,
    color:       "#b48c3c",
    features: [
      { text: "Unlimited active events",            included: true },
      { text: "Unlimited guests per event",         included: true },
      { text: "Email invitations",                  included: true },
      { text: "OTP phone verification",             included: true },
      { text: "RSVP management",                    included: true },
      { text: "Advanced check-in (QR scan)",        included: true },
      { text: "Guest tiers",                        included: true },
      { text: "WhatsApp invites",                   included: true },
      { text: "Unlimited guests",                   included: true },
      { text: "Multiple active events",             included: true },
      { text: "CSV & Google Sheets import",         included: true },
      { text: "Analytics & reports",                included: true },
      { text: "Priority support",                   included: true },
    ],
  },
}

const fmt = (n: number) =>
  n === 0 ? "Free" : `₦${n.toLocaleString("en-NG")}`

export default function PricingPage() {
  const [billing, setBilling] = useState<BillingMode>("monthly")

  const handleUpgrade = () => {
    // TODO: initialise Paystack transaction
    // const handler = PaystackPop.setup({ key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY, ... })
    // handler.openIframe()
    alert("Paystack integration coming soon.")
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        .pp { max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem 5rem; animation: ppIn 0.35s ease; }
        @keyframes ppIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }

        /* ── Top nav ── */
        .pp-back { font-size:0.78rem; color:var(--text-3); text-decoration:none; display:inline-flex; align-items:center; gap:0.35rem; transition:color 0.2s; margin-bottom:2rem; }
        .pp-back:hover { color:var(--gold); }

        /* ── Hero ── */
        .pp-hero { text-align:center; margin-bottom:2.5rem; }
        .pp-eyebrow { font-size:0.6rem; font-weight:500; letter-spacing:0.25em; text-transform:uppercase; color:var(--gold); margin-bottom:0.75rem; }
        .pp-headline { font-family:'Cormorant Garamond',serif; font-size:clamp(2rem,5vw,3.25rem); font-weight:300; color:var(--text); line-height:1.1; letter-spacing:-0.02em; margin-bottom:0.875rem; }
        .pp-sub { font-size:0.875rem; color:var(--text-3); max-width:480px; margin:0 auto; line-height:1.7; font-weight:300; }

        /* ── Billing toggle ── */
        .pp-toggle-wrap { display:flex; justify-content:center; margin-bottom:2.5rem; }
        .pp-toggle { display:flex; background:var(--bg-2); border:1px solid var(--border); border-radius:8px; padding:3px; gap:3px; }
        .pp-toggle-btn { padding:0.45rem 1.125rem; font-family:'DM Sans',sans-serif; font-size:0.75rem; letter-spacing:0.04em; border:none; border-radius:6px; cursor:pointer; transition:all 0.2s; color:var(--text-3); background:transparent; }
        .pp-toggle-btn.on { background:var(--gold); color:#0a0a0a; font-weight:500; }
        .pp-save-badge { font-size:0.58rem; font-weight:500; letter-spacing:0.06em; text-transform:uppercase; padding:0.15rem 0.45rem; border-radius:99px; background:rgba(34,197,94,0.12); border:1px solid rgba(34,197,94,0.3); color:#22c55e; margin-left:0.5rem; vertical-align:middle; }

        /* ── Cards grid ── */
        .pp-grid { display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; align-items:start; }
        @media(max-width:640px) { .pp-grid { grid-template-columns:1fr; } }

        /* ── Plan card ── */
        .pp-card { background:var(--bg-2); border:1px solid var(--border); border-radius:10px; overflow:hidden; transition:border-color 0.2s; }
        .pp-card.pro { border-color:rgba(180,140,60,0.4); }
        .pp-card-top { padding:1.5rem 1.5rem 1.25rem; border-bottom:1px solid var(--border); }
        .pp-plan-badge { display:inline-flex; align-items:center; gap:0.375rem; font-size:0.6rem; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; padding:0.2rem 0.625rem; border-radius:99px; border:1px solid; margin-bottom:0.875rem; }
        .pp-price-wrap { margin-bottom:0.5rem; }
        .pp-price { font-family:'Cormorant Garamond',serif; font-size:2.75rem; font-weight:300; color:var(--text); line-height:1; letter-spacing:-0.02em; }
        .pp-price-period { font-size:0.72rem; color:var(--text-3); margin-left:0.25rem; font-family:'DM Sans',sans-serif; }
        .pp-tagline { font-size:0.78rem; color:var(--text-3); line-height:1.5; font-weight:300; }

        .pp-card-body { padding:1.25rem 1.5rem 1.5rem; }
        .pp-features { list-style:none; padding:0; margin:0 0 1.375rem; display:flex; flex-direction:column; gap:0.625rem; }
        .pp-feature { display:flex; align-items:flex-start; gap:0.625rem; font-size:0.78rem; }
        .pp-feature-icon { font-size:0.7rem; flex-shrink:0; margin-top:0.1rem; width:14px; text-align:center; }
        .pp-feature-text { color:var(--text-2); line-height:1.4; }
        .pp-feature-text.off { color:var(--text-3); text-decoration:line-through; }

        /* ── CTA buttons ── */
        .pp-cta { width:100%; padding:0.75rem; font-family:'DM Sans',sans-serif; font-size:0.82rem; font-weight:500; letter-spacing:0.04em; border:none; border-radius:7px; cursor:pointer; transition:all 0.2s; }
        .pp-cta-free { background:transparent; border:1px solid var(--border); color:var(--text-2); }
        .pp-cta-free:hover { border-color:var(--border-hover); color:var(--text); }
        .pp-cta-pro { background:var(--gold); color:#0a0a0a; }
        .pp-cta-pro:hover { background:#c9a050; }

        /* ── Pro highlight band ── */
        .pp-pro-band { background:rgba(180,140,60,0.07); border-bottom:1px solid rgba(180,140,60,0.18); padding:0.5rem 1.5rem; display:flex; align-items:center; gap:0.5rem; }
        .pp-pro-band-text { font-size:0.65rem; color:rgba(180,140,60,0.8); letter-spacing:0.05em; }

        /* ── FAQ ── */
        .pp-faq { margin-top:3rem; }
        .pp-faq-title { font-family:'Cormorant Garamond',serif; font-size:1.375rem; font-weight:300; color:var(--text); margin-bottom:1.25rem; text-align:center; }
        .pp-faq-list { display:flex; flex-direction:column; gap:0.625rem; max-width:620px; margin:0 auto; }
        .pp-faq-item { background:var(--bg-2); border:1px solid var(--border); border-radius:7px; overflow:hidden; }
        .pp-faq-q { width:100%; display:flex; align-items:center; justify-content:space-between; padding:0.875rem 1.125rem; background:transparent; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:0.8rem; font-weight:500; color:var(--text); text-align:left; gap:1rem; transition:background 0.15s; }
        .pp-faq-q:hover { background:rgba(180,140,60,0.04); }
        .pp-faq-chevron { color:var(--text-3); font-size:0.7rem; flex-shrink:0; transition:transform 0.2s; }
        .pp-faq-a { padding:0 1.125rem 0.875rem; font-size:0.78rem; color:var(--text-3); line-height:1.7; font-weight:300; }

        /* ── Note ── */
        .pp-note { margin-top:2rem; text-align:center; font-size:0.72rem; color:var(--text-3); line-height:1.7; }
        .pp-note a { color:var(--gold); text-decoration:none; }
        .pp-note a:hover { text-decoration:underline; }
      `}</style>

      <div className="pp">
        <Link href="/dashboard" className="pp-back">← Dashboard</Link>

        {/* Hero */}
        <div className="pp-hero">
          <div className="pp-eyebrow">Plans & Pricing</div>
          <h1 className="pp-headline">Simple pricing,<br />powerful events</h1>
          <p className="pp-sub">
            Start free and upgrade when you need WhatsApp invites,
            more guests, and advanced tools.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="pp-toggle-wrap">
          <div className="pp-toggle">
            <button
              className={`pp-toggle-btn${billing === "monthly" ? " on" : ""}`}
              onClick={() => setBilling("monthly")}
            >
              Monthly
            </button>
            <button
              className={`pp-toggle-btn${billing === "per-event" ? " on" : ""}`}
              onClick={() => setBilling("per-event")}
            >
              Per Event
              <span className="pp-save-badge">Flexible</span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="pp-grid">

          {/* ── Free ── */}
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
                    <span className="pp-feature-icon">{f.included ? "✓" : "–"}</span>
                    <span className={`pp-feature-text${f.included ? "" : " off"}`}>{f.text}</span>
                  </li>
                ))}
              </ul>
              <button className="pp-cta pp-cta-free" disabled>Current plan</button>
            </div>
          </div>

          {/* ── Pro ── */}
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
              <button className="pp-cta pp-cta-pro" onClick={handleUpgrade}>
                Upgrade to Pro →
              </button>
            </div>
          </div>

        </div>

        {/* FAQ */}
        <div className="pp-faq">
          <div className="pp-faq-title">Common questions</div>
          <div className="pp-faq-list">
            {[
              {
                q: "What happens when I hit 100 guests on Free?",
                a: "Once your event reaches 100 guests, new RSVP registrations are paused. You can upgrade to Pro at any time to remove the limit — all existing guests and data are preserved.",
              },
              {
                q: "How does per-event billing work?",
                a: "You pay once per event before sending invites. The event stays active until it's marked Completed or Cancelled. There's no recurring charge — only pay when you need it.",
              },
              {
                q: "Is WhatsApp available on Free?",
                a: "WhatsApp invites are a Pro-only feature. Free plan events can use email invitations and OTP verification at no cost.",
              },
              {
                q: "Can I switch between monthly and per-event?",
                a: "Yes. Monthly is better if you run multiple events per month. Per-event billing is ideal for occasional planners who only need Pro features for specific events.",
              },
              {
                q: "What payment methods are supported?",
                a: "We accept card payments, bank transfers, and USSD via Paystack. All transactions are in Nigerian Naira (₦).",
              },
            ].map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} />
            ))}
          </div>
        </div>

        {/* Note */}
        <p className="pp-note">
          Prices are in Nigerian Naira (₦) and exclude applicable taxes.<br />
          Questions? <a href="mailto:support@eventflow.app">Contact support</a>
        </p>

      </div>
    </>
  )
}

// ── FAQ accordion item ────────────────────────
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
