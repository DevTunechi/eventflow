// src/components/UpgradePrompt.tsx
// Reusable upgrade banner/modal shown when a planner
// hits a plan limit. Used across the dashboard.
//
// Usage:
//   <UpgradePrompt
//     reason="Your Free plan allows 1 active event."
//     hint="Upgrade to Starter for up to 3 events."
//     onDismiss={() => setShowPrompt(false)}
//   />

"use client"

import { useRouter } from "next/navigation"

interface UpgradePromptProps {
  reason:      string
  hint?:       string
  hardBlocked?: boolean   // if true, can't dismiss — must upgrade or go back
  onDismiss?:  () => void
}

export function UpgradePrompt({
  reason,
  hint,
  hardBlocked = false,
  onDismiss,
}: UpgradePromptProps) {
  const router = useRouter()

  return (
    <>
      <style>{`
        .up-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100;display:flex;align-items:center;justify-content:center;padding:1.25rem;backdrop-filter:blur(2px)}
        .up-modal{background:var(--bg-2);border:1px solid var(--border);max-width:420px;width:100%;padding:1.5rem;animation:upIn 0.2s ease}
        @keyframes upIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .up-icon{font-size:1.5rem;margin-bottom:0.875rem}
        .up-title{font-family:'Cormorant Garamond',serif;font-size:1.25rem;font-weight:300;color:var(--text);margin-bottom:0.5rem}
        .up-reason{font-size:0.8rem;color:var(--text-2);line-height:1.6;margin-bottom:0.375rem}
        .up-hint{font-size:0.78rem;color:var(--gold);line-height:1.6;margin-bottom:1.25rem}
        .up-actions{display:flex;gap:0.625rem;flex-wrap:wrap}
        .up-btn-gold{flex:1;padding:0.625rem 1rem;background:var(--gold);color:#0a0a0a;border:none;font-family:'DM Sans',sans-serif;font-size:0.75rem;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;cursor:pointer;white-space:nowrap}
        .up-btn-ghost{padding:0.625rem 1rem;background:transparent;border:1px solid var(--border);color:var(--text-2);font-family:'DM Sans',sans-serif;font-size:0.75rem;cursor:pointer;transition:all 0.2s;white-space:nowrap}
        .up-btn-ghost:hover{border-color:var(--border-hover);color:var(--text)}
      `}</style>
      <div className="up-overlay" onClick={hardBlocked ? undefined : onDismiss}>
        <div className="up-modal" onClick={e => e.stopPropagation()}>
          <div className="up-icon">⚡</div>
          <div className="up-title">Plan limit reached</div>
          <div className="up-reason">{reason}</div>
          {hint && <div className="up-hint">{hint}</div>}
          <div className="up-actions">
            <button
              className="up-btn-gold"
              onClick={() => router.push("/dashboard/settings/billing")}
            >
              View plans →
            </button>
            {!hardBlocked && onDismiss && (
              <button className="up-btn-ghost" onClick={onDismiss}>
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Inline banner variant (non-modal) ────────────────────────
// Used inside pages instead of a modal overlay

interface UpgradeBannerProps {
  reason:  string
  hint?:   string
}

export function UpgradeBanner({ reason, hint }: UpgradeBannerProps) {
  const router = useRouter()
  return (
    <>
      <style>{`
        .ub-wrap{padding:0.875rem 1rem;background:rgba(180,140,60,0.06);border:1px solid rgba(180,140,60,0.25);display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:1rem}
        .ub-text{flex:1;min-width:0}
        .ub-reason{font-size:0.78rem;color:var(--text-2);margin-bottom:0.2rem;line-height:1.5}
        .ub-hint{font-size:0.72rem;color:var(--gold);line-height:1.5}
        .ub-btn{padding:0.45rem 0.875rem;background:var(--gold);color:#0a0a0a;border:none;font-family:'DM Sans',sans-serif;font-size:0.7rem;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;cursor:pointer;flex-shrink:0;white-space:nowrap}
      `}</style>
      <div className="ub-wrap">
        <div className="ub-text">
          <div className="ub-reason">⚡ {reason}</div>
          {hint && <div className="ub-hint">{hint}</div>}
        </div>
        <button className="ub-btn" onClick={() => router.push("/dashboard/settings/billing")}>
          Upgrade →
        </button>
      </div>
    </>
  )
}
