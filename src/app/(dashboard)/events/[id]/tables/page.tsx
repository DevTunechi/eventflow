"use client"

// ─────────────────────────────────────────────
// src/app/(dashboard)/events/[id]/tables/page.tsx
// ─────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

interface GuestTier { id: string; name: string; color: string | null }

interface Table {
  id:                 string
  tableNumber:        number
  label:             string | null
  capacity:          number
  currentOccupancy:  number
  reservedForTierId: string | null
  reservedForTier:   GuestTier | null
  isReleased:        boolean
  releasedAt:        string | null
  createdAt:         string
}

interface EventDetail {
  id:           string
  name:         string
  totalTables:  number | null
  seatsPerTable: number | null
  guestTiers:   GuestTier[]
}

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {}
  const token = localStorage.getItem("ef-session") ?? ""
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function TablesPage() {
  const { id } = useParams<{ id: string }>()

  const [event,      setEvent]      = useState<EventDetail | null>(null)
  const [tables,     setTables]     = useState<Table[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bulkCount,  setBulkCount]  = useState("")
  const [bulkSeats,  setBulkSeats]  = useState("")
  const [bulkMode,   setBulkMode]   = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)

  const [form, setForm] = useState({
    tableNumber: "", label: "", capacity: "10", reservedForTierId: "",
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const hdrs = getAuthHeaders()
      const [evRes, tRes] = await Promise.all([
        fetch(`/api/events/${id}`,        { headers: hdrs }),
        fetch(`/api/events/${id}/tables`, { headers: hdrs }),
      ])
      if (!evRes.ok) throw new Error("Failed to load event")
      const evData = await evRes.json()
      const ev = evData.event
      setEvent({
        id:           ev.id,
        name:         ev.name,
        totalTables:  ev.totalTables,
        seatsPerTable: ev.seatsPerTable,
        guestTiers:   ev.guestTiers ?? [],
      })
      if (tRes.ok) {
        const tData = await tRes.json()
        setTables(Array.isArray(tData) ? tData : [])
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!form.tableNumber.trim()) { setSaveError("Table number is required."); return }
    setSaving(true)
    setSaveError("")
    try {
      const res = await fetch(`/api/events/${id}/tables`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify({
          tableNumber:       parseInt(form.tableNumber),
          label:             form.label.trim() || null,
          capacity:          parseInt(form.capacity) || 10,
          reservedForTierId: form.reservedForTierId || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed") }
      const { table } = await res.json()
      setTables(prev => [...prev, table].sort((a, b) => a.tableNumber - b.tableNumber))
      setForm({ tableNumber: "", label: "", capacity: "10", reservedForTierId: "" })
      setShowForm(false)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to add table")
    } finally {
      setSaving(false)
    }
  }

  const handleBulkCreate = async () => {
    const count = parseInt(bulkCount)
    const seats = parseInt(bulkSeats) || 10
    if (!count || count < 1 || count > 100) { setSaveError("Enter a number between 1 and 100."); return }
    setBulkSaving(true)
    setSaveError("")
    try {
      const res = await fetch(`/api/events/${id}/tables/bulk`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify({ count, seatsPerTable: seats }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed") }
      setBulkCount("")
      setBulkSeats("")
      setBulkMode(false)
      await load()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to create tables")
    } finally {
      setBulkSaving(false)
    }
  }

  const handleDelete = async (tableId: string, label: string) => {
    if (!confirm(`Remove ${label}?`)) return
    setDeletingId(tableId)
    try {
      await fetch(`/api/events/${id}/tables/${tableId}`, { method: "DELETE", headers: getAuthHeaders() })
      setTables(prev => prev.filter(t => t.id !== tableId))
    } finally {
      setDeletingId(null)
    }
  }

  const totalSeats   = tables.reduce((s, t) => s + t.capacity, 0)
  const totalOccupied = tables.reduce((s, t) => s + t.currentOccupancy, 0)
  const fullTables   = tables.filter(t => t.currentOccupancy >= t.capacity).length

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
        .tp { max-width:1000px; margin:0 auto; padding:0 0 4rem; animation:tpIn 0.3s ease; }
        @keyframes tpIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:none} }
        .tp-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:2rem; flex-wrap:wrap; gap:0.75rem; }
        .tp-back { font-size:0.78rem; color:var(--text-3); text-decoration:none; display:flex; align-items:center; gap:0.35rem; transition:color 0.2s; }
        .tp-back:hover { color:var(--gold); }
        .tp-top-right { display:flex; gap:0.5rem; }
        .tp-title { font-family:'Cormorant Garamond',serif; font-size:clamp(1.5rem,3vw,2.25rem); font-weight:300; color:var(--text); letter-spacing:-0.01em; margin-bottom:0.25rem; }
        .tp-sub { font-size:0.78rem; color:var(--text-3); margin-bottom:1.75rem; }

        .tp-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:0.625rem; margin-bottom:1.75rem; }
        @media(max-width:640px) { .tp-stats { grid-template-columns:repeat(2,1fr); } }
        .tp-stat { background:var(--bg-2); border:1px solid var(--border); padding:0.875rem; text-align:center; }
        .tp-stat-num { font-family:'Cormorant Garamond',serif; font-size:1.75rem; font-weight:300; color:var(--gold); line-height:1; margin-bottom:0.2rem; }
        .tp-stat-label { font-size:0.58rem; color:var(--text-3); letter-spacing:0.1em; text-transform:uppercase; }

        .tp-btn { padding:0.5rem 1rem; font-family:'DM Sans',sans-serif; font-size:0.775rem; cursor:pointer; border:none; transition:all 0.2s; display:inline-flex; align-items:center; gap:0.4rem; border-radius:5px; }
        .tp-btn-gold  { background:var(--gold); color:#0a0a0a; font-weight:500; }
        .tp-btn-gold:hover:not(:disabled) { background:#c9a050; }
        .tp-btn-gold:disabled { opacity:0.45; cursor:not-allowed; }
        .tp-btn-ghost { background:transparent; border:1px solid var(--border); color:var(--text-2); }
        .tp-btn-ghost:hover { border-color:var(--border-hover); color:var(--text); }
        .tp-btn-danger { background:transparent; border:1px solid rgba(239,68,68,0.2); color:rgba(239,68,68,0.6); font-size:0.7rem; padding:0.3rem 0.65rem; }
        .tp-btn-danger:hover:not(:disabled) { border-color:#ef4444; color:#ef4444; }
        .tp-btn-danger:disabled { opacity:0.3; cursor:not-allowed; }

        .tp-form-card { background:var(--bg-2); border:1px solid var(--border); padding:1.5rem; margin-bottom:1.75rem; max-width:560px; }
        .tp-form-title { font-size:0.6rem; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--gold); margin-bottom:1.25rem; }
        .tp-field { margin-bottom:1.125rem; }
        .tp-label { display:block; font-size:0.72rem; font-weight:500; color:var(--text-2); letter-spacing:0.03em; margin-bottom:0.4rem; }
        .tp-req { color:var(--gold); margin-left:2px; }
        .tp-input, .tp-sel { width:100%; padding:0.6rem 0.875rem; background:var(--bg-3); border:1px solid var(--border); border-radius:5px; color:var(--text); font-family:'DM Sans',sans-serif; font-size:0.825rem; outline:none; box-sizing:border-box; transition:border-color 0.15s; }
        .tp-input:focus, .tp-sel:focus { border-color:var(--gold); }
        .tp-sel option { background:var(--bg-2); }
        .tp-row3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.875rem; }
        .tp-row2 { display:grid; grid-template-columns:1fr 1fr; gap:0.875rem; }
        @media(max-width:480px) { .tp-row3,.tp-row2 { grid-template-columns:1fr; } }
        .tp-form-error { font-size:0.75rem; color:#ef4444; margin-top:0.75rem; padding:0.6rem 0.875rem; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); border-radius:4px; }
        .tp-form-actions { display:flex; gap:0.625rem; margin-top:1.25rem; }
        .tp-hint { font-size:0.68rem; color:var(--text-3); margin-top:0.3rem; }

        .tp-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:0.75rem; }
        .tp-card { background:var(--bg-2); border:1px solid var(--border); padding:1rem; position:relative; transition:border-color 0.2s; }
        .tp-card:hover { border-color:rgba(180,140,60,0.25); }
        .tp-card.full { border-color:rgba(239,68,68,0.3); }
        .tp-card-num { font-family:'Cormorant Garamond',serif; font-size:2rem; font-weight:300; color:var(--gold); line-height:1; margin-bottom:0.25rem; }
        .tp-card-label { font-size:0.7rem; font-weight:500; color:var(--text-2); margin-bottom:0.625rem; }
        .tp-card-bar-wrap { height:4px; background:var(--bg-3); border-radius:2px; margin-bottom:0.625rem; overflow:hidden; }
        .tp-card-bar-fill { height:100%; border-radius:2px; transition:width 0.3s; }
        .tp-card-seats { font-size:0.7rem; color:var(--text-3); margin-bottom:0.75rem; }
        .tp-card-tier { font-size:0.6rem; font-weight:500; letter-spacing:0.08em; text-transform:uppercase; padding:0.2rem 0.5rem; border-radius:99px; border:1px solid; display:inline-block; margin-bottom:0.75rem; }
        .tp-card-actions { display:flex; justify-content:flex-end; }

        .tp-empty { padding:4rem 2rem; text-align:center; border:1px solid var(--border); background:var(--bg-2); }
        .tp-empty-icon { font-size:2.5rem; margin-bottom:1rem; opacity:0.4; }
        .tp-empty-title { font-size:0.925rem; color:var(--text-2); margin-bottom:0.5rem; }
        .tp-empty-sub { font-size:0.78rem; color:var(--text-3); line-height:1.65; }

        .tp-mode-tabs { display:flex; gap:0.5rem; margin-bottom:1.25rem; }
        .tp-mtab { padding:0.45rem 1rem; font-family:'DM Sans',sans-serif; font-size:0.75rem; cursor:pointer; border-radius:5px; border:1px solid var(--border); color:var(--text-3); background:transparent; transition:all 0.2s; }
        .tp-mtab.on { background:rgba(180,140,60,0.08); border-color:rgba(180,140,60,0.35); color:var(--gold); }
      `}</style>

      <div className="tp">
        <div className="tp-top">
          <Link href={`/events/${id}`} className="tp-back">← {event.name}</Link>
          <div className="tp-top-right">
            <button className="tp-btn tp-btn-ghost" onClick={() => { setBulkMode(true); setShowForm(false) }}>Bulk Create</button>
            <button className="tp-btn tp-btn-gold" onClick={() => { setShowForm(v => !v); setBulkMode(false) }}>
              {showForm ? "Cancel" : "+ Add Table"}
            </button>
          </div>
        </div>

        <h1 className="tp-title">Tables</h1>
        <p className="tp-sub">{event.name}</p>

        {tables.length > 0 && (
          <div className="tp-stats">
            <div className="tp-stat"><div className="tp-stat-num">{tables.length}</div><div className="tp-stat-label">Tables</div></div>
            <div className="tp-stat"><div className="tp-stat-num">{totalSeats}</div><div className="tp-stat-label">Total Seats</div></div>
            <div className="tp-stat"><div className="tp-stat-num">{totalOccupied}</div><div className="tp-stat-label">Occupied</div></div>
            <div className="tp-stat"><div className="tp-stat-num">{fullTables}</div><div className="tp-stat-label">Full</div></div>
          </div>
        )}

        {bulkMode && (
          <div className="tp-form-card">
            <div className="tp-form-title">Bulk Create Tables</div>
            <div className="tp-row2">
              <div className="tp-field">
                <label className="tp-label">Number of Tables <span className="tp-req">*</span></label>
                <input type="number" className="tp-input" placeholder="e.g. 20" min="1" max="100" value={bulkCount} onChange={e => setBulkCount(e.target.value)} />
              </div>
              <div className="tp-field">
                <label className="tp-label">Seats Per Table</label>
                <input type="number" className="tp-input" placeholder="10" min="1" value={bulkSeats} onChange={e => setBulkSeats(e.target.value)} />
                <span className="tp-hint">Defaults to 10 if left blank</span>
              </div>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-3)", lineHeight: 1.6, marginBottom: "1rem" }}>
              Tables will be numbered starting from {(tables.length > 0 ? Math.max(...tables.map(t => t.tableNumber)) + 1 : 1)}. You can rename them individually after.
            </p>
            {saveError && <div className="tp-form-error">{saveError}</div>}
            <div className="tp-form-actions">
              <button className="tp-btn tp-btn-gold" onClick={handleBulkCreate} disabled={bulkSaving}>{bulkSaving ? "Creating…" : `Create ${bulkCount || "?"} Tables`}</button>
              <button className="tp-btn tp-btn-ghost" onClick={() => setBulkMode(false)}>Cancel</button>
            </div>
          </div>
        )}

        {showForm && (
          <div className="tp-form-card">
            <div className="tp-form-title">Add Table</div>
            <div className="tp-row3">
              <div className="tp-field">
                <label className="tp-label">Table Number <span className="tp-req">*</span></label>
                <input type="number" className="tp-input" placeholder="e.g. 1" min="1" value={form.tableNumber} onChange={e => setForm(p => ({ ...p, tableNumber: e.target.value }))} />
              </div>
              <div className="tp-field">
                <label className="tp-label">Label</label>
                <input className="tp-input" placeholder="e.g. VIP-1" value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} />
              </div>
              <div className="tp-field">
                <label className="tp-label">Capacity</label>
                <input type="number" className="tp-input" placeholder="10" min="1" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))} />
              </div>
            </div>
            {event.guestTiers.length > 0 && (
              <div className="tp-field">
                <label className="tp-label">Reserve for Tier</label>
                <select className="tp-sel" value={form.reservedForTierId} onChange={e => setForm(p => ({ ...p, reservedForTierId: e.target.value }))}>
                  <option value="">General pool (dynamic)</option>
                  {event.guestTiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <span className="tp-hint">Reserved tables are only used by guests in that tier.</span>
              </div>
            )}
            {saveError && <div className="tp-form-error">{saveError}</div>}
            <div className="tp-form-actions">
              <button className="tp-btn tp-btn-gold" onClick={handleAdd} disabled={saving}>{saving ? "Saving…" : "Add Table"}</button>
              <button className="tp-btn tp-btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        )}

        {tables.length === 0 ? (
          <div className="tp-empty">
            <div className="tp-empty-icon">🪑</div>
            <div className="tp-empty-title">No tables configured yet</div>
            <div className="tp-empty-sub">Use Bulk Create to set up all your tables at once, or add them individually. Tables are assigned to guests automatically at check-in.</div>
          </div>
        ) : (
          <div className="tp-grid">
            {tables.map(t => {
              const pct   = t.capacity > 0 ? (t.currentOccupancy / t.capacity) * 100 : 0
              const isFull = t.currentOccupancy >= t.capacity
              const color  = t.reservedForTier?.color ?? "#b48c3c"
              const barColor = isFull ? "#ef4444" : pct > 70 ? "#f59e0b" : "#22c55e"
              return (
                <div key={t.id} className={`tp-card${isFull ? " full" : ""}`}>
                  <div className="tp-card-num">{t.tableNumber}</div>
                  <div className="tp-card-label">{t.label ?? `Table ${t.tableNumber}`}</div>
                  <div className="tp-card-bar-wrap">
                    <div className="tp-card-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
                  </div>
                  <div className="tp-card-seats">{t.currentOccupancy}/{t.capacity} seats</div>
                  {t.reservedForTier && (
                    <div className="tp-card-tier" style={{ color, borderColor: color + "55", background: color + "18" }}>
                      {t.reservedForTier.name}
                    </div>
                  )}
                  {t.isReleased && (
                    <div style={{ fontSize: "0.6rem", color: "#f59e0b", marginBottom: "0.5rem" }}>Released to pool</div>
                  )}
                  <div className="tp-card-actions">
                    <button className="tp-btn tp-btn-danger" onClick={() => handleDelete(t.id, t.label ?? `Table ${t.tableNumber}`)} disabled={deletingId === t.id}>
                      {deletingId === t.id ? "…" : "Remove"}
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
