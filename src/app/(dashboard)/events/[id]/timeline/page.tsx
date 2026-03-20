// ─────────────────────────────────────────────
// FILE: src/app/(dashboard)/events/[id]/timeline/page.tsx
// Mobile-first rewrite — all breakpoints fixed.
// ─────────────────────────────────────────────

"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

interface TimelineItem {
  id:          string
  time:        string
  title:       string
  description: string | null
  sortOrder:   number
}

function getAuthHeaders(): Record<string,string> {
  const token = localStorage.getItem("ef-session") ?? ""
  return token ? { Authorization:`Bearer ${token}` } : {}
}

const EMPTY_FORM = { time:"", title:"", description:"" }

export default function TimelinePage() {
  const { id: eventId } = useParams<{ id:string }>()

  const [items,      setItems]      = useState<TimelineItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string|null>(null)
  const [showForm,   setShowForm]   = useState(false)
  const [editId,     setEditId]     = useState<string|null>(null)
  const [form,       setForm]       = useState({...EMPTY_FORM})
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState("")
  const [deleting,   setDeleting]   = useState<string|null>(null)
  const [reordering, setReordering] = useState(false)

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/timeline`, { headers:getAuthHeaders() })
      if (!res.ok) throw new Error("Failed to load timeline")
      setItems(await res.json())
    } catch (err:unknown) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally { setLoading(false) }
  }, [eventId])

  useEffect(() => { fetchItems() }, [fetchItems])

  const openAddForm = () => { setForm({...EMPTY_FORM}); setEditId(null); setFormError(""); setShowForm(true) }
  const openEditForm = (item:TimelineItem) => { setForm({time:item.time, title:item.title, description:item.description??""}); setEditId(item.id); setFormError(""); setShowForm(true) }
  const closeForm = () => { setShowForm(false); setEditId(null); setFormError("") }

  const handleSave = async () => {
    if (!form.time.trim())  { setFormError("Time is required."); return }
    if (!form.title.trim()) { setFormError("Title is required."); return }
    setSaving(true); setFormError("")
    const body = { time:form.time.trim(), title:form.title.trim(), description:form.description.trim()||null }
    try {
      const url    = editId ? `/api/events/${eventId}/timeline?itemId=${editId}` : `/api/events/${eventId}/timeline`
      const method = editId ? "PATCH" : "POST"
      const res = await fetch(url, { method, headers:{"Content-Type":"application/json",...getAuthHeaders()}, body:JSON.stringify(body) })
      if (!res.ok) { const d=await res.json(); setFormError(d.error??"Failed"); return }
      await fetchItems(); closeForm()
    } catch { setFormError("Network error — please try again.") }
    finally { setSaving(false) }
  }

  const handleDelete = async (itemId:string) => {
    if (!confirm("Remove this schedule item?")) return
    setDeleting(itemId)
    try {
      await fetch(`/api/events/${eventId}/timeline?itemId=${itemId}`, { method:"DELETE", headers:getAuthHeaders() })
      setItems(prev => prev.filter(i => i.id !== itemId))
    } catch { /* silent */ }
    finally { setDeleting(null) }
  }

  const handleReorder = async (itemId:string, direction:"up"|"down") => {
    const idx = items.findIndex(i => i.id === itemId)
    if (direction==="up" && idx===0) return
    if (direction==="down" && idx===items.length-1) return
    setReordering(true)
    const newItems = [...items]
    const swapIdx  = direction==="up" ? idx-1 : idx+1
    ;[newItems[idx], newItems[swapIdx]] = [newItems[swapIdx], newItems[idx]]
    const reindexed = newItems.map((item,i) => ({...item, sortOrder:i}))
    setItems(reindexed)
    try {
      await Promise.all([
        fetch(`/api/events/${eventId}/timeline?itemId=${reindexed[idx].id}`, { method:"PATCH", headers:{"Content-Type":"application/json",...getAuthHeaders()}, body:JSON.stringify({sortOrder:reindexed[idx].sortOrder}) }),
        fetch(`/api/events/${eventId}/timeline?itemId=${reindexed[swapIdx].id}`, { method:"PATCH", headers:{"Content-Type":"application/json",...getAuthHeaders()}, body:JSON.stringify({sortOrder:reindexed[swapIdx].sortOrder}) }),
      ])
    } catch { await fetchItems() }
    finally { setReordering(false) }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .tl {
          max-width: 720px; margin: 0 auto;
          padding: 1.25rem 1rem 4rem;
          font-family: 'DM Sans', sans-serif;
          animation: tlIn 0.3s ease;
          overflow-x: hidden; width: 100%;
        }
        @media (min-width:600px) { .tl { padding: 2rem 1.5rem 4rem; } }
        @keyframes tlIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }

        /* ── Top bar ── */
        .tl-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; flex-wrap:wrap; gap:0.75rem; width:100%; }
        .tl-back { font-size:0.78rem; color:var(--text-3); text-decoration:none; display:flex; align-items:center; gap:0.35rem; transition:color 0.2s; flex-shrink:0; }
        .tl-back:hover { color:var(--gold); }
        .tl-heading { font-family:'Cormorant Garamond',serif; font-size:clamp(1.375rem,4vw,1.625rem); font-weight:300; color:var(--text); margin-top:0.4rem; }

        /* ── Callout ── */
        .tl-callout { padding:0.875rem 1rem; background:rgba(180,140,60,0.06); border-left:2px solid rgba(180,140,60,0.3); border-radius:0; margin-bottom:1.5rem; font-size:0.78rem; color:var(--text-2); line-height:1.6; }
        .tl-callout strong { color:#b48c3c; }

        /* ── Buttons ── */
        .tl-btn-gold  { padding:0.5rem 1rem; background:var(--gold); color:#0a0a0a; border:none; font-family:'DM Sans',sans-serif; font-size:0.78rem; font-weight:500; letter-spacing:0.05em; text-transform:uppercase; cursor:pointer; white-space:nowrap; flex-shrink:0; }
        .tl-btn-ghost { padding:0.45rem 0.75rem; background:transparent; border:1px solid var(--border); color:var(--text-2); font-family:'DM Sans',sans-serif; font-size:0.72rem; cursor:pointer; transition:all 0.2s; white-space:nowrap; }
        .tl-btn-ghost:hover    { border-color:var(--border-hover); color:var(--text); }
        .tl-btn-ghost:disabled { opacity:0.3; cursor:not-allowed; }
        .tl-btn-red  { padding:0.45rem 0.75rem; background:transparent; border:1px solid rgba(239,68,68,0.25); color:rgba(239,68,68,0.6); font-family:'DM Sans',sans-serif; font-size:0.72rem; cursor:pointer; transition:all 0.2s; white-space:nowrap; }
        .tl-btn-red:hover    { border-color:#ef4444; color:#ef4444; }
        .tl-btn-red:disabled { opacity:0.4; cursor:not-allowed; }
        .tl-btn-icon { padding:0.35rem 0.55rem; background:transparent; border:1px solid var(--border); color:var(--text-3); font-size:0.75rem; cursor:pointer; transition:all 0.2s; font-family:'DM Sans',sans-serif; }
        .tl-btn-icon:hover    { border-color:var(--gold); color:var(--gold); }
        .tl-btn-icon:disabled { opacity:0.3; cursor:not-allowed; }

        /* ── Timeline item cards ── */
        .tl-list { display:flex; flex-direction:column; gap:0; }
        .tl-card {
          background:var(--bg-2); border:1px solid var(--border);
          border-bottom:none; padding:1rem;
          /* Stack time+body+actions vertically on mobile */
          display:flex; flex-direction:column; gap:0.625rem;
          min-width:0;
        }
        .tl-card:last-child { border-bottom:1px solid var(--border); }

        /* On wider screens: time | body | actions in a row */
        @media (min-width:540px) {
          .tl-card { flex-direction:row; align-items:flex-start; gap:1rem; }
        }

        .tl-time  { font-size:0.78rem; font-weight:500; color:var(--gold); white-space:nowrap; min-width:60px; padding-top:2px; }
        .tl-body  { flex:1; min-width:0; }
        .tl-title { font-size:0.9rem; font-weight:500; color:var(--text); margin-bottom:0.2rem; word-break:break-word; }
        .tl-desc  { font-size:0.75rem; color:var(--text-3); line-height:1.5; word-break:break-word; }

        /* Actions row — always a flex row, wraps if needed */
        .tl-card-actions {
          display:flex; gap:0.375rem; flex-shrink:0;
          align-items:center; flex-wrap:wrap;
        }
        @media (min-width:540px) { .tl-card-actions { flex-wrap:nowrap; } }

        /* ── Form ── */
        .tl-form-wrap  { background:var(--bg-2); border:1px solid var(--border); padding:1.25rem; margin-bottom:1.25rem; }
        @media (min-width:600px) { .tl-form-wrap { padding:1.5rem; } }
        .tl-form-title { font-size:0.6rem; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--gold); margin-bottom:1.125rem; }

        /* Time + title side by side on wider screens */
        .tl-form-grid { display:grid; grid-template-columns:1fr; gap:0.75rem; }
        @media (min-width:480px) { .tl-form-grid { grid-template-columns:120px 1fr; } }

        .tl-field      { display:flex; flex-direction:column; gap:0.35rem; min-width:0; }
        .tl-field.full { grid-column:1/-1; }
        .tl-label      { font-size:0.65rem; color:var(--text-3); letter-spacing:0.06em; text-transform:uppercase; }
        .tl-input, .tl-textarea { padding:0.55rem 0.75rem; background:var(--bg-3); border:1px solid var(--border); color:var(--text); font-family:'DM Sans',sans-serif; font-size:0.82rem; outline:none; transition:border-color 0.2s; width:100%; }
        .tl-input:focus, .tl-textarea:focus { border-color:var(--gold); }
        .tl-textarea { resize:vertical; min-height:70px; }
        .tl-form-footer { display:flex; gap:0.625rem; justify-content:flex-end; margin-top:1rem; flex-wrap:wrap; }
        .tl-form-error  { font-size:0.75rem; color:#ef4444; margin-top:0.5rem; }

        /* ── Empty state ── */
        .tl-empty { padding:2.5rem 1.25rem; text-align:center; border:1px dashed var(--border); }
        .tl-empty-title { font-family:'Cormorant Garamond',serif; font-size:1.25rem; font-weight:300; color:var(--text-2); margin-bottom:0.5rem; }
        .tl-empty-desc  { font-size:0.8rem; color:var(--text-3); margin-bottom:1.25rem; line-height:1.6; }
      `}</style>

      <div className="tl">
        {/* Top bar */}
        <div className="tl-top">
          <div>
            <Link href={`/dashboard/events/${eventId}`} className="tl-back">← Back to event</Link>
            <h1 className="tl-heading">Event schedule</h1>
          </div>
          <button className="tl-btn-gold" onClick={openAddForm}>+ Add item</button>
        </div>

        {/* Callout */}
        <div className="tl-callout">
          Build a structured schedule that all your <strong>vendors</strong> can see on their portals.
          Helps caterers, DJs, photographers and other crew know exactly when each moment happens.
        </div>

        {/* Form */}
        {showForm && (
          <div className="tl-form-wrap">
            <div className="tl-form-title">{editId ? "Edit schedule item" : "Add schedule item"}</div>
            <div className="tl-form-grid">
              <div className="tl-field">
                <label className="tl-label">Time *</label>
                <input className="tl-input" placeholder="e.g. 2:00 PM" value={form.time}
                  onChange={e => setForm(f => ({...f, time:e.target.value}))} />
              </div>
              <div className="tl-field">
                <label className="tl-label">Title *</label>
                <input className="tl-input" placeholder="e.g. Reception begins" value={form.title}
                  onChange={e => setForm(f => ({...f, title:e.target.value}))} />
              </div>
              <div className="tl-field full">
                <label className="tl-label">Description (optional)</label>
                <textarea className="tl-textarea"
                  placeholder="e.g. DJ starts playing, cocktails served, photographer at entrance"
                  value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} />
              </div>
            </div>
            {formError && <div className="tl-form-error">{formError}</div>}
            <div className="tl-form-footer">
              <button className="tl-btn-ghost" onClick={closeForm}>Cancel</button>
              <button className="tl-btn-gold" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editId ? "Save changes" : "Add item"}
              </button>
            </div>
          </div>
        )}

        {loading && <p style={{fontSize:"0.82rem",color:"var(--text-3)"}}>Loading schedule…</p>}
        {error   && <p style={{fontSize:"0.82rem",color:"#ef4444"}}>{error}</p>}

        {!loading && !error && items.length === 0 && !showForm && (
          <div className="tl-empty">
            <div className="tl-empty-title">No schedule yet</div>
            <div className="tl-empty-desc">
              Add your event timeline — ceremony, reception, dinner, speeches — and all vendors will see it on their portal.
            </div>
            <button className="tl-btn-gold" onClick={openAddForm}>+ Add first item</button>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="tl-list">
            {items.map((item, idx) => (
              <div className="tl-card" key={item.id}>
                <div className="tl-time">{item.time}</div>
                <div className="tl-body">
                  <div className="tl-title">{item.title}</div>
                  {item.description && <div className="tl-desc">{item.description}</div>}
                </div>
                <div className="tl-card-actions">
                  <button className="tl-btn-icon" onClick={() => handleReorder(item.id,"up")}   disabled={idx===0||reordering} title="Move up">↑</button>
                  <button className="tl-btn-icon" onClick={() => handleReorder(item.id,"down")} disabled={idx===items.length-1||reordering} title="Move down">↓</button>
                  <button className="tl-btn-ghost" onClick={() => openEditForm(item)}>Edit</button>
                  <button className="tl-btn-red"   onClick={() => handleDelete(item.id)} disabled={deleting===item.id}>
                    {deleting===item.id ? "…" : "Remove"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
