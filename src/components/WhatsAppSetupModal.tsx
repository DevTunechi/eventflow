"use client"

// ─────────────────────────────────────────────
// src/components/WhatsAppSetupModal.tsx
//
// Reusable WhatsApp Business onboarding modal.
// Triggered from:
//   - Guests page (Send Invites clicked, not connected)
//   - Post-publish checklist (WhatsApp step)
//   - Settings page fallback
//
// On success: calls onConnected() so the
// parent can update its own state and show
// a success message without a page reload.
// ─────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react"

interface Props {
  onConnected: (displayName: string) => void
  onClose:     () => void
}

type Step = "choose" | "meta" | "manual" | "success" | "error"

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {}
  const token = localStorage.getItem("ef-session") ?? ""
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function WhatsAppSetupModal({ onConnected, onClose }: Props) {
  const [step,      setStep]      = useState<Step>("choose")
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState("")
  const [displayName, setDisplayName] = useState("")

  // Manual form
  const [form, setForm] = useState({
    accessToken:   "",
    phoneNumberId: "",
    wabaId:        "",
    displayName:   "",
    phoneNumber:   "",
  })

  // Trap focus & prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  // ── Meta Embedded Signup ──────────────────────

  const launchMeta = useCallback(() => {
    setStep("meta")
    const metaAppId   = process.env.NEXT_PUBLIC_META_APP_ID ?? ""
    const redirectUri = encodeURIComponent(`${window.location.origin}/api/whatsapp/setup/callback`)
    const state       = encodeURIComponent(Math.random().toString(36).slice(2))

    const url = [
      `https://www.facebook.com/dialog/oauth`,
      `?client_id=${metaAppId}`,
      `&redirect_uri=${redirectUri}`,
      `&state=${state}`,
      `&scope=whatsapp_business_management,whatsapp_business_messaging`,
      `&response_type=code`,
      `&extras={"setup":{"channel":"whatsapp"}}`,
    ].join("")

    const popup = window.open(url, "MetaWASignup", "width=600,height=700,scrollbars=yes")

    // Poll — when popup closes re-check status
    const poll = setInterval(async () => {
      if (!popup || popup.closed) {
        clearInterval(poll)
        try {
          const res  = await fetch("/api/whatsapp/status", { headers: getAuthHeaders() })
          const data = await res.json()
          if (data.connected) {
            setDisplayName(data.displayName ?? "Your business")
            setStep("success")
            onConnected(data.displayName ?? "Your business")
          } else {
            // Popup closed without completing — back to choose
            setStep("choose")
          }
        } catch {
          setStep("choose")
        }
      }
    }, 1000)
  }, [onConnected])

  // ── Manual save ───────────────────────────────

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
      const d = await res.json()
      const name = d.displayName ?? form.displayName ?? "Your business"
      setDisplayName(name)
      setStep("success")
      onConnected(name)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to save credentials")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <style>{`
        .wam-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,0,0,0.75);
          display: flex; align-items: center; justify-content: center;
          padding: 1rem;
          animation: wamFadeIn 0.2s ease;
        }
        @keyframes wamFadeIn { from { opacity:0 } to { opacity:1 } }

        .wam {
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-radius: 10px;
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
          animation: wamSlideUp 0.25s ease;
          position: relative;
        }
        @keyframes wamSlideUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:none } }

        .wam-header {
          padding: 1.375rem 1.5rem 0;
          display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
        }
        .wam-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.375rem; font-weight: 300;
          color: var(--text); letter-spacing: -0.01em;
          margin-bottom: 0.25rem;
        }
        .wam-sub { font-size: 0.775rem; color: var(--text-3); line-height: 1.5; }
        .wam-close {
          width: 28px; height: 28px; border-radius: 50%;
          background: transparent; border: 1px solid var(--border);
          color: var(--text-3); font-size: 1rem; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: all 0.15s; margin-top: 2px;
        }
        .wam-close:hover { border-color: var(--border-hover); color: var(--text); }

        .wam-body { padding: 1.375rem 1.5rem 1.5rem; }

        /* Steps */
        .wam-steps { display: flex; flex-direction: column; gap: 0.875rem; margin-bottom: 1.375rem; }
        .wam-step { display: flex; gap: 0.75rem; }
        .wam-step-num {
          width: 22px; height: 22px; border-radius: 50%;
          background: rgba(180,140,60,0.1); border: 1px solid rgba(180,140,60,0.25);
          color: var(--gold); font-size: 0.65rem; font-weight: 600;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; margin-top: 1px;
        }
        .wam-step-title { font-size: 0.8rem; font-weight: 500; color: var(--text); margin-bottom: 0.15rem; }
        .wam-step-desc  { font-size: 0.72rem; color: var(--text-3); line-height: 1.55; }

        /* Buttons */
        .wam-btn {
          width: 100%; padding: 0.8rem 1.25rem;
          font-family: 'DM Sans', sans-serif; font-size: 0.825rem;
          cursor: pointer; border-radius: 6px; border: none;
          transition: all 0.2s; display: flex; align-items: center;
          justify-content: center; gap: 0.625rem; font-weight: 500;
        }
        .wam-btn-meta { background: #1877f2; color: #fff; margin-bottom: 0.75rem; }
        .wam-btn-meta:hover { background: #1565d8; }
        .wam-btn-gold { background: var(--gold); color: #0a0a0a; }
        .wam-btn-gold:hover:not(:disabled) { background: #c9a050; }
        .wam-btn-gold:disabled { opacity: 0.45; cursor: not-allowed; }
        .wam-btn-ghost {
          background: transparent; border: 1px solid var(--border);
          color: var(--text-2); width: 100%; margin-top: 0.625rem;
          padding: 0.7rem; font-family: 'DM Sans', sans-serif;
          font-size: 0.775rem; cursor: pointer; border-radius: 6px;
          transition: all 0.2s;
        }
        .wam-btn-ghost:hover { border-color: var(--border-hover); color: var(--text); }

        /* Divider */
        .wam-or { display: flex; align-items: center; gap: 0.75rem; margin: 1rem 0; }
        .wam-or-line { flex: 1; height: 1px; background: var(--border); }
        .wam-or-text { font-size: 0.65rem; color: var(--text-3); letter-spacing: 0.05em; white-space: nowrap; }

        /* Form */
        .wam-field { margin-bottom: 1rem; }
        .wam-label { display: block; font-size: 0.7rem; font-weight: 500; color: var(--text-2); margin-bottom: 0.35rem; letter-spacing: 0.02em; }
        .wam-req { color: var(--gold); }
        .wam-input {
          width: 100%; padding: 0.575rem 0.875rem;
          background: var(--bg-3); border: 1px solid var(--border);
          border-radius: 5px; color: var(--text);
          font-family: 'DM Sans', sans-serif; font-size: 0.8rem;
          outline: none; box-sizing: border-box; transition: border-color 0.15s;
        }
        .wam-input:focus { border-color: var(--gold); }
        .wam-hint { font-size: 0.65rem; color: var(--text-3); margin-top: 0.25rem; line-height: 1.5; }
        .wam-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

        /* Error */
        .wam-error {
          padding: 0.625rem 0.875rem; border-radius: 5px; font-size: 0.75rem;
          background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
          color: #ef4444; margin-bottom: 1rem;
        }

        /* Waiting state */
        .wam-waiting { text-align: center; padding: 1rem 0; }
        .wam-spin {
          width: 28px; height: 28px; margin: 0 auto 1rem;
          border: 2px solid rgba(180,140,60,0.2);
          border-top-color: #b48c3c; border-radius: 50%;
          animation: wamSpin 0.7s linear infinite;
        }
        @keyframes wamSpin { to { transform: rotate(360deg); } }
        .wam-waiting-text { font-size: 0.8rem; color: var(--text-2); margin-bottom: 0.375rem; }
        .wam-waiting-sub  { font-size: 0.72rem; color: var(--text-3); line-height: 1.5; }

        /* Success */
        .wam-success { text-align: center; padding: 0.5rem 0 0.25rem; }
        .wam-success-icon { font-size: 2.5rem; margin-bottom: 0.875rem; }
        .wam-success-title { font-family: 'Cormorant Garamond', serif; font-size: 1.375rem; font-weight: 300; color: var(--text); margin-bottom: 0.375rem; }
        .wam-success-sub { font-size: 0.8rem; color: var(--text-3); line-height: 1.6; margin-bottom: 1.375rem; }
        .wam-success-name { color: var(--gold); font-weight: 500; }

        /* Info box */
        .wam-info {
          padding: 0.75rem 0.875rem; background: var(--bg-3);
          border: 1px solid var(--border); border-radius: 5px;
          font-size: 0.75rem; color: var(--text-3); line-height: 1.6;
          margin-bottom: 1.125rem;
        }
        .wam-info strong { color: var(--text-2); }

        /* Back link */
        .wam-back {
          background: none; border: none; color: var(--text-3);
          font-size: 0.72rem; cursor: pointer; padding: 0;
          display: flex; align-items: center; gap: 0.3rem;
          margin-bottom: 1.125rem; font-family: 'DM Sans', sans-serif;
          transition: color 0.15s;
        }
        .wam-back:hover { color: var(--gold); }
      `}</style>

      {/* Overlay */}
      <div className="wam-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="wam">

          {/* Header */}
          <div className="wam-header">
            <div>
              <div className="wam-title">
                {step === "success" ? "You're connected 🎉" : "Connect WhatsApp"}
              </div>
              <div className="wam-sub">
                {step === "success"
                  ? "Your WhatsApp Business number is ready."
                  : "Required to send invites to your guests."
                }
              </div>
            </div>
            <button className="wam-close" onClick={onClose}>✕</button>
          </div>

          <div className="wam-body">

            {/* ── CHOOSE ── */}
            {step === "choose" && (
              <>
                <div className="wam-steps">
                  {[
                    { title: "Connect your number",   desc: "Log in with Facebook and link your WhatsApp Business account." },
                    { title: "Messages come from you", desc: "Guests receive invites from your business name, not EventFlow." },
                    { title: "Send invites instantly", desc: "Once connected, send all pending invites in one click." },
                  ].map((s, i) => (
                    <div className="wam-step" key={i}>
                      <div className="wam-step-num">{i + 1}</div>
                      <div>
                        <div className="wam-step-title">{s.title}</div>
                        <div className="wam-step-desc">{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="wam-btn wam-btn-meta" onClick={launchMeta}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/>
                  </svg>
                  Connect with Meta
                </button>

                <div className="wam-or">
                  <div className="wam-or-line" />
                  <span className="wam-or-text">Already have API credentials?</span>
                  <div className="wam-or-line" />
                </div>

                <button className="wam-btn-ghost" onClick={() => setStep("manual")}>
                  Enter credentials manually
                </button>
              </>
            )}

            {/* ── META WAITING ── */}
            {step === "meta" && (
              <div className="wam-waiting">
                <div className="wam-spin" />
                <div className="wam-waiting-text">Meta signup window is open</div>
                <div className="wam-waiting-sub">
                  Complete the steps in the popup window.<br />
                  This will update automatically when you&apos;re done.
                </div>
                <button className="wam-btn-ghost" style={{ marginTop: "1.25rem" }} onClick={() => setStep("choose")}>
                  Cancel
                </button>
              </div>
            )}

            {/* ── MANUAL ── */}
            {step === "manual" && (
              <>
                <button className="wam-back" onClick={() => { setStep("choose"); setSaveError("") }}>
                  ← Back
                </button>

                <div className="wam-info">
                  Find these in{" "}
                  <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)" }}>
                    Meta Developer Console
                  </a>
                  {" "}→ Your App → WhatsApp → API Setup.
                </div>

                <div className="wam-field">
                  <label className="wam-label">Access Token <span className="wam-req">*</span></label>
                  <input className="wam-input" type="password" placeholder="EAAxxxxxxxx…"
                    value={form.accessToken} onChange={e => setForm(p => ({ ...p, accessToken: e.target.value }))} />
                </div>

                <div className="wam-field">
                  <label className="wam-label">Phone Number ID <span className="wam-req">*</span></label>
                  <input className="wam-input" placeholder="1234567890123456"
                    value={form.phoneNumberId} onChange={e => setForm(p => ({ ...p, phoneNumberId: e.target.value }))} />
                  <span className="wam-hint">WhatsApp → API Setup → Phone Number ID</span>
                </div>

                <div className="wam-field">
                  <label className="wam-label">WABA ID <span className="wam-req">*</span></label>
                  <input className="wam-input" placeholder="1234567890123456"
                    value={form.wabaId} onChange={e => setForm(p => ({ ...p, wabaId: e.target.value }))} />
                  <span className="wam-hint">Meta Business Manager → WhatsApp Accounts → Account ID</span>
                </div>

                <div className="wam-row2">
                  <div className="wam-field">
                    <label className="wam-label">Display Name</label>
                    <input className="wam-input" placeholder="e.g. Tunde Events"
                      value={form.displayName} onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} />
                  </div>
                  <div className="wam-field">
                    <label className="wam-label">Phone Number</label>
                    <input className="wam-input" placeholder="+2348012345678"
                      value={form.phoneNumber} onChange={e => setForm(p => ({ ...p, phoneNumber: e.target.value }))} />
                  </div>
                </div>

                {saveError && <div className="wam-error">{saveError}</div>}

                <button className="wam-btn wam-btn-gold" onClick={handleSave} disabled={saving}>
                  {saving ? "Verifying & saving…" : "Save Credentials"}
                </button>
              </>
            )}

            {/* ── SUCCESS ── */}
            {step === "success" && (
              <div className="wam-success">
                <div className="wam-success-icon">✅</div>
                <div className="wam-success-title">WhatsApp Connected</div>
                <div className="wam-success-sub">
                  <span className="wam-success-name">{displayName}</span> is now live.<br />
                  You can send invites to your guests from the Guests tab.
                </div>
                <button className="wam-btn wam-btn-gold" onClick={onClose}>
                  Done — Go Send Invites
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
