// ─────────────────────────────────────────────
// FILE: src/app/dashboard/events/[id]/ushers/page.tsx
//
// Planner-facing usher management page.
// Accessible at: /dashboard/events/[id]/ushers
//
// Features:
//   - List all ushers with their role (MAIN / FLOOR)
//   - Add / edit / delete ushers
//   - Copy the usher's unique portal link to share on event day
//   - Toggle usher active/inactive
//
// NOTE: The usher portal link is:
//   /usher/[accessToken]
// The accessToken is auto-generated as a cuid when
// the usher is created (Usher.accessToken in schema).
// ─────────────────────────────────────────────

"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

// ── Types ─────────────────────────────────────

interface Usher {
  id:          string
  name:        string
  phone:       string | null
  role:        "MAIN" | "FLOOR"
  accessToken: string
  isActive:    boolean
  createdAt:   string
}

// ── Auth helper ───────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("ef-session") ?? ""
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const EMPTY_FORM = { name: "", phone: "", role: "FLOOR" as "MAIN" | "FLOOR" }

// ── Main Component ────────────────────────────

export default function UshersPage() {
  const { id: eventId } = useParams<{ id: string }>()

  const [ushers,    setUshers]    = useState<Usher[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [showForm,  setShowForm]  = useState(false)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [form,      setForm]      = useState({ ...EMPTY_FORM })
  const [saving,    setSaving]    = useState(false)
  const [formError, setFormError] = useState("")
  const [copiedId,  setCopiedId]  = useState<string | null>(null)
  const [deleting,  setDeleting]  = useState<string | null>(null)

  // ── Fetch ──────────────────────────────────

  const fetchUshers = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/ushers`, { headers: getAuthHeaders() })
      if (!res.ok) throw new Error("Failed to load ushers")
      setUshers(await res.json())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => { fetchUshers() }, [fetchUshers])

  // ── Form helpers ───────────────────────────

  const openAddForm = () => {
    setForm({ ...EMPTY_FORM })
    setEditId(null)
    setFormError("")
    setShowForm(true)
  }

  const openEditForm = (u: Usher) => {
    setForm({ name: u.name, phone: u.phone ?? "", role: u.role })
    setEditId(u.id)
    setFormError("")
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditId(null); setFormError("") }

  // ── Save ───────────────────────────────────

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError("Usher name is required."); return }
    setSaving(true)
    setFormError("")

    const body = {
      name:  form.name.trim(),
      phone: form.phone.trim() || null,
      role:  form.role,
    }

    try {
      const url    = editId ? `/api/events/${eventId}/ushers/${editId}` : `/api/events/${eventId}/ushers`
      const method = editId ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      })

      if (!res.ok) { const d = await res.json(); setFormError(d.error ?? "Failed to save"); return }

      await fetchUshers()
      closeForm()
    } catch {
      setFormError("Network error — please try again.")
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ─────────────────────────────────

  const handleDelete = async (usherId: string) => {
    if (!confirm("Remove this usher?")) return
    setDeleting(usherId)
    try {
      await fetch(`/api/events/${eventId}/ushers/${usherId}`, {
        method: "DELETE", headers: getAuthHeaders(),
      })
      setUshers(prev => prev.filter(u => u.id !== usherId))
    } catch { /* silent */ }
    finally { setDeleting(null) }
  }

  // ── Copy portal link ───────────────────────

  const copyPortalLink = (accessToken: string, usherId: string) => {
    const link = `${window.location.origin}/usher/${accessToken}`
    navigator.clipboard.writeText(link)
    setCopiedId(usherId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Group ushers by role for display: MAIN first, then FLOOR
  const mainUshers  = ushers.filter(u => u.role === "MAIN")
  const floorUshers = ushers.filter(u => u.role === "FLOOR")

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .uu { max-width: 720px; margin: 0 auto; padding: 2rem 1.25rem 4rem; font-family: 'DM Sans', sans-serif; animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }

        .uu-top     { display:flex; align-items:center; justify-content:space-between; margin-bottom:2rem; flex-wrap:wrap; gap:0.75rem; }
        .uu-back    { font-size:0.78rem; color:var(--text-3); text-decoration:none; display:flex; align-items:center; gap:0.35rem; transition:color 0.2s; }
        .uu-back:hover { color:var(--gold); }
        .uu-heading { font-family:'Cormorant Garamond',serif; font-size:1.625rem; font-weight:300; color:var(--text); margin-top:0.5rem; }

        .uu-btn-gold  { padding:0.5rem 1.125rem; background:var(--gold); color:#0a0a0a; border:none; font-family:'DM Sans',sans-serif; font-size:0.78rem; font-weight:500; letter-spacing:0.05em; text-transform:uppercase; cursor:pointer; }
        .uu-btn-ghost { padding:0.45rem 0.875rem; background:transparent; border:1px solid var(--border); color:var(--text-2); font-family:'DM Sans',sans-serif; font-size:0.72rem; cursor:pointer; transition:all 0.2s; }
        .uu-btn-ghost:hover { border-color:var(--border-hover); color:var(--text); }
        .uu-btn-red   { padding:0.45rem 0.875rem; background:transparent; border:1px solid rgba(239,68,68,0.25); color:rgba(239,68,68,0.6); font-family:'DM Sans',sans-serif; font-size:0.72rem; cursor:pointer; transition:all 0.2s; }
        .uu-btn-red:hover    { border-color:#ef4444; color:#ef4444; }
        .uu-btn-red:disabled { opacity:0.4; cursor:not-allowed; }

        /* Role section headings */
        .uu-role-section { margin-bottom:1.5rem; }
        .uu-role-label   { font-size:0.6rem; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--gold); margin-bottom:0.75rem; display:flex; align-items:center; gap:0.75rem; }
        .uu-role-label::after { content:''; flex:1; height:1px; background:var(--border); }
        .uu-role-desc    { font-size:0.72rem; color:var(--text-3); margin-bottom:0.875rem; }

        /* Usher cards */
        .uu-card     { background:var(--bg-2); border:1px solid var(--border); padding:1rem 1.25rem; margin-bottom:0.625rem; }
        .uu-card-top { display:flex; align-items:flex-start; justify-content:space-between; gap:0.75rem; flex-wrap:wrap; margin-bottom:0.75rem; }
        .uu-name     { font-size:0.9rem; font-weight:500; color:var(--text); }
        .uu-phone    { font-size:0.72rem; color:var(--text-3); margin-top:0.15rem; }
        .uu-card-actions { display:flex; gap:0.5rem; flex-shrink:0; }

        /* Portal link */
        .uu-link-row { display:flex; gap:0.5rem; align-items:center; }
        .uu-link-val { flex:1; min-width:0; padding:0.45rem 0.75rem; background:var(--bg); border:1px solid var(--border); font-size:0.7rem; color:var(--text-3); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

        /* Status badge */
        .uu-active-badge   { font-size:0.6rem; letter-spacing:0.06em; padding:0.2rem 0.55rem; border-radius:99px; border:1px solid rgba(34,197,94,0.3); background:rgba(34,197,94,0.08); color:#22c55e; }
        .uu-inactive-badge { font-size:0.6rem; letter-spacing:0.06em; padding:0.2rem 0.55rem; border-radius:99px; border:1px solid var(--border); color:var(--text-3); }

        /* Form */
        .uu-form-wrap    { background:var(--bg-2); border:1px solid var(--border); padding:1.5rem; margin-bottom:1.5rem; }
        .uu-form-title   { font-size:0.6rem; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--gold); margin-bottom:1.25rem; }
        .uu-form-grid    { display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; }
        @media(max-width:520px) { .uu-form-grid { grid-template-columns:1fr; } }
        .uu-field        { display:flex; flex-direction:column; gap:0.35rem; }
        .uu-field.full   { grid-column:1/-1; }
        .uu-label        { font-size:0.65rem; color:var(--text-3); letter-spacing:0.06em; text-transform:uppercase; }
        .uu-input, .uu-select { padding:0.55rem 0.75rem; background:var(--bg-3); border:1px solid var(--border); color:var(--text); font-family:'DM Sans',sans-serif; font-size:0.82rem; outline:none; transition:border-color 0.2s; width:100%; }
        .uu-input:focus, .uu-select:focus { border-color:var(--gold); }
        .uu-form-footer  { display:flex; gap:0.625rem; justify-content:flex-end; margin-top:1rem; }
        .uu-form-error   { font-size:0.75rem; color:#ef4444; margin-top:0.5rem; }

        /* Empty state */
        .uu-empty { padding:3rem; text-align:center; border:1px dashed var(--border); margin-bottom:1rem; }
        .uu-empty-title { font-family:'Cormorant Garamond',serif; font-size:1.25rem; font-weight:300; color:var(--text-2); margin-bottom:0.5rem; }
        .uu-empty-desc  { font-size:0.8rem; color:var(--text-3); margin-bottom:1.25rem; }

        /* Role info callout */
        .uu-callout { padding:0.875rem 1rem; background:rgba(180,140,60,0.06); border-left:2px solid rgba(180,140,60,0.3); margin-bottom:1.5rem; font-size:0.78rem; color:var(--text-2); line-height:1.6; }
        .uu-callout strong { color:#b48c3c; }
      `}</style>

      <div className="uu">

        {/* Top navigation */}
        <div className="uu-top">
          <div>
            <Link href={`/dashboard/events/${eventId}`} className="uu-back">← Back to event</Link>
            <h1 className="uu-heading">Ushers</h1>
          </div>
          <button className="uu-btn-gold" onClick={openAddForm}>+ Add Usher</button>
        </div>

        {/* Role explanation callout */}
        <div className="uu-callout">
          <strong>MAIN ushers</strong> scan QR codes at the gate and transfer guests to floor ushers.{" "}
          <strong>FLOOR ushers</strong> receive transferred guests and walk them to their assigned table.
          Each usher gets a unique link to open on their phone on event day.
        </div>

        {/* Add / Edit form */}
        {showForm && (
          <div className="uu-form-wrap">
            <div className="uu-form-title">{editId ? "Edit Usher" : "Add Usher"}</div>
            <div className="uu-form-grid">

              <div className="uu-field">
                <label className="uu-label">Full name *</label>
                <input className="uu-input" placeholder="e.g. Chukwudi Okafor" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              <div className="uu-field">
                <label className="uu-label">Phone number</label>
                <input className="uu-input" type="tel" placeholder="+234 800 000 0000" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>

              {/* Role selector with descriptions */}
              <div className="uu-field full">
                <label className="uu-label">Role *</label>
                <select className="uu-select" value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as "MAIN" | "FLOOR" }))}>
                  <option value="MAIN">MAIN — Gate scanner (scans QR codes at entrance)</option>
                  <option value="FLOOR">FLOOR — Seats guests at their assigned table</option>
                </select>
              </div>

            </div>

            {formError && <div className="uu-form-error">{formError}</div>}

            <div className="uu-form-footer">
              <button className="uu-btn-ghost" onClick={closeForm}>Cancel</button>
              <button className="uu-btn-gold" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editId ? "Save Changes" : "Add Usher"}
              </button>
            </div>
          </div>
        )}

        {loading && <p style={{ fontSize: "0.82rem", color: "var(--text-3)" }}>Loading ushers…</p>}
        {error   && <p style={{ fontSize: "0.82rem", color: "#ef4444" }}>{error}</p>}

        {/* Empty state */}
        {!loading && !error && ushers.length === 0 && !showForm && (
          <div className="uu-empty">
            <div className="uu-empty-title">No ushers added yet</div>
            <div className="uu-empty-desc">Add gate scanners and floor ushers. Each receives a private link to open on their phone on the day.</div>
            <button className="uu-btn-gold" onClick={openAddForm}>+ Add First Usher</button>
          </div>
        )}

        {/* MAIN ushers section */}
        {!loading && mainUshers.length > 0 && (
          <div className="uu-role-section">
            <div className="uu-role-label">Main — Gate scanners</div>
            <div className="uu-role-desc">These ushers scan QR codes at the entrance and hand guests off to floor ushers.</div>
            {mainUshers.map(usher => (
              <UsherCard
                key={usher.id}
                usher={usher}
                copiedId={copiedId}
                deleting={deleting}
                onEdit={() => openEditForm(usher)}
                onDelete={() => handleDelete(usher.id)}
                onCopy={() => copyPortalLink(usher.accessToken, usher.id)}
              />
            ))}
          </div>
        )}

        {/* FLOOR ushers section */}
        {!loading && floorUshers.length > 0 && (
          <div className="uu-role-section">
            <div className="uu-role-label">Floor — Seating crew</div>
            <div className="uu-role-desc">These ushers receive guests from the gate and walk them to their assigned tables.</div>
            {floorUshers.map(usher => (
              <UsherCard
                key={usher.id}
                usher={usher}
                copiedId={copiedId}
                deleting={deleting}
                onEdit={() => openEditForm(usher)}
                onDelete={() => handleDelete(usher.id)}
                onCopy={() => copyPortalLink(usher.accessToken, usher.id)}
              />
            ))}
          </div>
        )}

      </div>
    </>
  )
}

// ── Usher Card Sub-Component ──────────────────
// Extracted to keep the main render clean

function UsherCard({
  usher, copiedId, deleting, onEdit, onDelete, onCopy,
}: {
  usher:    Usher
  copiedId: string | null
  deleting: string | null
  onEdit:   () => void
  onDelete: () => void
  onCopy:   () => void
}) {
  const portalLink = `${typeof window !== "undefined" ? window.location.origin : ""}/usher/${usher.accessToken}`

  return (
    <div className="uu-card">
      <div className="uu-card-top">
        <div>
          <div className="uu-name">{usher.name}</div>
          {usher.phone && <div className="uu-phone">{usher.phone}</div>}
          <div style={{ marginTop: "0.35rem" }}>
            {usher.isActive
              ? <span className="uu-active-badge">Active</span>
              : <span className="uu-inactive-badge">Inactive</span>
            }
          </div>
        </div>
        <div className="uu-card-actions">
          <button className="uu-btn-ghost" onClick={onEdit}>Edit</button>
          <button className="uu-btn-red" onClick={onDelete} disabled={deleting === usher.id}>
            {deleting === usher.id ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>

      {/* Portal link — share this with the usher on event day */}
      <div className="uu-link-row">
        <div className="uu-link-val">{portalLink}</div>
        <button
          className="uu-btn-ghost"
          style={{
            borderColor: copiedId === usher.id ? "#22c55e" : undefined,
            color:       copiedId === usher.id ? "#22c55e" : undefined,
          }}
          onClick={onCopy}
        >
          {copiedId === usher.id ? "✓ Copied" : "Copy link"}
        </button>
      </div>
    </div>
  )
}
