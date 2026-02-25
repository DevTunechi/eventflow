"use client"

// ─────────────────────────────────────────────
// src/app/(dashboard)/events/[id]/ushers/page.tsx
// ─────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

type UsherRole = "MAIN" | "FLOOR"

interface Usher {
  id:          string
  name:        string
  phone:       string | null
  role:        UsherRole
  accessToken: string
  isActive:    boolean
  createdAt:   string
}

interface EventSummary { id: string; name: string }

const ROLE_CONFIG: Record<UsherRole, { label: string; icon: string; color: string; desc: string }> = {
  MAIN:  { label: "Main",  icon: "🔍", color: "#f59e0b", desc: "Scans QR codes at the gate" },
  FLOOR: { label: "Floor", icon: "🎯", color: "#b48c3c", desc: "Walks guests to their table" },
}

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {}
  const token = localStorage.getItem("ef-session") ?? ""
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function UshersPage() {
  const { id } = useParams<{ id: string }>()

  const [event,      setEvent]      = useState<EventSummary | null>(null)
  const [ushers,     setUshers]     = useState<Usher[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState("")
  const [copiedId,   setCopiedId]   = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [form, setForm] = useState({ name: "", phone: "", role: "FLOOR" as UsherRole })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const hdrs = getAuthHeaders()
      const [evRes, uRes] = await Promise.all([
        fetch(`/api/events/${id}`,        { headers: hdrs }),
        fetch(`/api/events/${id}/ushers`, { headers: hdrs }),
      ])
      if (!evRes.ok) throw new Error("Failed to load event")
      const evData = await evRes.json()
      setEvent({ id: evData.event.id, name: evData.event.name })
      if (uRes.ok) {
        const uData = await uRes.json()
        setUshers(Array.isArray(uData) ? uData : [])
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!form.name.trim()) { setSaveError("Usher name is required."); return }
    setSaving(true)
    setSaveError("")
    try {
      const res = await fetch(`/api/events/${id}/ushers`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed") }
      const { usher } = await res.json()
      setUshers(prev => [usher, ...prev])
      setForm({ name: "", phone: "", role: "FLOOR" })
      setShowForm(false)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to add usher")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (usherId: string, name: string) => {
    if (!confirm(`Remove ${name} from this event?`)) return
    setDeletingId(usherId)
    try {
      await fetch(`/api/events/${id}/ushers/${usherId}`, { method: "DELETE", headers: getAuthHeaders() })
      setUshers(prev => prev.filter(u => u.id !== usherId))
    } finally {
      setDeletingId(null)
    }
  }

  const copyAccess = (token: string, usherId: string) => {
    const url = `${window.location.origin}/usher/${token}`
    navigator.clipboard.writeText(url)
    setCopiedId(usherId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const mainUshers  = ushers.filter(u => u.role === "MAIN")
  const floorUshers = ushers.filter(u => u.role === "FLOOR")

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

  const UshersGroup = ({ title, list, role }: { title: string; list: Usher[]; role: UsherRole }) => {
    const cfg = ROLE_CONFIG[role]
    return (
      <div className="up-group">
        <div className="up-group-header">
          <span>{cfg.icon}</span>
          <div>
            <div className="up-group-title">{title}</div>
            <div className="up-group-desc">{cfg.desc}</div>
          </div>
          <span className="up-group-count">{list.length}</span>
        </div>
        {list.length === 0 ? (
          <div className="up-group-empty">No {title.toLowerCase()} added yet</div>
        ) : (
          <div className="up-list">
            {list.map(u => {
              const accessUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/usher/${u.accessToken}`
              return (
                <div className="up-item" key={u.id}>
                  <div className="up-item-avatar" style={{ background: cfg.color + "20", border: `1.5px solid ${cfg.color}40`, color: cfg.color }}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="up-item-info">
                    <div className="up-item-name">{u.name}</div>
                    <div className="up-item-phone">{u.phone ?? "No phone added"}</div>
                  </div>
                  <div className="up-item-right">
                    <div className="up-access-row">
                      <div className="up-access-url">{accessUrl}</div>
                      <button
                        className={`up-btn up-btn-copy${copiedId === u.id ? " ok" : ""}`}
                        onClick={() => copyAccess(u.accessToken, u.id)}
                      >
                        {copiedId === u.id ? "✓" : "Copy"}
                      </button>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.4rem" }}>
                      <button
                        className="up-btn up-btn-danger"
                        onClick={() => handleDelete(u.id, u.name)}
                        disabled={deletingId === u.id}
                      >
                        {deletingId === u.id ? "…" : "Remove"}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <style>{`
        .up { max-width:900px; margin:0 auto; padding:0 0 4rem; animation:upIn 0.3s ease; }
        @keyframes upIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:none} }
        .up-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:2rem; flex-wrap:wrap; gap:0.75rem; }
        .up-back { font-size:0.78rem; color:var(--text-3); text-decoration:none; display:flex; align-items:center; gap:0.35rem; transition:color 0.2s; }
        .up-back:hover { color:var(--gold); }
        .up-title { font-family:'Cormorant Garamond',serif; font-size:clamp(1.5rem,3vw,2.25rem); font-weight:300; color:var(--text); letter-spacing:-0.01em; margin-bottom:0.25rem; }
        .up-sub { font-size:0.78rem; color:var(--text-3); margin-bottom:1.75rem; }

        .up-info-box { padding:0.875rem 1rem; background:rgba(180,140,60,0.04); border:1px solid rgba(180,140,60,0.15); font-size:0.78rem; color:rgba(180,140,60,0.8); line-height:1.65; margin-bottom:1.75rem; }
        .up-info-box strong { color:#b48c3c; }

        .up-form-card { background:var(--bg-2); border:1px solid var(--border); padding:1.5rem; margin-bottom:1.75rem; max-width:540px; }
        .up-form-title { font-size:0.6rem; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--gold); margin-bottom:1.25rem; }
        .up-field { margin-bottom:1.125rem; }
        .up-label { display:block; font-size:0.72rem; font-weight:500; color:var(--text-2); letter-spacing:0.03em; margin-bottom:0.4rem; }
        .up-req { color:var(--gold); margin-left:2px; }
        .up-input, .up-sel { width:100%; padding:0.6rem 0.875rem; background:var(--bg-3); border:1px solid var(--border); border-radius:5px; color:var(--text); font-family:'DM Sans',sans-serif; font-size:0.825rem; outline:none; box-sizing:border-box; transition:border-color 0.15s; }
        .up-input:focus, .up-sel:focus { border-color:var(--gold); }
        .up-sel option { background:var(--bg-2); }
        .up-row2 { display:grid; grid-template-columns:1fr 1fr; gap:0.875rem; }
        @media(max-width:480px) { .up-row2 { grid-template-columns:1fr; } }
        .up-role-grid { display:grid; grid-template-columns:1fr 1fr; gap:0.625rem; }
        .up-role-opt { padding:0.875rem 1rem; border:1.5px solid var(--border); border-radius:6px; cursor:pointer; transition:all 0.2s; background:transparent; text-align:left; }
        .up-role-opt:hover { border-color:rgba(180,140,60,0.35); }
        .up-role-opt.on { border-color:rgba(180,140,60,0.5); background:rgba(180,140,60,0.06); }
        .up-role-icon { font-size:1.25rem; margin-bottom:0.375rem; display:block; }
        .up-role-label { font-size:0.8rem; font-weight:500; color:var(--text); display:block; margin-bottom:0.2rem; }
        .up-role-desc { font-size:0.68rem; color:var(--text-3); line-height:1.4; font-weight:300; }
        .up-role-opt.on .up-role-desc { color:rgba(240,236,228,0.5); }
        .up-form-error { font-size:0.75rem; color:#ef4444; margin-top:0.75rem; padding:0.6rem 0.875rem; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); border-radius:4px; }
        .up-form-actions { display:flex; gap:0.625rem; margin-top:1.25rem; }

        .up-btn { padding:0.5rem 1rem; font-family:'DM Sans',sans-serif; font-size:0.775rem; cursor:pointer; border:none; transition:all 0.2s; display:inline-flex; align-items:center; gap:0.4rem; border-radius:5px; }
        .up-btn-gold  { background:var(--gold); color:#0a0a0a; font-weight:500; }
        .up-btn-gold:hover:not(:disabled) { background:#c9a050; }
        .up-btn-ghost { background:transparent; border:1px solid var(--border); color:var(--text-2); }
        .up-btn-ghost:hover { border-color:var(--border-hover); color:var(--text); }
        .up-btn-copy { background:transparent; border:1px solid var(--border); color:var(--text-3); font-size:0.7rem; padding:0.3rem 0.65rem; }
        .up-btn-copy:hover { border-color:var(--gold); color:var(--gold); }
        .up-btn-copy.ok { border-color:#22c55e; color:#22c55e; }
        .up-btn-danger { background:transparent; border:1px solid rgba(239,68,68,0.2); color:rgba(239,68,68,0.6); font-size:0.7rem; padding:0.3rem 0.65rem; }
        .up-btn-danger:hover:not(:disabled) { border-color:#ef4444; color:#ef4444; }
        .up-btn-danger:disabled { opacity:0.3; cursor:not-allowed; }

        .up-group { margin-bottom:2rem; }
        .up-group-header { display:flex; align-items:center; gap:0.875rem; padding:0.875rem 1rem; background:var(--bg-2); border:1px solid var(--border); border-bottom:none; }
        .up-group-title { font-size:0.82rem; font-weight:500; color:var(--text); margin-bottom:0.1rem; }
        .up-group-desc { font-size:0.7rem; color:var(--text-3); }
        .up-group-count { margin-left:auto; font-size:0.7rem; color:var(--text-3); padding:0.2rem 0.55rem; border:1px solid var(--border); }
        .up-group-empty { padding:1.5rem; text-align:center; font-size:0.8rem; color:var(--text-3); border:1px solid var(--border); background:var(--bg-2); font-style:italic; }

        .up-list { border:1px solid var(--border); background:var(--bg-2); }
        .up-item { display:flex; align-items:flex-start; gap:0.875rem; padding:1rem; border-bottom:1px solid var(--border); }
        .up-item:last-child { border-bottom:none; }
        .up-item-avatar { width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.85rem; font-weight:600; flex-shrink:0; }
        .up-item-info { flex:1; min-width:0; padding-top:0.1rem; }
        .up-item-name { font-size:0.875rem; font-weight:500; color:var(--text); margin-bottom:0.2rem; }
        .up-item-phone { font-size:0.72rem; color:var(--text-3); }
        .up-item-right { min-width:0; flex:1; }
        .up-access-row { display:flex; gap:0.5rem; align-items:center; padding:0.5rem 0.75rem; background:var(--bg); border:1px solid var(--border); }
        .up-access-url { flex:1; font-size:0.66rem; color:var(--text-3); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-family:monospace; }

        .up-empty { padding:4rem 2rem; text-align:center; border:1px solid var(--border); background:var(--bg-2); }
        .up-empty-icon { font-size:2.5rem; margin-bottom:1rem; opacity:0.4; }
        .up-empty-title { font-size:0.925rem; color:var(--text-2); margin-bottom:0.5rem; }
        .up-empty-sub { font-size:0.78rem; color:var(--text-3); line-height:1.65; }
      `}</style>

      <div className="up">
        <div className="up-top">
          <Link href={`/events/${id}`} className="up-back">← {event.name}</Link>
          <button className="up-btn up-btn-gold" onClick={() => setShowForm(v => !v)}>
            {showForm ? "Cancel" : "+ Add Usher"}
          </button>
        </div>

        <h1 className="up-title">Ushers</h1>
        <p className="up-sub">{event.name}</p>

        <div className="up-info-box">
          <strong>Two usher roles —</strong> Main ushers scan QR codes at the gate and transfer guests. Floor ushers receive the transfer and walk each guest to their assigned table. Each usher gets a private access link — share it with them on event day.
        </div>

        {showForm && (
          <div className="up-form-card">
            <div className="up-form-title">Add Usher</div>
            <div className="up-row2">
              <div className="up-field">
                <label className="up-label">Full Name <span className="up-req">*</span></label>
                <input className="up-input" placeholder="e.g. Emeka Nwosu" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="up-field">
                <label className="up-label">Phone Number</label>
                <input className="up-input" placeholder="e.g. 08012345678" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
            <div className="up-field">
              <label className="up-label">Role</label>
              <div className="up-role-grid">
                {(["MAIN", "FLOOR"] as UsherRole[]).map(r => {
                  const cfg = ROLE_CONFIG[r]
                  return (
                    <button
                      key={r}
                      type="button"
                      className={`up-role-opt${form.role === r ? " on" : ""}`}
                      onClick={() => setForm(p => ({ ...p, role: r }))}
                    >
                      <span className="up-role-icon">{cfg.icon}</span>
                      <span className="up-role-label">{cfg.label} Usher</span>
                      <span className="up-role-desc">{cfg.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            {saveError && <div className="up-form-error">{saveError}</div>}
            <div className="up-form-actions">
              <button className="up-btn up-btn-gold" onClick={handleAdd} disabled={saving}>{saving ? "Saving…" : "Add Usher"}</button>
              <button className="up-btn up-btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        )}

        {ushers.length === 0 && !showForm ? (
          <div className="up-empty">
            <div className="up-empty-icon">🎯</div>
            <div className="up-empty-title">No ushers added yet</div>
            <div className="up-empty-sub">Add your gate and floor ushers. Each gets a private access link for the scanning interface — share it on event day.</div>
          </div>
        ) : (
          <>
            <UshersGroup title="Main Ushers (Gate)"  list={mainUshers}  role="MAIN"  />
            <UshersGroup title="Floor Ushers"        list={floorUshers} role="FLOOR" />
          </>
        )}
      </div>
    </>
  )
}
