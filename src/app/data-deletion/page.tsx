"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"

type Step = "form" | "submitted"
type Role = "guest" | "planner"

export default function DataDeletionPage() {
  const [role, setRole]           = useState<Role>("guest")
  const [name, setName]           = useState("")
  const [email, setEmail]         = useState("")
  const [phone, setPhone]         = useState("")
  const [eventName, setEventName] = useState("")
  const [reason, setReason]       = useState("")
  const [step, setStep]           = useState<Step>("form")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState("")

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) {
      setError("Please provide your name and email address.")
      return
    }
    setError("")
    setSubmitting(true)

    // TODO: wire to /api/data-deletion once built
    // For now simulate submission
    await new Promise(r => setTimeout(r, 1200))
    setSubmitting(false)
    setStep("submitted")
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .dd-root {
          min-height: 100vh;
          background: #0a0a0a;
          font-family: 'DM Sans', sans-serif;
          color: #f0ece4;
        }
        .dd-root::before {
          content: ''; position: fixed; inset: 0;
          background: radial-gradient(ellipse 80% 60% at 80% 30%, rgba(180,140,60,0.04) 0%, transparent 60%);
          pointer-events: none; z-index: 0;
        }

        .dd-nav {
          position: relative; z-index: 1;
          border-bottom: 1px solid rgba(180,140,60,0.1);
          padding: 1.25rem 2rem;
          display: flex; align-items: center; gap: 0.7rem;
          text-decoration: none; width: fit-content;
        }
        .dd-nav-logo {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.2rem; color: #f0ece4; letter-spacing: 0.14em;
        }
        .dd-nav-logo span { color: #b48c3c; }

        .dd-container {
          max-width: 600px;
          margin: 0 auto;
          padding: 4rem 2rem 6rem;
          position: relative; z-index: 1;
        }

        .dd-eyebrow {
          font-size: 0.62rem; font-weight: 500;
          letter-spacing: 0.3em; text-transform: uppercase;
          color: #b48c3c; margin-bottom: 1rem;
          display: flex; align-items: center; gap: 0.75rem;
        }
        .dd-eyebrow::before {
          content: ''; width: 2rem; height: 1px;
          background: #b48c3c; opacity: 0.6;
        }

        .dd-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(1.75rem, 4vw, 2.5rem);
          font-weight: 300; line-height: 1.1;
          color: #f0ece4; margin-bottom: 0.5rem;
          letter-spacing: -0.01em;
        }

        .dd-subtitle {
          font-size: 0.875rem;
          color: rgba(240,236,228,0.5);
          font-weight: 300; line-height: 1.7;
          margin-bottom: 3rem;
          padding-bottom: 2rem;
          border-bottom: 1px solid rgba(180,140,60,0.1);
        }

        /* Role toggle */
        .dd-role-toggle {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 0.625rem; margin-bottom: 2rem;
        }
        .dd-role-btn {
          padding: 0.875rem;
          border: 1.5px solid rgba(180,140,60,0.15);
          border-radius: 8px; background: transparent;
          color: rgba(240,236,228,0.5);
          font-family: 'DM Sans', sans-serif;
          font-size: 0.8rem; font-weight: 400;
          cursor: pointer; transition: all 0.2s;
          text-align: left;
        }
        .dd-role-btn:hover { border-color: rgba(180,140,60,0.35); color: rgba(240,236,228,0.75); }
        .dd-role-btn.active {
          border-color: rgba(180,140,60,0.5);
          background: rgba(180,140,60,0.06);
          color: #f0ece4;
        }
        .dd-role-icon { font-size: 1.25rem; margin-bottom: 0.375rem; display: block; }
        .dd-role-label { display: block; font-weight: 500; margin-bottom: 0.2rem; }
        .dd-role-desc { font-size: 0.7rem; color: rgba(240,236,228,0.4); line-height: 1.4; font-weight: 300; }
        .dd-role-btn.active .dd-role-desc { color: rgba(240,236,228,0.55); }

        /* Form */
        .dd-form { display: flex; flex-direction: column; gap: 1.125rem; }

        .dd-field { display: flex; flex-direction: column; gap: 0.4rem; }

        .dd-label {
          font-size: 0.72rem; font-weight: 500;
          color: rgba(240,236,228,0.6); letter-spacing: 0.05em;
        }
        .dd-label span { color: rgba(180,140,60,0.8); margin-left: 2px; }

        .dd-input, .dd-textarea, .dd-select {
          padding: 0.7rem 0.9rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(180,140,60,0.15);
          border-radius: 6px; color: #f0ece4;
          font-family: 'DM Sans', sans-serif; font-size: 0.85rem;
          font-weight: 300; outline: none;
          transition: border-color 0.15s;
          width: 100%;
        }
        .dd-input::placeholder, .dd-textarea::placeholder {
          color: rgba(240,236,228,0.2);
        }
        .dd-input:focus, .dd-textarea:focus, .dd-select:focus {
          border-color: rgba(180,140,60,0.45);
        }
        .dd-textarea { resize: vertical; min-height: 90px; line-height: 1.6; }
        .dd-select option { background: #111; }

        .dd-hint {
          font-size: 0.68rem; color: rgba(240,236,228,0.3);
          font-weight: 300; line-height: 1.5;
        }

        .dd-error {
          font-size: 0.78rem; color: #ef4444;
          padding: 0.625rem 0.875rem;
          background: rgba(239,68,68,0.07);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 6px;
        }

        .dd-submit {
          padding: 0.875rem 1.5rem;
          background: rgba(180,140,60,0.12);
          border: 1px solid rgba(180,140,60,0.3);
          border-radius: 6px; color: #c9a84c;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.875rem; font-weight: 500;
          cursor: pointer; transition: all 0.2s;
          margin-top: 0.375rem;
        }
        .dd-submit:hover:not(:disabled) {
          background: rgba(180,140,60,0.18);
          border-color: rgba(180,140,60,0.5);
        }
        .dd-submit:disabled { opacity: 0.45; cursor: not-allowed; }

        .dd-info-box {
          padding: 1.125rem 1.25rem;
          border: 1px solid rgba(180,140,60,0.1);
          border-radius: 8px;
          background: rgba(180,140,60,0.025);
          margin-bottom: 2rem;
        }
        .dd-info-title {
          font-size: 0.65rem; font-weight: 500;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: rgba(180,140,60,0.7); margin-bottom: 0.625rem;
        }
        .dd-info-list { display: flex; flex-direction: column; gap: 0.4rem; }
        .dd-info-item {
          font-size: 0.8rem; color: rgba(240,236,228,0.55);
          font-weight: 300; line-height: 1.55;
          display: flex; gap: 0.625rem;
        }
        .dd-info-item::before {
          content: '·'; color: rgba(180,140,60,0.5); flex-shrink: 0;
        }

        /* Success state */
        .dd-success {
          text-align: center;
          padding: 3rem 1rem;
        }
        .dd-success-icon {
          width: 52px; height: 52px; border-radius: 50%;
          background: rgba(76,175,125,0.12);
          border: 1px solid rgba(76,175,125,0.25);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 1.5rem;
        }
        .dd-success-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.75rem; font-weight: 300;
          color: #f0ece4; margin-bottom: 0.625rem;
        }
        .dd-success-body {
          font-size: 0.875rem; color: rgba(240,236,228,0.55);
          font-weight: 300; line-height: 1.75;
          max-width: 420px; margin: 0 auto;
        }
        .dd-success-ref {
          display: inline-block; margin-top: 1.5rem;
          font-size: 0.72rem; color: rgba(180,140,60,0.7);
          background: rgba(180,140,60,0.07);
          border: 1px solid rgba(180,140,60,0.15);
          border-radius: 5px; padding: 0.4rem 0.875rem;
          letter-spacing: 0.05em;
        }

        .dd-divider {
          height: 1px; background: rgba(180,140,60,0.08);
          margin: 2.25rem 0;
        }

        .dd-back {
          display: inline-flex; align-items: center; gap: 0.4rem;
          font-size: 0.75rem; color: rgba(240,236,228,0.35);
          text-decoration: none; margin-top: 2.5rem;
          transition: color 0.2s;
        }
        .dd-back:hover { color: #b48c3c; }
      `}</style>

      <div className="dd-root">
        <Link href="/login" className="dd-nav">
          <Image src="/eflogo.png" alt="EventFlow" width={28} height={28} style={{ objectFit: "contain" }} />
          <span className="dd-nav-logo">Event<span>Flow</span></span>
        </Link>

        <div className="dd-container">
          {step === "form" ? (
            <>
              <div className="dd-eyebrow">Your Rights</div>
              <h1 className="dd-title">Request Data Deletion</h1>
              <p className="dd-subtitle">
                You have the right to ask us to delete your personal data from EventFlow. Fill in the form below and we'll process your request within 14 days. No back-and-forth, no unnecessary friction.
              </p>

              <div className="dd-info-box">
                <div className="dd-info-title">What gets deleted</div>
                <div className="dd-info-list">
                  <div className="dd-info-item">Your name, phone number, and email address</div>
                  <div className="dd-info-item">Your RSVP submission and meal preferences</div>
                  <div className="dd-info-item">Your QR code and check-in record</div>
                  <div className="dd-info-item">Any tribute message you submitted for the host</div>
                  <div className="dd-info-item">Your unique invite token, if you received a personalised link</div>
                </div>
              </div>

              {/* Role selector */}
              <div className="dd-role-toggle">
                <button
                  type="button"
                  className={`dd-role-btn${role === "guest" ? " active" : ""}`}
                  onClick={() => setRole("guest")}
                >
                  <span className="dd-role-icon">🎟️</span>
                  <span className="dd-role-label">I'm a Guest</span>
                  <span className="dd-role-desc">I RSVPed to an event and want my data removed</span>
                </button>
                <button
                  type="button"
                  className={`dd-role-btn${role === "planner" ? " active" : ""}`}
                  onClick={() => setRole("planner")}
                >
                  <span className="dd-role-icon">📋</span>
                  <span className="dd-role-label">I'm a Planner</span>
                  <span className="dd-role-desc">I have an EventFlow account and want it deleted</span>
                </button>
              </div>

              <div className="dd-form">
                <div className="dd-field">
                  <label className="dd-label">Full Name <span>*</span></label>
                  <input
                    type="text"
                    className="dd-input"
                    placeholder={role === "guest" ? "As you registered for the event" : "Your name on your account"}
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>

                <div className="dd-field">
                  <label className="dd-label">Email Address <span>*</span></label>
                  <input
                    type="email"
                    className="dd-input"
                    placeholder={role === "guest" ? "Email you used during RSVP" : "Email on your EventFlow account"}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>

                <div className="dd-field">
                  <label className="dd-label">Phone Number</label>
                  <input
                    type="tel"
                    className="dd-input"
                    placeholder="e.g. 08012345678"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                  <span className="dd-hint">Helps us locate your record faster, especially if you RSVPed with a phone number only.</span>
                </div>

                {role === "guest" && (
                  <div className="dd-field">
                    <label className="dd-label">Event Name</label>
                    <input
                      type="text"
                      className="dd-input"
                      placeholder="e.g. Tunde & Amaka's Wedding"
                      value={eventName}
                      onChange={e => setEventName(e.target.value)}
                    />
                    <span className="dd-hint">If you remember the name of the event you attended or RSVPed to.</span>
                  </div>
                )}

                <div className="dd-field">
                  <label className="dd-label">Anything else we should know?</label>
                  <textarea
                    className="dd-textarea"
                    placeholder={
                      role === "planner"
                        ? "e.g. Please delete my account and all events and guest records associated with it"
                        : "e.g. I used a different email during RSVP, or I submitted the form twice"
                    }
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                  />
                </div>

                {error && <div className="dd-error">{error}</div>}

                <button
                  type="button"
                  className="dd-submit"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? "Submitting..." : "Submit Deletion Request"}
                </button>
              </div>

              <div className="dd-divider" />

              <p style={{ fontSize: "0.78rem", color: "rgba(240,236,228,0.35)", fontWeight: 300, lineHeight: 1.65 }}>
                Questions? Email us at{" "}
                <a href="mailto:privacy@eventflowng.com" style={{ color: "#b48c3c", textDecoration: "none" }}>
                  privacy@eventflowng.com
                </a>.
                {" "}We process all requests within 14 days. For planner account deletions, all associated events, guests, and vendor records are permanently removed.
              </p>

              <Link href="/login" className="dd-back">← Back to login</Link>
            </>
          ) : (
            <div className="dd-success">
              <div className="dd-success-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="#4caf7d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h2 className="dd-success-title">Request Received</h2>
              <p className="dd-success-body">
                We've logged your deletion request and will process it within 14 days. You'll receive a confirmation at <strong style={{ color: "#e8e0d0" }}>{email}</strong> once your data has been removed. If we need anything to verify your identity, we'll reach out first.
              </p>
              <div className="dd-success-ref">
                Ref: EF-DEL-{Date.now().toString(36).toUpperCase()}
              </div>
              <div style={{ marginTop: "2.5rem" }}>
                <Link href="/login" className="dd-back" style={{ justifyContent: "center" }}>← Back to login</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
