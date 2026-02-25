"use client"

// ─────────────────────────────────────────────
// src/app/(dashboard)/events/[id]/vendors/page.tsx
// ─────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

// ── Types ──────────────────────────────────────

type VendorRole =
  | "CATERER" | "SECURITY" | "MEDIA" | "LIVE_BAND" | "DJ" | "MC"
  | "HYPEMAN" | "AFTER_PARTY" | "DECORATOR" | "PHOTOGRAPHER" | "VIDEOGRAPHER" | "OTHER"

interface Vendor {
  id:                     string
  name:                   string
  contactName:            string | null
  email:                  string | null
  phone:                  string | null
  role:                   VendorRole
  notes:                  string | null
  portalToken:            string
  lastAccessed:           string | null
  canOverrideCapacity:    boolean
  capacityOverrideActive: boolean
  createdAt:              string
}

interface EventSummary {
  id:   string
  name: string
}

const ROLE_CONFIG: Record<VendorRole, { label: string; icon: string; color: string }> = {
  CATERER:       { label: "Caterer",         icon: "🍽️", color: "#f59e0b" },
  SECURITY:      { label: "Security",        icon: "🛡️", color: "#ef4444" },
  MEDIA:         { label: "Media",           icon: "📸", color: "#3b82f6" },
  LIVE_BAND:     { label: "Live Band",       icon: "🎸", color: "#a78bfa" },
  DJ:            { label: "DJ",             icon: "🎧", color: "#ec4899" },
  MC:            { label: "MC",             icon: "🎤", color: "#f97316" },
  HYPEMAN:       { label: "Hypeman",         icon: "🔥", color: "#ef4444" },
  AFTER_PARTY:   { label: "After Party",     icon: "🎉", color: "#8b5cf6" },
  DECORATOR:     { label: "Decorator",       icon: "🌸", color: "#10b981" },
  PHOTOGRAPHER:  { label: "Photographer",   icon: "📷", color: "#3b82f6" },
  VIDEOGRAPHER:  { label: "Videographer",   icon: "🎬", color: "#6366f1" },
  OTHER:         { label: "Other",           icon: "🏢", color: "#6b7280" },
}

const ROLES = Object.entries(ROLE_CONFIG) as [VendorRole, typeof ROLE_CONFIG[VendorRole]][]

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {}
  const token = localStorage.getItem("ef-session") ?? ""
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—"

export default function VendorsPage() {
  const { id } = useParams<{ id: string }>()

  const [event,     setEvent]     = useState<EventSummary | null>(null)
  const [vendors,   setVendors]   = useState<Vendor[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState("")
  const [copiedId,  setCopiedId]  = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: "", contactName: "", email: "", phone: "",
    role: "OTHER" as VendorRole, notes: "", canOverrideCapacity: false,
  })

  // ── Load ──────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const hdrs = getAuthHeaders()
      const [evRes, vRes] = await Promise.all([
        fetch(`/api/events/${id}`,         { headers: hdrs }),
        fetch(`/api/events/${id}/vendors`, { headers: hdrs }),
      ])
      if (!evRes.ok) throw new Error("Failed to load event")
      const evData = await evRes.json()
      setEvent({ id: evData.event.id, name: evData.event.name })
      if (vRes.ok) {
        const vData = await vRes.json()
        setVendors(Array.isArray(vData) ? vData : [])
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // ── Add vendor ────────────────────────────────

  const handleAdd = async () => {
    if (!form.name.trim()) { setSaveError("Vendor name is required."); return }
    setSaving(true)
    setSaveError("")
    try {
      const res = await fetch(`/api/events/${id}/vendors`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed") }
      const { vendor } = await res.json()
      setVendors(prev => [vendor, ...prev])
      setForm({ name: "", contactName: "", email: "", phone: "", role: "OTHER", notes: "", canOverrideCapacity: false })
      setShowForm(false)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to add vendor")
    } finally {
      setSaving(false)
    }
  }

  // ── Delete vendor ─────────────────────────────

  const handleDelete = async (vendorId: string, name: string) => {
    if (!confirm(`Remove ${name} from this event?`)) return
    setDeletingId(vendorId)
    try {
      await fetch(`/api/events/${id}/vendors/${vendorId}`, { method: "DELETE", headers: getAuthHeaders() })
      setVendors(prev => prev.filter(v => v.id !== vendorId))
    } finally {
      setDeletingId(null)
    }
  }

  // ── Copy portal link ──────────────────────────

  const copyPortal = (token: string, vendorId: string) => {
    const url = `${window.location.origin}/vendor/${token}`
    navigator.clipboard.writeText(url)
    setCopiedId(vendorId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ── Loading / error ───────────────────────────

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", gap: "0.75rem" }}>
      <div style={{ width: 22, height: 22, border: "1.5px solid rgba(180,140,60,0.2)", borderTopColor: "#b48c3c", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error || !event) return (
    <div style={{ padding: "3rem", textAlign: "center" }}>
      <p style={{ color: "var(--text-2)", marginBottom: "1rem" }}>{error ?? "Event not found"}</p>
      <Link href="/events" style={{ color: "var(--gold)", textDecoration: "none" }}>← Back to events</Link>
    </div>
  )

  return (
    <>
      <style>{`
        .vp { max-width:1000px; margin:0 auto; padding:0 0 4rem; animation:vpIn 0.3s ease; }
        @keyframes vpIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:none} }
        .vp-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:2rem; flex-wrap:wrap; gap:0.75rem; }
        .vp-back { font-size:0.78rem; color:var(--text-3); text-decoration:none; display:flex; align-items:center; gap:0.35rem; transition:color 0.2s; }
        .vp-back:hover { color:var(--gold); }
        .vp-title { font-family:'Cormorant Garamond',serif; font-size:clamp(1.5rem,3vw,2.25rem); font-weight:300; color:var(--text); letter-spacing:-0.01em; margin-bottom:0.25rem; }
        .vp-sub { font-size:0.78rem; color:var(--text-3); margin-bottom:1.75rem; }
        .vp-btn { padding:0.5rem 1rem; font-family:'DM Sans',sans-serif; font-size:0.775rem; cursor:pointer; border:none; transition:all 0.2s; display:inline-flex; align-items:center; gap:0.4rem; border-radius:5px; }
        .vp-btn-gold  { background:var(--gold); color:#0a0a0a; font-weight:500; }
        .vp-btn-gold:hover:not(:disabled) { background:#c9a050; }
        .vp-btn-ghost { background:transparent; border:1px solid var(--border); color:var(--text-2); }
        .vp-btn-ghost:hover { border-color:var(--border-hover); color:var(--text); }
        .vp-btn-danger { background:transparent; border:1px solid rgba(239,68,68,0.2); color:rgba(239,68,68,0.6); font-size:0.72rem; padding:0.35rem 0.7rem; }
        .vp-btn-danger:hover:not(:disabled) { border-color:#ef4444; color:#ef4444; }
        .vp-btn-danger:disabled { opacity:0.3; cursor:not-allowed; }
        .vp-btn-copy { background:transparent; border:1px solid var(--border); color:var(--text-3); font-size:0.7rem; padding:0.35rem 0.7rem; }
        .vp-btn-copy:hover { border-color:var(--gold); color:var(--gold); }
        .vp-btn-copy.ok { border-color:#22c55e; color:#22c55e; }

        .vp-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:1rem; }

        .vp-card { background:var(--bg-2); border:1px solid var(--border); padding:1.25rem; position:relative; transition:border-color 0.2s; }
        .vp-card:hover { border-color:rgba(180,140,60,0.2); }
        .vp-card-bar { position:absolute; top:0; left:0; right:0; height:2px; border-radius:0; }

        .vp-card-head { display:flex; align-items:flex-start; gap:0.75rem; margin-bottom:1rem; }
        .vp-card-icon { width:38px; height:38px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:1.125rem; flex-shrink:0; border:1px solid; }
        .vp-card-info { flex:1; min-width:0; }
        .vp-card-name { font-size:0.9rem; font-weight:500; color:var(--text); margin-bottom:0.2rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .vp-card-role { font-size:0.62rem; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; }

        .vp-card-details { font-size:0.75rem; color:var(--text-3); display:flex; flex-direction:column; gap:0.3rem; margin-bottom:1rem; }
        .vp-card-detail { display:flex; align-items:center; gap:0.5rem; }

        .vp-portal-row { display:flex; gap:0.5rem; align-items:center; padding:0.625rem 0.75rem; background:var(--bg); border:1px solid var(--border); margin-bottom:0.75rem; }
        .vp-portal-url { flex:1; font-size:0.68rem; color:var(--text-3); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-family:monospace; }

        .vp-card-actions { display:flex; gap:0.5rem; justify-content:flex-end; }

        .vp-override-badge { display:inline-flex; align-items:center; gap:0.35rem; font-size:0.6rem; font-weight:500; letter-spacing:0.08em; text-transform:uppercase; padding:0.2rem 0.55rem; border-radius:99px; border:1px solid rgba(239,68,68,0.25); color:#ef4444; background:rgba(239,68,68,0.08); margin-bottom:0.75rem; }

        .vp-empty { padding:4rem 2rem; text-align:center; border:1px solid var(--border); background:var(--bg-2); }
        .vp-empty-icon { font-size:2.5rem; margin-bottom:1rem; opacity:0.4; }
        .vp-empty-title { font-size:0.925rem; color:var(--text-2); margin-bottom:0.5rem; }
        .vp-empty-sub { font-size:0.78rem; color:var(--text-3); line-height:1.6; }

        .vp-info-box { padding:0.875rem 1rem; background:rgba(180,140,60,0.04); border:1px solid rgba(180,140,60,0.15); font-size:0.78rem; color:rgba(180,140,60,0.8); line-height:1.6; margin-bottom:1.75rem; }
        .vp-info-box strong { color:#b48c3c; }

        .vp-form-card { background:var(--bg-2); border:1px solid var(--border); padding:1.5rem; margin-bottom:1.75rem; max-width:600px; }
        .vp-form-title { font-size:0.6rem; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--gold); margin-bottom:1.25rem; }
        .vp-field { margin-bottom:1.125rem; }
        .vp-label { display:block; font-size:0.72rem; font-weight:500; color:var(--text-2); letter-spacing:0.03em; margin-bottom:0.4rem; }
        .vp-req { color:var(--gold); margin-left:2px; }
        .vp-input, .vp-sel, .vp-textarea { width:100%; padding:0.6rem 0.875rem; background:var(--bg-3); border:1px solid var(--border); border-radius:5px; color:var(--text); font-family:'DM Sans',sans-serif; font-size:0.825rem; outline:none; box-sizing:border-box; transition:border-color 0.15s; }
        .vp-input:focus, .vp-sel:focus, .vp-textarea:focus { border-color:var(--gold); }
        .vp-textarea { resize:vertical; min-height:70px; line-height:1.6; }
        .vp-sel option { background:var(--bg-2); }
        .vp-row2 { display:grid; grid-template-columns:1fr 1fr; gap:0.875rem; }
        @media(max-width:480px) { .vp-row2 { grid-template-columns:1fr; } }
        .vp-switch-row { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; padding:0.875rem 1rem; background:var(--bg-3); border:1px solid var(--border); border-radius:5px; }
        .vp-switch-info { flex:1; }
        .vp-switch-title { font-size:0.8rem; font-weight:500; color:var(--text); margin-bottom:0.2rem; }
        .vp-switch-desc { font-size:0.7rem; color:var(--text-3); line-height:1.5; font-weight:300; }
        .vp-switch { width:38px; height:21px; border-radius:11px; background:var(--bg); border:1.5px solid var(--border); cursor:pointer; flex-shrink:0; position:relative; transition:all 0.2s; }
        .vp-switch.on { background:var(--gold); border-color:var(--gold); }
        .vp-switch-thumb { position:absolute; top:2px; left:2px; width:13px; height:13px; border-radius:50%; background:var(--text-3); transition:all 0.2s; }
        .vp-switch.on .vp-switch-thumb { left:19px; background:#0a0a0a; }
        .vp-form-error { font-size:0.75rem; color:#ef4444; margin-top:0.75rem; padding:0.6rem 0.875rem; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); border-radius:4px; }
        .vp-form-actions { display:flex; gap:0.625rem; margin-top:1.25rem; }
      `}</style>

      <div className="vp">
        <div className="vp-top">
          <Link href={`/events/${id}`} className="vp-back">← {event.name}</Link>
          <button className="vp-btn vp-btn-gold" onClick={() => setShowForm(v => !v)}>
            {showForm ? "Cancel" : "+ Add Vendor"}
          </button>
        </div>

        <h1 className="vp-title">Vendors</h1>
        <p className="vp-sub">{event.name}</p>

        <div className="vp-info-box">
          <strong>🔒 Privacy protected —</strong> Vendors never see guest names or personal details. Their portal shows only headcounts, meal tallies (caterers), and check-in progress.
        </div>

        {showForm && (
          <div className="vp-form-card">
            <div className="vp-form-title">Add Vendor</div>
            <div className="vp-row2">
              <div className="vp-field">
                <label className="vp-label">Vendor / Company Name <span className="vp-req">*</span></label>
                <input className="vp-input" placeholder="e.g. Lagos Catering Co." value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="vp-field">
                <label className="vp-label">Role</label>
                <select className="vp-sel" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as VendorRole }))}>
                  {ROLES.map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
            </div>
            <div className="vp-row2">
              <div className="vp-field">
                <label className="vp-label">Contact Name</label>
                <input className="vp-input" placeholder="e.g. Chidi Obi" value={form.contactName} onChange={e => setForm(p => ({ ...p, contactName: e.target.value }))} />
              </div>
              <div className="vp-field">
                <label className="vp-label">Phone</label>
                <input className="vp-input" placeholder="e.g. 08012345678" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
            <div className="vp-field">
              <label className="vp-label">Email</label>
              <input type="email" className="vp-input" placeholder="vendor@example.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="vp-field">
              <label className="vp-label">Notes</label>
              <textarea className="vp-textarea" placeholder="Any special instructions or notes for this vendor…" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="vp-switch-row">
              <div className="vp-switch-info">
                <div className="vp-switch-title">Allow capacity override</div>
                <div className="vp-switch-desc">Lets this vendor (e.g. security) admit walk-ins after the RSVP cap is reached.</div>
              </div>
              <div className={`vp-switch${form.canOverrideCapacity ? " on" : ""}`} onClick={() => setForm(p => ({ ...p, canOverrideCapacity: !p.canOverrideCapacity }))}>
                <div className="vp-switch-thumb" />
              </div>
            </div>
            {saveError && <div className="vp-form-error">{saveError}</div>}
            <div className="vp-form-actions">
              <button className="vp-btn vp-btn-gold" onClick={handleAdd} disabled={saving}>{saving ? "Saving…" : "Add Vendor"}</button>
              <button className="vp-btn vp-btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        )}

        {vendors.length === 0 ? (
          <div className="vp-empty">
            <div className="vp-empty-icon">🏢</div>
            <div className="vp-empty-title">No vendors yet</div>
            <div className="vp-empty-sub">Add your caterer, security, DJ, and other service providers. Each vendor gets a private portal link with only the information they need.</div>
          </div>
        ) : (
          <div className="vp-grid">
            {vendors.map(v => {
              const cfg = ROLE_CONFIG[v.role]
              const portalUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/vendor/${v.portalToken}`
              return (
                <div className="vp-card" key={v.id}>
                  <div className="vp-card-bar" style={{ background: cfg.color }} />
                  <div className="vp-card-head">
                    <div className="vp-card-icon" style={{ background: cfg.color + "18", borderColor: cfg.color + "40", color: cfg.color }}>
                      {cfg.icon}
                    </div>
                    <div className="vp-card-info">
                      <div className="vp-card-name">{v.name}</div>
                      <div className="vp-card-role" style={{ color: cfg.color }}>{cfg.label}</div>
                    </div>
                  </div>

                  <div className="vp-card-details">
                    {v.contactName && <div className="vp-card-detail">👤 {v.contactName}</div>}
                    {v.phone       && <div className="vp-card-detail">📞 {v.phone}</div>}
                    {v.email       && <div className="vp-card-detail">✉️ {v.email}</div>}
                    {v.lastAccessed && <div className="vp-card-detail" style={{ color: "#22c55e" }}>✓ Last accessed {fmtDate(v.lastAccessed)}</div>}
                    {!v.lastAccessed && <div className="vp-card-detail">Portal not yet accessed</div>}
                  </div>

                  {v.canOverrideCapacity && (
                    <div className="vp-override-badge">⚡ Can override capacity</div>
                  )}

                  <div className="vp-portal-row">
                    <div className="vp-portal-url">{portalUrl}</div>
                    <button className={`vp-btn vp-btn-copy${copiedId === v.id ? " ok" : ""}`} onClick={() => copyPortal(v.portalToken, v.id)}>
                      {copiedId === v.id ? "✓" : "Copy"}
                    </button>
                  </div>

                  <div className="vp-card-actions">
                    {v.notes && <span style={{ flex: 1, fontSize: "0.7rem", color: "var(--text-3)", fontStyle: "italic", alignSelf: "center" }}>Has notes</span>}
                    <button className="vp-btn vp-btn-danger" onClick={() => handleDelete(v.id, v.name)} disabled={deletingId === v.id}>
                      {deletingId === v.id ? "…" : "Remove"}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
