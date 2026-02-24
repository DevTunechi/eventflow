"use client"

// ─────────────────────────────────────────────
// src/app/(dashboard)/settings/whatsapp/page.tsx
//
// WhatsApp Business API onboarding.
// Walks the planner through connecting their
// WhatsApp Business number via Meta's
// Embedded Signup flow — entirely inside
// the EventFlow dashboard.
//
// Steps:
//   1. Check current connection status
//   2. If not connected → show setup flow
//   3. Meta Embedded Signup (opens in modal)
//   4. Save credentials → mark as connected
//   5. Send test message to confirm it works
// ─────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"

// ── Types ──────────────────────────────────────

type SetupStep = "loading" | "not_connected" | "connecting" | "verify" | "connected" | "error"

interface WAStatus {
  connected:         boolean
  phoneNumber:       string | null
  displayName:       string | null
  businessName:      string | null
  wabaId:            string | null
  phoneNumberId:     string | null
  connectedAt:       string | null
  messagesSentTotal: number
}

// ── Helpers ────────────────────────────────────

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {}
  const token = localStorage.getItem("ef-session") ?? ""
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ── Component ───────────────────────────────────

export default function WhatsAppSetupPage() {
  const [step,        setStep]        = useState<SetupStep>("loading")
  const [status,      setStatus]      = useState<WAStatus | null>(null)
  const [error,       setError]       = useState("")

  // Manual credentials form (fallback if Embedded Signup unavailable)
  const [form, setForm] = useState({
    accessToken:   "",
    phoneNumberId: "",
    wabaId:        "",
    displayName:   "",
    phoneNumber:   "",
  })
  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState("")

  // Test message
  const [testPhone,   setTestPhone]   = useState("")
  const [testing,     setTesting]     = useState(false)
  const [testResult,  setTestResult]  = useState<"ok" | "fail" | null>(null)

  // Disconnect
  const [disconnecting, setDisconnecting] = useState(false)

  // ── Load current status ───────────────────────

  const loadStatus = useCallback(async () => {
    setStep("loading")
    try {
      const res = await fetch("/api/whatsapp/status", { headers: getAuthHeaders() })
      if (!res.ok) throw new Error()
      const data: WAStatus = await res.json()
      setStatus(data)
      setStep(data.connected ? "connected" : "not_connected")
    } catch {
      setStep("error")
      setError("Failed to load WhatsApp status.")
    }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  // ── Meta Embedded Signup ──────────────────────
  // Opens Meta's official WhatsApp Business
  // onboarding in a popup window. On completion,
  // Meta sends a callback with the credentials
  // which we capture and save.

  const launchMetaSignup = () => {
    setStep("connecting")

    // Meta Embedded Signup URL — replace
    // NEXT_PUBLIC_META_APP_ID with your Meta
    // App ID from console.developers.facebook.com
    const metaAppId    = process.env.NEXT_PUBLIC_META_APP_ID ?? "YOUR_META_APP_ID"
    const redirectUri  = encodeURIComponent(`${window.location.origin}/api/whatsapp/setup/callback`)
    const state        = encodeURIComponent(Math.random().toString(36).slice(2))

    const signupUrl = [
      `https://www.facebook.com/dialog/oauth`,
      `?client_id=${metaAppId}`,
      `&redirect_uri=${redirectUri}`,
      `&state=${state}`,
      `&scope=whatsapp_business_management,whatsapp_business_messaging`,
      `&response_type=code`,
      `&extras={"setup":{"channel":"whatsapp"}}`,
    ].join("")

    // Open Meta signup in a popup
    const popup = window.open(
      signupUrl,
      "MetaWhatsAppSignup",
      "width=600,height=700,scrollbars=yes,resizable=yes"
    )

    // Poll for popup close — Meta redirects back
    // to our callback which saves credentials
    const poll = setInterval(async () => {
      if (!popup || popup.closed) {
        clearInterval(poll)
        // Re-check status after popup closes
        await loadStatus()
      }
    }, 1000)
  }

  // ── Manual credentials save ───────────────────

  const handleSave = async () => {
    if (!form.accessToken.trim() || !form.phoneNumberId.trim() || !form.wabaId.trim()) {
      setSaveError("Access Token, Phone Number ID, and WABA ID are required.")
      return
    }
    setSaving(true)
    setSaveError("")
    try {
      const res = await fetch("/api/whatsapp/setup", {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Failed to save")
      }
      await loadStatus()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to save credentials")
    } finally {
      setSaving(false)
    }
  }

  // ── Send test message ─────────────────────────

  const handleTest = async () => {
    if (!testPhone.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/whatsapp/send", {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify({
          to:      testPhone.trim(),
          message: "✅ EventFlow WhatsApp connection confirmed. Your planner account is ready to send invites.",
          test:    true,
        }),
      })
      setTestResult(res.ok ? "ok" : "fail")
    } catch {
      setTestResult("fail")
    } finally {
      setTesting(false)
    }
  }

  // ── Disconnect ────────────────────────────────

  const handleDisconnect = async () => {
    if (!confirm("Disconnect WhatsApp? You will not be able to send invites until you reconnect.")) return
    setDisconnecting(true)
    try {
      await fetch("/api/whatsapp/setup", {
        method:  "DELETE",
        headers: getAuthHeaders(),
      })
      await loadStatus()
    } finally {
      setDisconnecting(false)
    }
  }

  // ── Render ────────────────────────────────────

  return (
    <>
      <style>{`
        .wa { max-width: 640px; margin: 0 auto; padding: 0 0 4rem; animation: waIn 0.3s ease; }
        @keyframes waIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:none; } }

        .wa-top { display:flex; align-items:center; gap:0.75rem; margin-bottom:2rem; }
        .wa-back { font-size:0.78rem; color:var(--text-3); text-decoration:none; display:flex; align-items:center; gap:0.35rem; transition:color 0.2s; }
        .wa-back:hover { color:var(--gold); }

        .wa-heading { margin-bottom:2rem; }
        .wa-title { font-family:'Cormorant Garamond',serif; font-size:clamp(1.5rem,3vw,2.25rem); font-weight:300; color:var(--text); letter-spacing:-0.01em; margin-bottom:0.375rem; }
        .wa-sub { font-size:0.8rem; color:var(--text-3); line-height:1.6; }

        /* Status pill */
        .wa-status-pill { display:inline-flex; align-items:center; gap:0.45rem; padding:0.3rem 0.875rem; border-radius:99px; font-size:0.72rem; font-weight:500; letter-spacing:0.05em; border:1px solid; }
        .wa-status-pill.on  { color:#22c55e; border-color:rgba(34,197,94,0.3);  background:rgba(34,197,94,0.08);  }
        .wa-status-pill.off { color:#f59e0b; border-color:rgba(245,158,11,0.3); background:rgba(245,158,11,0.08); }
        .wa-dot { width:6px; height:6px; border-radius:50%; }

        /* Cards */
        .wa-card { background:var(--bg-2); border:1px solid var(--border); padding:1.5rem; margin-bottom:1.25rem; border-radius:8px; }
        .wa-card-title { font-size:0.6rem; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--gold); margin-bottom:1.25rem; display:flex; align-items:center; gap:0.75rem; }
        .wa-card-title::after { content:''; flex:1; height:1px; background:var(--border); }

        /* Meta signup button */
        .wa-meta-btn { width:100%; padding:1rem 1.5rem; background:#1877f2; color:#fff; font-family:'DM Sans',sans-serif; font-size:0.875rem; font-weight:500; border:none; border-radius:7px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.75rem; transition:background 0.2s; margin-bottom:1rem; }
        .wa-meta-btn:hover { background:#1565d8; }
        .wa-meta-btn svg { flex-shrink:0; }

        /* Or divider */
        .wa-or { display:flex; align-items:center; gap:0.875rem; margin:1.5rem 0; }
        .wa-or-line { flex:1; height:1px; background:var(--border); }
        .wa-or-text { font-size:0.7rem; color:var(--text-3); letter-spacing:0.05em; white-space:nowrap; }

        /* Form fields */
        .wa-field { margin-bottom:1.125rem; }
        .wa-label { display:block; font-size:0.72rem; font-weight:500; color:var(--text-2); letter-spacing:0.03em; margin-bottom:0.4rem; }
        .wa-req { color:var(--gold); margin-left:2px; }
        .wa-input { width:100%; padding:0.625rem 0.875rem; background:var(--bg-3); border:1px solid var(--border); border-radius:5px; color:var(--text); font-family:'DM Sans',sans-serif; font-size:0.825rem; outline:none; box-sizing:border-box; transition:border-color 0.15s; }
        .wa-input:focus { border-color:var(--gold); }
        .wa-hint { font-size:0.68rem; color:var(--text-3); margin-top:0.3rem; line-height:1.5; }

        /* Buttons */
        .wa-btn { padding:0.575rem 1.25rem; font-family:'DM Sans',sans-serif; font-size:0.8rem; cursor:pointer; border:none; border-radius:5px; transition:all 0.2s; display:inline-flex; align-items:center; gap:0.4rem; }
        .wa-btn-gold { background:var(--gold); color:#0a0a0a; font-weight:500; }
        .wa-btn-gold:hover:not(:disabled) { background:#c9a050; }
        .wa-btn-gold:disabled { opacity:0.45; cursor:not-allowed; }
        .wa-btn-ghost { background:transparent; border:1px solid var(--border); color:var(--text-2); }
        .wa-btn-ghost:hover { border-color:var(--border-hover); color:var(--text); }
        .wa-btn-danger { background:transparent; border:1px solid rgba(239,68,68,0.2); color:rgba(239,68,68,0.6); }
        .wa-btn-danger:hover:not(:disabled) { border-color:#ef4444; color:#ef4444; }
        .wa-btn-danger:disabled { opacity:0.4; cursor:not-allowed; }
        .wa-btn-green { background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.3); color:#22c55e; }
        .wa-btn-green:hover:not(:disabled) { background:rgba(34,197,94,0.18); }

        .wa-actions { display:flex; gap:0.625rem; margin-top:1.25rem; flex-wrap:wrap; }

        /* Error / success banners */
        .wa-banner { padding:0.75rem 1rem; border-radius:5px; font-size:0.78rem; margin-bottom:1rem; }
        .wa-banner-err  { background:rgba(239,68,68,0.08);  border:1px solid rgba(239,68,68,0.25);  color:#ef4444; }
        .wa-banner-ok   { background:rgba(34,197,94,0.08);  border:1px solid rgba(34,197,94,0.25);  color:#22c55e; }
        .wa-banner-info { background:rgba(180,140,60,0.08); border:1px solid rgba(180,140,60,0.25); color:#b48c3c; }

        /* Connected card */
        .wa-connected-row { display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:0.5rem 0; border-bottom:1px solid var(--border); }
        .wa-connected-row:last-child { border-bottom:none; }
        .wa-connected-k { font-size:0.65rem; color:var(--text-3); letter-spacing:0.06em; text-transform:uppercase; }
        .wa-connected-v { font-size:0.8rem; color:var(--text-2); text-align:right; }

        /* Steps */
        .wa-steps { display:flex; flex-direction:column; gap:1rem; margin-bottom:1.5rem; }
        .wa-step { display:flex; gap:0.875rem; align-items:flex-start; }
        .wa-step-num { width:24px; height:24px; border-radius:50%; background:var(--gold-dim); border:1px solid rgba(180,140,60,0.3); color:var(--gold); font-size:0.7rem; font-weight:600; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; }
        .wa-step-body { flex:1; }
        .wa-step-title { font-size:0.82rem; font-weight:500; color:var(--text); margin-bottom:0.2rem; }
        .wa-step-desc { font-size:0.75rem; color:var(--text-3); line-height:1.6; }

        /* Info box */
        .wa-info { padding:0.875rem 1rem; background:var(--bg-3); border:1px solid var(--border); border-radius:5px; font-size:0.78rem; color:var(--text-3); line-height:1.6; margin-bottom:1.25rem; }
        .wa-info strong { color:var(--text-2); }

        /* Stats */
        .wa-stats { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.625rem; margin-bottom:1.25rem; }
        .wa-stat { background:var(--bg-3); border:1px solid var(--border); padding:0.875rem; text-align:center; border-radius:5px; }
        .wa-stat-num { font-family:'Cormorant Garamond',serif; font-size:1.75rem; font-weight:300; color:var(--gold); line-height:1; margin-bottom:0.2rem; }
        .wa-stat-label { font-size:0.58rem; color:var(--text-3); letter-spacing:0.1em; text-transform:uppercase; }

        /* Spinner */
        .wa-spin { width:22px; height:22px; border:1.5px solid rgba(180,140,60,0.2); border-top-color:#b48c3c; border-radius:50%; animation:waSpin 0.7s linear infinite; }
        @keyframes waSpin { to { transform:rotate(360deg); } }
        .wa-loading { display:flex; align-items:center; justify-content:center; height:60vh; gap:0.75rem; }
      `}</style>

      <div className="wa">

        {/* Topbar */}
        <div className="wa-top">
          <Link href="/dashboard" className="wa-back">← Dashboard</Link>
        </div>

        {/* Heading */}
        <div className="wa-heading">
          <h1 className="wa-title">WhatsApp Business</h1>
          <p className="wa-sub">
            Connect your WhatsApp Business number to send personalised invites,
            deliver QR codes, and communicate with guests directly from EventFlow.
          </p>
        </div>

        {/* ── LOADING ── */}
        {step === "loading" && (
          <div className="wa-loading">
            <div className="wa-spin" />
          </div>
        )}

        {/* ── ERROR ── */}
        {step === "error" && (
          <div className="wa-banner wa-banner-err">{error}</div>
        )}

        {/* ── CONNECTED ── */}
        {step === "connected" && status && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.75rem", flexWrap: "wrap" }}>
              <span className="wa-status-pill on">
                <span className="wa-dot" style={{ background: "#22c55e" }} />
                Connected
              </span>
              {status.connectedAt && (
                <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>
                  Since {new Date(status.connectedAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="wa-stats">
              <div className="wa-stat">
                <div className="wa-stat-num">{status.messagesSentTotal}</div>
                <div className="wa-stat-label">Messages Sent</div>
              </div>
              <div className="wa-stat">
                <div className="wa-stat-num">✓</div>
                <div className="wa-stat-label">Verified</div>
              </div>
              <div className="wa-stat">
                <div className="wa-stat-num">📲</div>
                <div className="wa-stat-label">Active</div>
              </div>
            </div>

            {/* Connected details */}
            <div className="wa-card">
              <div className="wa-card-title">Connected Account</div>
              {[
                { k: "Display Name",   v: status.displayName   ?? "—" },
                { k: "Business Name",  v: status.businessName  ?? "—" },
                { k: "Phone Number",   v: status.phoneNumber   ?? "—" },
                { k: "WABA ID",        v: status.wabaId        ?? "—" },
                { k: "Phone Number ID",v: status.phoneNumberId ?? "—" },
              ].map(r => (
                <div className="wa-connected-row" key={r.k}>
                  <span className="wa-connected-k">{r.k}</span>
                  <span className="wa-connected-v" style={{ fontFamily: r.k.includes("ID") ? "monospace" : "inherit", fontSize: r.k.includes("ID") ? "0.72rem" : undefined }}>
                    {r.v}
                  </span>
                </div>
              ))}
            </div>

            {/* Test message */}
            <div className="wa-card">
              <div className="wa-card-title">Send Test Message</div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-3)", marginBottom: "1rem", lineHeight: 1.6 }}>
                Send a test WhatsApp message to confirm everything is working correctly.
              </p>
              <div className="wa-field">
                <label className="wa-label">Phone Number</label>
                <input
                  className="wa-input"
                  placeholder="e.g. +2348012345678"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                />
                <span className="wa-hint">Include country code. This number will receive a test message from your WhatsApp Business line.</span>
              </div>

              {testResult === "ok"   && <div className="wa-banner wa-banner-ok">✓ Test message sent successfully. Check your WhatsApp.</div>}
              {testResult === "fail" && <div className="wa-banner wa-banner-err">✗ Test failed. Check your credentials and try again.</div>}

              <div className="wa-actions">
                <button className="wa-btn wa-btn-green" onClick={handleTest} disabled={testing || !testPhone.trim()}>
                  {testing ? "Sending…" : "Send Test Message"}
                </button>
              </div>
            </div>

            {/* Danger zone */}
            <div className="wa-card" style={{ borderColor: "rgba(239,68,68,0.15)" }}>
              <div className="wa-card-title" style={{ color: "#ef4444" }}>Danger Zone</div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-3)", marginBottom: "1.125rem", lineHeight: 1.6 }}>
                Disconnecting will remove your WhatsApp credentials from EventFlow.
                You will not be able to send invites or QR codes until you reconnect.
              </p>
              <button className="wa-btn wa-btn-danger" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? "Disconnecting…" : "Disconnect WhatsApp"}
              </button>
            </div>
          </>
        )}

        {/* ── NOT CONNECTED ── */}
        {(step === "not_connected" || step === "connecting") && (
          <>
            <div style={{ marginBottom: "1.75rem" }}>
              <span className="wa-status-pill off">
                <span className="wa-dot" style={{ background: "#f59e0b" }} />
                Not Connected
              </span>
            </div>

            <div className="wa-info">
              <strong>This is mandatory.</strong> You must connect your WhatsApp Business number before you can send invites to guests. Every planner uses their own WhatsApp Business line — messages come from your number, not EventFlow&apos;s.
            </div>

            {/* How it works */}
            <div className="wa-card">
              <div className="wa-card-title">How It Works</div>
              <div className="wa-steps">
                {[
                  { title: "Connect via Meta",         desc: "Click the button below to open Meta's official WhatsApp Business signup. Log in with your Facebook account and connect or create your WhatsApp Business account." },
                  { title: "Verify your number",       desc: "Meta will send a verification code to your business phone number. Enter it to confirm ownership." },
                  { title: "You're live",              desc: "Your WhatsApp Business line is now connected to EventFlow. All invite messages, QR codes, and guest communications go through your number." },
                  { title: "Guests see your brand",    desc: "Every message guests receive comes from your WhatsApp Business name, not EventFlow. You own the relationship." },
                ].map((s, i) => (
                  <div className="wa-step" key={i}>
                    <div className="wa-step-num">{i + 1}</div>
                    <div className="wa-step-body">
                      <div className="wa-step-title">{s.title}</div>
                      <div className="wa-step-desc">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Meta Embedded Signup button */}
              <button className="wa-meta-btn" onClick={launchMetaSignup} disabled={step === "connecting"}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/>
                </svg>
                {step === "connecting" ? "Opening Meta signup…" : "Connect with Meta"}
              </button>

              {step === "connecting" && (
                <div className="wa-banner wa-banner-info">
                  A Meta signup window has opened. Complete the steps there and return here — your connection will be confirmed automatically.
                </div>
              )}
            </div>

            {/* Manual fallback */}
            <div className="wa-card">
              <div className="wa-card-title">Manual Setup</div>
              <p style={{ fontSize: "0.78rem", color: "var(--text-3)", marginBottom: "1.25rem", lineHeight: 1.6 }}>
                Already have a WhatsApp Business API account? Enter your credentials manually from the{" "}
                <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)" }}>
                  Meta Developer Console
                </a>.
              </p>

              <div className="wa-field">
                <label className="wa-label">Permanent Access Token <span className="wa-req">*</span></label>
                <input
                  className="wa-input"
                  type="password"
                  placeholder="EAAxxxxxxxxxxxxxxxx…"
                  value={form.accessToken}
                  onChange={e => setForm(p => ({ ...p, accessToken: e.target.value }))}
                />
                <span className="wa-hint">
                  From Meta Developer Console → Your App → WhatsApp → API Setup → Permanent token.
                  Never share this token.
                </span>
              </div>

              <div className="wa-field">
                <label className="wa-label">Phone Number ID <span className="wa-req">*</span></label>
                <input
                  className="wa-input"
                  placeholder="1234567890123456"
                  value={form.phoneNumberId}
                  onChange={e => setForm(p => ({ ...p, phoneNumberId: e.target.value }))}
                />
                <span className="wa-hint">
                  Found in Meta Developer Console → WhatsApp → API Setup → Phone Number ID.
                </span>
              </div>

              <div className="wa-field">
                <label className="wa-label">WhatsApp Business Account ID (WABA ID) <span className="wa-req">*</span></label>
                <input
                  className="wa-input"
                  placeholder="1234567890123456"
                  value={form.wabaId}
                  onChange={e => setForm(p => ({ ...p, wabaId: e.target.value }))}
                />
                <span className="wa-hint">
                  Found in Meta Business Manager → WhatsApp Accounts → Account ID.
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
                <div className="wa-field">
                  <label className="wa-label">Display Name</label>
                  <input
                    className="wa-input"
                    placeholder="e.g. Tunde Events"
                    value={form.displayName}
                    onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
                  />
                </div>
                <div className="wa-field">
                  <label className="wa-label">Business Phone Number</label>
                  <input
                    className="wa-input"
                    placeholder="+2348012345678"
                    value={form.phoneNumber}
                    onChange={e => setForm(p => ({ ...p, phoneNumber: e.target.value }))}
                  />
                </div>
              </div>

              {saveError && <div className="wa-banner wa-banner-err">{saveError}</div>}

              <div className="wa-actions">
                <button className="wa-btn wa-btn-gold" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save Credentials"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
