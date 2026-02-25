"use client"

// ─────────────────────────────────────────────
// src/components/PostPublishChecklist.tsx
//
// Shown immediately after a planner publishes
// an event for the first time.
//
// Steps:
//   ✓ Event published          (auto complete)
//   ○ Connect WhatsApp         (opens WASetupModal)
//   ○ Add your guests          (links to guests page)
//   ○ Send invites             (links to guests page)
//
// Dismissed by clicking "Got it" or the X.
// State not persisted — shown once per publish.
// ─────────────────────────────────────────────

import { useState, useEffect } from "react"
import WhatsAppSetupModal from "./WhatsAppSetupModal"

interface Props {
  eventId:       string
  eventName:     string
  waConnected:   boolean
  guestCount:    number
  onClose:       () => void
}

export default function PostPublishChecklist({
  eventId,
  eventName,
  waConnected: initialWaConnected,
  guestCount,
  onClose,
}: Props) {
  const [waConnected,    setWaConnected]    = useState(initialWaConnected)
  const [showWAModal,    setShowWAModal]    = useState(false)
  const [waDisplayName,  setWaDisplayName]  = useState("")

  // Trap body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && !showWAModal) onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose, showWAModal])

  const steps = [
    {
      id:       "published",
      icon:     "🎉",
      title:    "Event published",
      desc:     `${eventName} is live and ready.`,
      done:     true,
      action:   null,
    },
    {
      id:       "whatsapp",
      icon:     "📲",
      title:    waConnected ? "WhatsApp connected" : "Connect WhatsApp",
      desc:     waConnected
        ? `Invites will send from ${waDisplayName || "your business number"}.`
        : "Required to send invites to your guests via WhatsApp.",
      done:     waConnected,
      action:   waConnected ? null : () => setShowWAModal(true),
      cta:      "Connect now →",
    },
    {
      id:       "guests",
      icon:     "👥",
      title:    guestCount > 0 ? `${guestCount} guests added` : "Add your guests",
      desc:     guestCount > 0
        ? "You can add more or import a CSV anytime."
        : "Add guests manually, upload a CSV, or sync a Google Sheet.",
      done:     guestCount > 0,
      action:   () => { onClose(); window.location.href = `/events/${eventId}/guests` },
      cta:      "Add guests →",
    },
    {
      id:       "invites",
      icon:     "✉️",
      title:    "Send invites",
      desc:     "Send personalised WhatsApp invites to all guests at once.",
      done:     false,
      action:   () => { onClose(); window.location.href = `/events/${eventId}/guests` },
      cta:      "Go to guests →",
    },
  ]

  const allDone = waConnected && guestCount > 0

  return (
    <>
      <style>{`
        .ppc-overlay {
          position: fixed; inset: 0; z-index: 999;
          background: rgba(0,0,0,0.7);
          display: flex; align-items: center; justify-content: center;
          padding: 1rem;
          animation: ppcFade 0.2s ease;
        }
        @keyframes ppcFade { from { opacity:0 } to { opacity:1 } }

        .ppc {
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-radius: 10px;
          width: 100%; max-width: 440px;
          animation: ppcUp 0.25s ease;
          overflow: hidden;
        }
        @keyframes ppcUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:none } }

        .ppc-header {
          padding: 1.375rem 1.5rem;
          border-bottom: 1px solid var(--border);
          display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
        }
        .ppc-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.25rem; font-weight: 300;
          color: var(--text); letter-spacing: -0.01em;
          margin-bottom: 0.2rem;
        }
        .ppc-sub { font-size: 0.75rem; color: var(--text-3); }
        .ppc-close {
          width: 26px; height: 26px; border-radius: 50%;
          background: transparent; border: 1px solid var(--border);
          color: var(--text-3); font-size: 0.9rem; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: all 0.15s;
        }
        .ppc-close:hover { border-color: var(--border-hover); color: var(--text); }

        .ppc-steps { padding: 0.75rem 0; }

        .ppc-step {
          display: flex; align-items: center; gap: 1rem;
          padding: 0.875rem 1.5rem;
          border-bottom: 1px solid var(--border);
          transition: background 0.15s;
        }
        .ppc-step:last-child { border-bottom: none; }
        .ppc-step.clickable { cursor: pointer; }
        .ppc-step.clickable:hover { background: rgba(180,140,60,0.04); }

        .ppc-step-icon {
          width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 1rem; flex-shrink: 0;
        }
        .ppc-step-icon.done { background: rgba(34,197,94,0.1); }
        .ppc-step-icon.todo { background: var(--bg-3); border: 1px solid var(--border); }

        .ppc-step-body { flex: 1; min-width: 0; }
        .ppc-step-title {
          font-size: 0.825rem; font-weight: 500;
          color: var(--text); margin-bottom: 0.15rem;
          display: flex; align-items: center; gap: 0.5rem;
        }
        .ppc-step-title.done { color: var(--text-2); }
        .ppc-check { color: #22c55e; font-size: 0.75rem; }
        .ppc-step-desc { font-size: 0.72rem; color: var(--text-3); line-height: 1.5; }
        .ppc-step-cta { font-size: 0.72rem; color: var(--gold); font-weight: 500; margin-top: 0.2rem; }

        .ppc-arrow { color: var(--text-3); font-size: 0.8rem; flex-shrink: 0; transition: transform 0.15s; }
        .ppc-step.clickable:hover .ppc-arrow { transform: translateX(3px); color: var(--gold); }

        .ppc-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--border);
          display: flex; gap: 0.625rem;
        }
        .ppc-btn-gold {
          flex: 1; padding: 0.65rem;
          background: var(--gold); color: #0a0a0a;
          font-family: 'DM Sans', sans-serif; font-size: 0.8rem; font-weight: 500;
          border: none; border-radius: 5px; cursor: pointer; transition: background 0.2s;
        }
        .ppc-btn-gold:hover { background: #c9a050; }
        .ppc-btn-ghost {
          padding: 0.65rem 1rem;
          background: transparent; border: 1px solid var(--border);
          color: var(--text-2); font-family: 'DM Sans', sans-serif;
          font-size: 0.8rem; border-radius: 5px; cursor: pointer; transition: all 0.2s;
        }
        .ppc-btn-ghost:hover { border-color: var(--border-hover); color: var(--text); }

        .ppc-progress {
          height: 2px;
          background: var(--border);
          margin: 0 1.5rem 0;
          border-radius: 99px;
          overflow: hidden;
        }
        .ppc-progress-bar {
          height: 100%;
          background: var(--gold);
          border-radius: 99px;
          transition: width 0.4s ease;
        }
      `}</style>

      <div className="ppc-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="ppc">

          {/* Header */}
          <div className="ppc-header">
            <div>
              <div className="ppc-title">Event published 🎉</div>
              <div className="ppc-sub">Complete these steps to get your event running.</div>
            </div>
            <button className="ppc-close" onClick={onClose}>✕</button>
          </div>

          {/* Progress bar */}
          <div style={{ padding: "0.875rem 1.5rem 0" }}>
            <div className="ppc-progress">
              <div
                className="ppc-progress-bar"
                style={{ width: `${(steps.filter(s => s.done).length / steps.length) * 100}%` }}
              />
            </div>
            <div style={{ fontSize: "0.65rem", color: "var(--text-3)", marginTop: "0.375rem", letterSpacing: "0.05em" }}>
              {steps.filter(s => s.done).length} of {steps.length} complete
            </div>
          </div>

          {/* Steps */}
          <div className="ppc-steps">
            {steps.map(step => (
              <div
                key={step.id}
                className={`ppc-step${step.action ? " clickable" : ""}`}
                onClick={step.action ?? undefined}
              >
                <div className={`ppc-step-icon ${step.done ? "done" : "todo"}`}>
                  {step.icon}
                </div>
                <div className="ppc-step-body">
                  <div className={`ppc-step-title${step.done ? " done" : ""}`}>
                    {step.title}
                    {step.done && <span className="ppc-check">✓</span>}
                  </div>
                  <div className="ppc-step-desc">{step.desc}</div>
                  {!step.done && step.cta && (
                    <div className="ppc-step-cta">{step.cta}</div>
                  )}
                </div>
                {step.action && <span className="ppc-arrow">→</span>}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="ppc-footer">
            <button
              className="ppc-btn-gold"
              onClick={() => { onClose(); window.location.href = `/events/${eventId}/guests` }}
            >
              {allDone ? "Go to guests" : "Go to guests →"}
            </button>
            <button className="ppc-btn-ghost" onClick={onClose}>
              Later
            </button>
          </div>

        </div>
      </div>

      {/* WhatsApp setup modal — triggered from checklist */}
      {showWAModal && (
        <WhatsAppSetupModal
          onConnected={(name) => {
            setWaConnected(true)
            setWaDisplayName(name)
            setShowWAModal(false)
          }}
          onClose={() => setShowWAModal(false)}
        />
      )}
    </>
  )
}
