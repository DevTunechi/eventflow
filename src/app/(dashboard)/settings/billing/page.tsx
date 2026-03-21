"use client"
// src/app/(dashboard)/settings/billing/page.tsx
// Planner billing — current plan, top-ups, upgrade/cancel

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

interface BillingData {
  plan:            string
  planExpiresAt:   string | null
  subscription:    {
    status:         string
    nextBillingDate: string | null
    amount:         number
  } | null
}

const PLANS = {
  free:    { name:"Free",    price:"₦0",         color:"#6b7280" },
  starter: { name:"Starter", price:"₦5,000/mo",  color:"#b48c3c" },
  pro:     { name:"Pro",     price:"₦15,000/mo", color:"#b48c3c" },
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("ef-session") ?? ""
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function BillingPage() {
  const searchParams = useSearchParams()
  const paymentStatus = searchParams.get("status")
  const paymentPlan   = searchParams.get("plan")
  const paymentType   = searchParams.get("type")

  const [billing,   setBilling]   = useState<BillingData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [cancelling,setCancelling]= useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/payments/billing", { headers: getAuthHeaders() })
        if (res.ok) setBilling(await res.json())
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

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
      }
    } catch { /* silent */ }
    finally { setUpgrading(null) }
  }

  const handleCancel = async () => {
    if (!confirm("Cancel your subscription? You'll be downgraded to Free immediately.")) return
    setCancelling(true)
    try {
      await fetch("/api/payments/cancel", {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      })
      window.location.reload()
    } catch { /* silent */ }
    finally { setCancelling(false) }
  }

  const currentPlan = billing?.plan ?? "free"
  const planInfo    = PLANS[currentPlan as keyof typeof PLANS] ?? PLANS.free

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .bl { max-width: 700px; margin: 0 auto; padding: 1.5rem 1.25rem 4rem; font-family: 'DM Sans', sans-serif; overflow-x: hidden; }
        @media(min-width:600px){ .bl { padding: 2rem 1.5rem 4rem; } }
        .bl-back { font-size: 0.78rem; color: var(--text-3); text-decoration: none; display: flex; align-items: center; gap: 0.35rem; margin-bottom: 1.5rem; transition: color 0.2s; }
        .bl-back:hover { color: var(--gold); }
        .bl-heading { font-family: 'Cormorant Garamond', serif; font-size: clamp(1.375rem,4vw,1.75rem); font-weight: 300; color: var(--text); margin-bottom: 1.5rem; }
        .bl-card { background: var(--bg-2); border: 1px solid var(--border); padding: 1.25rem; margin-bottom: 1rem; }
        .bl-card-title { font-size: 0.6rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.75rem; }
        .bl-card-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }
        .bl-plan-badge { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.875rem; border: 1px solid; border-radius: 99px; font-size: 0.72rem; font-weight: 500; letter-spacing: 0.04em; margin-bottom: 0.75rem; }
        .bl-billing-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; padding: 0.5rem 0; border-bottom: 1px solid var(--border); gap: 1rem; }
        .bl-billing-row:last-child { border-bottom: none; }
        .bl-billing-key { color: var(--text-3); }
        .bl-billing-val { color: var(--text); font-weight: 500; }
        .bl-plans { display: flex; flex-direction: column; gap: 0.75rem; }
        @media(min-width:540px){ .bl-plans { flex-direction: row; } }
        .bl-plan-option { flex: 1; border: 1.5px solid var(--border); padding: 1.125rem; position: relative; min-width: 0; }
        .bl-plan-option.current { border-color: var(--gold); background: var(--gold-dim); }
        .bl-plan-option.popular::before { content: 'Most popular'; position: absolute; top: -10px; left: 50%; transform: translateX(-50%); font-size: 0.55rem; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; background: var(--gold); color: #0a0a0a; padding: 0.15rem 0.625rem; border-radius: 99px; white-space: nowrap; }
        .bl-plan-name  { font-size: 0.7rem; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gold); margin-bottom: 0.375rem; }
        .bl-plan-price { font-family: 'Cormorant Garamond', serif; font-size: 1.5rem; font-weight: 300; color: var(--text); margin-bottom: 0.625rem; }
        .bl-plan-features { list-style: none; margin-bottom: 1rem; }
        .bl-plan-features li { font-size: 0.72rem; color: var(--text-2); padding: 0.2rem 0; display: flex; align-items: center; gap: 0.5rem; }
        .bl-plan-features li::before { content: '✓'; color: var(--gold); font-size: 0.65rem; flex-shrink: 0; }
        .bl-btn-gold  { width: 100%; padding: 0.625rem; background: var(--gold); color: #0a0a0a; border: none; font-family: 'DM Sans', sans-serif; font-size: 0.75rem; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .bl-btn-gold:disabled { opacity: 0.5; cursor: not-allowed; }
        .bl-btn-ghost { width: 100%; padding: 0.625rem; background: transparent; border: 1px solid var(--border); color: var(--text-3); font-family: 'DM Sans', sans-serif; font-size: 0.72rem; cursor: pointer; transition: all 0.2s; margin-top: 0.5rem; }
        .bl-btn-ghost:hover { border-color: var(--border-hover); color: var(--text); }
        .bl-current-label { width: 100%; padding: 0.625rem; border: 1px solid var(--gold); color: var(--gold); font-family: 'DM Sans', sans-serif; font-size: 0.72rem; text-align: center; background: transparent; letter-spacing: 0.05em; }
        .bl-topups { display: flex; flex-direction: column; gap: 0.625rem; }
        .bl-topup  { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.875rem 1rem; background: var(--bg-3); border: 1px solid var(--border); min-width: 0; flex-wrap: wrap; }
        .bl-topup-name  { font-size: 0.82rem; font-weight: 500; color: var(--text); margin-bottom: 0.15rem; }
        .bl-topup-desc  { font-size: 0.7rem; color: var(--text-3); line-height: 1.5; }
        .bl-topup-price { font-family: 'Cormorant Garamond', serif; font-size: 1.125rem; font-weight: 300; color: var(--gold); flex-shrink: 0; }
        .bl-alert { padding: 0.75rem 1rem; border-radius: 0; font-size: 0.78rem; margin-bottom: 1rem; line-height: 1.5; }
        .bl-alert-success { background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.25); color: #22c55e; }
        .bl-alert-error   { background: rgba(239,68,68,0.08);  border: 1px solid rgba(239,68,68,0.25);  color: #ef4444; }
      `}</style>

      <div className="bl">
        <Link href="/dashboard" className="bl-back">← Dashboard</Link>
        <h1 className="bl-heading">Billing & Plans</h1>

        {/* Payment status alerts */}
        {paymentStatus === "success" && (
          <div className="bl-alert bl-alert-success">
            ✓ {paymentPlan ? `You're now on the ${paymentPlan} plan.` : paymentType ? `${paymentType} top-up activated successfully.` : "Payment successful."}
          </div>
        )}
        {paymentStatus === "failed" && (
          <div className="bl-alert bl-alert-error">Payment was not completed. No charge was made.</div>
        )}
        {paymentStatus === "error" && (
          <div className="bl-alert bl-alert-error">Something went wrong with your payment. Please try again.</div>
        )}

        {/* Current plan */}
        {!loading && billing && (
          <div className="bl-card">
            <div className="bl-card-title" style={{ color:"var(--gold)" }}>Current plan</div>
            <div className="bl-plan-badge" style={{ color: planInfo.color, borderColor: `${planInfo.color}55`, background: `${planInfo.color}10` }}>
              {currentPlan === "pro" ? "✦ " : ""}{planInfo.name}
            </div>
            <div className="bl-billing-row">
              <span className="bl-billing-key">Price</span>
              <span className="bl-billing-val">{planInfo.price}</span>
            </div>
            {billing.subscription?.nextBillingDate && (
              <div className="bl-billing-row">
                <span className="bl-billing-key">Next billing date</span>
                <span className="bl-billing-val">
                  {new Date(billing.subscription.nextBillingDate).toLocaleDateString("en-NG", { day:"numeric", month:"long", year:"numeric" })}
                </span>
              </div>
            )}
            {billing.subscription?.status && (
              <div className="bl-billing-row">
                <span className="bl-billing-key">Status</span>
                <span className="bl-billing-val" style={{ color: billing.subscription.status === "ACTIVE" ? "#22c55e" : "#ef4444" }}>
                  {billing.subscription.status.charAt(0) + billing.subscription.status.slice(1).toLowerCase()}
                </span>
              </div>
            )}
            {currentPlan !== "free" && billing.subscription?.status === "ACTIVE" && (
              <div style={{ marginTop:"1rem" }}>
                <button className="bl-btn-ghost" onClick={handleCancel} disabled={cancelling}>
                  {cancelling ? "Cancelling…" : "Cancel subscription"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Upgrade options */}
        <div className="bl-card">
          <div className="bl-card-title" style={{ color:"var(--gold)" }}>Plans</div>
          <div className="bl-plans">

            {/* Free */}
            <div className={`bl-plan-option${currentPlan === "free" ? " current" : ""}`}>
              <div className="bl-plan-name">Free</div>
              <div className="bl-plan-price">₦0</div>
              <ul className="bl-plan-features">
                <li>1 active event</li>
                <li>Up to 100 guests</li>
                <li>Email invitations</li>
                <li>QR check-in</li>
                <li>Guest tiers</li>
              </ul>
              {currentPlan === "free"
                ? <div className="bl-current-label">Current plan</div>
                : <div style={{ fontSize:"0.7rem", color:"var(--text-3)", textAlign:"center", padding:"0.5rem 0" }}>Downgrade by cancelling above</div>
              }
            </div>

            {/* Starter */}
            <div className={`bl-plan-option${currentPlan === "starter" ? " current" : ""}`}>
              <div className="bl-plan-name">Starter</div>
              <div className="bl-plan-price">₦5,000<span style={{ fontSize:"0.75rem", color:"var(--text-3)" }}>/mo</span></div>
              <ul className="bl-plan-features">
                <li>3 active events</li>
                <li>Up to 500 guests/event</li>
                <li>Email + WhatsApp invites</li>
                <li>Vendor portals</li>
                <li>QR check-in</li>
                <li>Guest tiers</li>
              </ul>
              {currentPlan === "starter"
                ? <div className="bl-current-label">Current plan</div>
                : currentPlan === "pro"
                ? <div style={{ fontSize:"0.7rem", color:"var(--text-3)", textAlign:"center", padding:"0.5rem 0" }}>Cancel Pro to downgrade</div>
                : <button className="bl-btn-gold" onClick={() => handleUpgrade("starter")} disabled={upgrading === "starter"}>
                    {upgrading === "starter" ? "Redirecting…" : "Upgrade to Starter →"}
                  </button>
              }
            </div>

            {/* Pro */}
            <div className={`bl-plan-option popular${currentPlan === "pro" ? " current" : ""}`}>
              <div className="bl-plan-name">Pro</div>
              <div className="bl-plan-price">₦15,000<span style={{ fontSize:"0.75rem", color:"var(--text-3)" }}>/mo</span></div>
              <ul className="bl-plan-features">
                <li>Unlimited events</li>
                <li>Unlimited guests</li>
                <li>Full WhatsApp access</li>
                <li>Vendor portals</li>
                <li>CSV & Sheets import</li>
                <li>Analytics & reports</li>
                <li>Priority support</li>
              </ul>
              {currentPlan === "pro"
                ? <div className="bl-current-label">Current plan</div>
                : <button className="bl-btn-gold" onClick={() => handleUpgrade("pro")} disabled={!!upgrading}>
                    {upgrading === "pro" ? "Redirecting…" : "Upgrade to Pro →"}
                  </button>
              }
            </div>
          </div>
        </div>

        {/* Top-ups */}
        <div className="bl-card">
          <div className="bl-card-title" style={{ color:"var(--gold)" }}>Event top-ups</div>
          <p style={{ fontSize:"0.75rem", color:"var(--text-3)", marginBottom:"1rem", lineHeight:1.6 }}>
            One-time purchases for a specific event. Available on any plan.
            Purchase from the event page when you need them.
          </p>
          <div className="bl-topups">
            {[
              { name:"Extra Guests Pack", desc:"+200 guests added to one event. Can be purchased multiple times.", price:"₦2,000" },
              { name:"WhatsApp QR Delivery", desc:"Send QR codes to all confirmed guests via WhatsApp for one event.", price:"₦1,500" },
              { name:"Priority Check-in Tools", desc:"Multi-usher dashboard, live alerts, and check-in analytics for one event.", price:"₦2,500" },
            ].map(t => (
              <div className="bl-topup" key={t.name}>
                <div style={{ minWidth:0 }}>
                  <div className="bl-topup-name">{t.name}</div>
                  <div className="bl-topup-desc">{t.desc}</div>
                </div>
                <div className="bl-topup-price">{t.price}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
