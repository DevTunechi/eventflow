// ─────────────────────────────────────────────
// FILE: src/app/(dashboard)/events/[id]/vendors/page.tsx
//
// Planner-facing vendor management page.
// Mobile-first, single-column on small screens.
//
// Features:
//   - List all vendors with portal link
//   - Add / edit / delete vendor
//   - DRINK_VENDOR included in role dropdown
//   - Vendor brief drawer per card:
//       arriveTime, arriveLocation, instructions
//       Saved via PATCH — private per vendor
//   - Staff count, override badges
//   - Copy portal link
// ─────────────────────────────────────────────

"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

// ── Types ─────────────────────────────────────

interface Vendor {
  id:                     string
  name:                   string
  contactName:            string | null
  email:                  string | null
  phone:                  string | null
  role:                   string
  notes:                  string | null
  arriveTime:             string | null
  arriveLocation:         string | null
  instructions:           string | null
  staffCount:             number | null
  portalToken:            string
  lastAccessed:           string | null
  canOverrideCapacity:    boolean
  capacityOverrideActive: boolean
}

// ── All roles including DRINK_VENDOR ─────────
const VENDOR_ROLES = [
  "CATERER", "SECURITY", "MEDIA", "LIVE_BAND", "DJ",
  "MC", "HYPEMAN", "AFTER_PARTY", "DRINK_VENDOR",
  "DECORATOR", "PHOTOGRAPHER", "VIDEOGRAPHER", "OTHER",
]

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    CATERER: "Caterer", SECURITY: "Security", MEDIA: "Media",
    LIVE_BAND: "Live Band", DJ: "DJ", MC: "MC", HYPEMAN: "Hypeman",
    AFTER_PARTY: "After Party", DRINK_VENDOR: "Drink Vendor",
    DECORATOR: "Decorator", PHOTOGRAPHER: "Photographer",
    VIDEOGRAPHER: "Videographer", OTHER: "Other",
  }
  return map[role] ?? role
}

const EMPTY_FORM = {
  name: "", contactName: "", email: "", phone: "",
  role: "OTHER", notes: "", staffCount: "",
  canOverrideCapacity: false,
}

const EMPTY_BRIEF = { arriveTime: "", arriveLocation: "", instructions: "" }

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("ef-session") ?? ""
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ── Main Component ────────────────────────────

export default function VendorsPage() {
  const { id: eventId } = useParams<{ id: string }>()

  const [vendors,     setVendors]     = useState<Vendor[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [showForm,    setShowForm]    = useState(false)
  const [editId,      setEditId]      = useState<string | null>(null)
  const [form,        setForm]        = useState({ ...EMPTY_FORM })
  const [saving,      setSaving]      = useState(false)
  const [formError,   setFormError]   = useState("")
  const [copiedId,    setCopiedId]    = useState<string | null>(null)
  const [deleting,    setDeleting]    = useState<string | null>(null)

  // Brief state
  const [briefOpenId, setBriefOpenId] = useState<string | null>(null)
  const [briefForm,   setBriefForm]   = useState({ ...EMPTY_BRIEF })
  const [savingBrief, setSavingBrief] = useState(false)
  const [briefError,  setBriefError]  = useState("")
  const [briefSavedId,setBriefSavedId]= useState<string | null>(null)

  // ── Fetch ──────────────────────────────────

  const fetchVendors = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/vendors`, {
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error("Failed to load vendors")
      setVendors(await res.json())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => { fetchVendors() }, [fetchVendors])

  // ── Vendor form ────────────────────────────

  const openAddForm = () => {
    setForm({ ...EMPTY_FORM }); setEditId(null); setFormError(""); setShowForm(true)
  }

  const openEditForm = (v: Vendor) => {
    setForm({
      name: v.name, contactName: v.contactName ?? "",
      email: v.email ?? "", phone: v.phone ?? "",
      role: v.role, notes: v.notes ?? "",
      staffCount: v.staffCount != null ? String(v.staffCount) : "",
      canOverrideCapacity: v.canOverrideCapacity,
    })
    setEditId(v.id); setFormError(""); setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditId(null); setFormError("") }

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError("Vendor name is required."); return }
    setSaving(true); setFormError("")
    const staffCount = form.staffCount.trim() ? parseInt(form.staffCount, 10) : null
    const body = {
      name: form.name.trim(), contactName: form.contactName.trim() || null,
      email: form.email.trim() || null, phone: form.phone.trim() || null,
      role: form.role, notes: form.notes.trim() || null,
      staffCount, canOverrideCapacity: form.canOverrideCapacity,
    }
    try {
      const url    = editId ? `/api/events/${eventId}/vendors/${editId}` : `/api/events/${eventId}/vendors`
      const method = editId ? "PATCH" : "POST"
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json(); setFormError(d.error ?? "Failed"); return }
      await fetchVendors(); closeForm()
    } catch { setFormError("Network error — please try again.") }
    finally  { setSaving(false) }
  }

  const handleDelete = async (vendorId: string) => {
    if (!confirm("Remove this vendor?")) return
    setDeleting(vendorId)
    try {
      await fetch(`/api/events/${eventId}/vendors/${vendorId}`, {
        method: "DELETE", headers: getAuthHeaders(),
      })
      setVendors(prev => prev.filter(v => v.id !== vendorId))
      if (briefOpenId === vendorId) setBriefOpenId(null)
    } catch { /* silent */ }
    finally { setDeleting(null) }
  }

  // ── Brief ──────────────────────────────────

  const openBrief = (v: Vendor) => {
    setBriefForm({
      arriveTime:     v.arriveTime     ?? "",
      arriveLocation: v.arriveLocation ?? "",
      instructions:   v.instructions  ?? "",
    })
    setBriefError(""); setBriefSavedId(null); setBriefOpenId(v.id)
  }

  const closeBrief = () => { setBriefOpenId(null); setBriefError("") }

  const handleSaveBrief = async (vendorId: string) => {
    setSavingBrief(true); setBriefError("")
    try {
      const res = await fetch(`/api/events/${eventId}/vendors/${vendorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          arriveTime:     briefForm.arriveTime.trim()     || null,
          arriveLocation: briefForm.arriveLocation.trim() || null,
          instructions:   briefForm.instructions.trim()   || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); setBriefError(d.error ?? "Failed"); return }
      // Update local state so badge shows immediately
      setVendors(prev => prev.map(v => v.id === vendorId ? {
        ...v,
        arriveTime:     briefForm.arriveTime.trim()     || null,
        arriveLocation: briefForm.arriveLocation.trim() || null,
        instructions:   briefForm.instructions.trim()   || null,
      } : v))
      setBriefSavedId(vendorId)
      setTimeout(() => setBriefSavedId(null), 3000)
    } catch { setBriefError("Network error.") }
    finally  { setSavingBrief(false) }
  }

  // ── Copy link ──────────────────────────────

  const copyPortalLink = (portalToken: string, vendorId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/vendor/${portalToken}`)
    setCopiedId(vendorId); setTimeout(() => setCopiedId(null), 2000)
  }

  // ── Render ─────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        /* ── Root — mobile-first padding ── */
        .vv {
          max-width: 780px; margin: 0 auto;
          padding: 1.25rem 1rem 4rem;
          font-family: 'DM Sans', sans-serif;
          animation: vvIn 0.3s ease;
          overflow-x: hidden; width: 100%;
        }
        @media (min-width: 600px) { .vv { padding: 2rem 1.5rem 4rem; } }
        @keyframes vvIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }

        /* ── Top bar ── */
        .vv-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; flex-wrap:wrap; gap:0.75rem; width:100%; }
        .vv-back { font-size:0.78rem; color:var(--text-3); text-decoration:none; display:flex; align-items:center; gap:0.35rem; transition:color 0.2s; flex-shrink:0; }
        .vv-back:hover { color:var(--gold); }
        .vv-heading { font-family:'Cormorant Garamond',serif; font-size:clamp(1.375rem,4vw,1.625rem); font-weight:300; color:var(--text); margin-top:0.4rem; }

        /* ── Buttons ── */
        .vv-btn-gold  { padding:0.5rem 1rem; background:var(--gold); color:#0a0a0a; border:none; font-family:'DM Sans',sans-serif; font-size:0.78rem; font-weight:500; letter-spacing:0.05em; text-transform:uppercase; cursor:pointer; transition:background 0.2s; white-space:nowrap; flex-shrink:0; }
        .vv-btn-gold:hover    { background:#c9a050; }
        .vv-btn-gold:disabled { opacity:0.5; cursor:not-allowed; }
        .vv-btn-ghost { padding:0.45rem 0.75rem; background:transparent; border:1px solid var(--border); color:var(--text-2); font-family:'DM Sans',sans-serif; font-size:0.72rem; cursor:pointer; transition:all 0.2s; white-space:nowrap; }
        .vv-btn-ghost:hover { border-color:var(--border-hover); color:var(--text); }
        .vv-btn-red   { padding:0.45rem 0.75rem; background:transparent; border:1px solid rgba(239,68,68,0.25); color:rgba(239,68,68,0.6); font-family:'DM Sans',sans-serif; font-size:0.72rem; cursor:pointer; transition:all 0.2s; white-space:nowrap; }
        .vv-btn-red:hover    { border-color:#ef4444; color:#ef4444; }
        .vv-btn-red:disabled { opacity:0.4; cursor:not-allowed; }

        /* ── Vendor cards ── */
        .vv-list { display:flex; flex-direction:column; gap:0.75rem; }
        .vv-card { background:var(--bg-2); border:1px solid var(--border); padding:1rem; min-width:0; overflow:hidden; }
        .vv-card-top { display:flex; align-items:flex-start; justify-content:space-between; gap:0.75rem; margin-bottom:0.75rem; flex-wrap:wrap; }
        .vv-vendor-name { font-size:0.95rem; font-weight:500; color:var(--text); margin-bottom:0.25rem; word-break:break-word; }
        .vv-vendor-role { display:inline-block; font-size:0.6rem; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; padding:0.2rem 0.6rem; border:1px solid var(--border); color:var(--text-3); }
        .vv-card-actions { display:flex; gap:0.5rem; flex-shrink:0; }

        .vv-details { display:flex; flex-wrap:wrap; gap:0.375rem 1.25rem; font-size:0.75rem; color:var(--text-2); margin-bottom:0.75rem; }
        .vv-detail  { display:flex; align-items:center; gap:0.35rem; word-break:break-word; }

        .vv-badge-row { display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.75rem; }
        .vv-badge { font-size:0.6rem; font-weight:500; letter-spacing:0.06em; padding:0.2rem 0.5rem; border-radius:99px; border:1px solid; white-space:nowrap; }
        .vv-badge-staff    { color:#4a9eff; border-color:rgba(74,158,255,0.3); background:rgba(74,158,255,0.08); }
        .vv-badge-override { color:#f59e0b; border-color:rgba(245,158,11,0.3); background:rgba(245,158,11,0.08); }
        .vv-badge-accessed { color:#22c55e; border-color:rgba(34,197,94,0.3);  background:rgba(34,197,94,0.08); }
        .vv-badge-brief    { color:#a78bfa; border-color:rgba(167,139,250,0.3); background:rgba(167,139,250,0.08); }

        .vv-link-row { display:flex; gap:0.5rem; min-width:0; }
        .vv-link-val { flex:1; min-width:0; padding:0.45rem 0.75rem; background:var(--bg); border:1px solid var(--border); font-size:0.7rem; color:var(--text-3); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

        /* ── Brief section ── */
        .vv-brief-bar { display:flex; align-items:flex-start; justify-content:space-between; gap:0.75rem; margin-top:0.875rem; padding-top:0.875rem; border-top:1px solid var(--border); flex-wrap:wrap; }
        .vv-brief-bar-left { flex:1; min-width:0; }
        .vv-brief-bar-label { font-size:0.6rem; font-weight:500; letter-spacing:0.12em; text-transform:uppercase; color:var(--text-3); margin-bottom:0.25rem; }
        .vv-brief-preview { font-size:0.75rem; color:var(--text-2); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }
        .vv-brief-empty   { font-size:0.75rem; color:var(--text-3); font-style:italic; }

        /* Brief editor */
        .vv-brief-editor { margin-top:0.875rem; padding:1.125rem; background:var(--bg-3); border:1px solid var(--border); display:flex; flex-direction:column; gap:0.75rem; }
        .vv-brief-title  { font-size:0.6rem; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--gold); }
        .vv-brief-hint   { font-size:0.72rem; color:var(--text-3); line-height:1.6; }
        .vv-brief-grid   { display:grid; grid-template-columns:1fr; gap:0.75rem; }
        @media(min-width:480px) { .vv-brief-grid { grid-template-columns:1fr 1fr; } }
        .vv-brief-footer { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; }
        .vv-brief-saved  { font-size:0.72rem; color:#22c55e; }
        .vv-brief-error  { font-size:0.72rem; color:#ef4444; }

        /* ── Add/edit form ── */
        .vv-form-wrap  { background:var(--bg-2); border:1px solid var(--border); padding:1.25rem; margin-bottom:1.25rem; }
        @media(min-width:600px) { .vv-form-wrap { padding:1.5rem; } }
        .vv-form-title { font-size:0.6rem; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--gold); margin-bottom:1.125rem; }
        .vv-form-grid  { display:grid; grid-template-columns:1fr; gap:0.75rem; }
        @media(min-width:540px) { .vv-form-grid { grid-template-columns:1fr 1fr; } }
        .vv-field      { display:flex; flex-direction:column; gap:0.35rem; min-width:0; }
        .vv-field.full { grid-column:1/-1; }
        .vv-label      { font-size:0.65rem; color:var(--text-3); letter-spacing:0.06em; text-transform:uppercase; }
        .vv-input, .vv-select, .vv-textarea {
          padding:0.55rem 0.75rem; background:var(--bg-3); border:1px solid var(--border);
          color:var(--text); font-family:'DM Sans',sans-serif; font-size:0.82rem;
          outline:none; transition:border-color 0.2s; width:100%;
        }
        .vv-input:focus, .vv-select:focus, .vv-textarea:focus { border-color:var(--gold); }
        .vv-textarea { resize:vertical; min-height:80px; }
        .vv-checkbox-row { display:flex; align-items:flex-start; gap:0.625rem; font-size:0.8rem; color:var(--text-2); cursor:pointer; line-height:1.5; }
        .vv-checkbox-row input { margin-top:2px; flex-shrink:0; }
        .vv-form-footer { display:flex; gap:0.625rem; justify-content:flex-end; margin-top:1rem; flex-wrap:wrap; }
        .vv-form-error  { font-size:0.75rem; color:#ef4444; margin-top:0.5rem; }

        /* ── Empty state ── */
        .vv-empty { padding:2.5rem 1.25rem; text-align:center; border:1px dashed var(--border); }
        .vv-empty-title { font-family:'Cormorant Garamond',serif; font-size:1.25rem; font-weight:300; color:var(--text-2); margin-bottom:0.5rem; }
        .vv-empty-desc  { font-size:0.8rem; color:var(--text-3); margin-bottom:1.25rem; line-height:1.6; }
      `}</style>

      <div className="vv">
        {/* Top bar */}
        <div className="vv-top">
          <div>
            <Link href={`/dashboard/events/${eventId}`} className="vv-back">← Back to event</Link>
            <h1 className="vv-heading">Vendors</h1>
          </div>
          <button className="vv-btn-gold" onClick={openAddForm}>+ Add Vendor</button>
        </div>

        {/* Add / Edit form */}
        {showForm && (
          <div className="vv-form-wrap">
            <div className="vv-form-title">{editId ? "Edit vendor" : "Add vendor"}</div>
            <div className="vv-form-grid">
              <div className="vv-field">
                <label className="vv-label">Vendor / company name *</label>
                <input className="vv-input" placeholder="e.g. Lagos Catering Co." value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="vv-field">
                <label className="vv-label">Role *</label>
                <select className="vv-select" value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {VENDOR_ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </select>
              </div>
              <div className="vv-field">
                <label className="vv-label">Contact person</label>
                <input className="vv-input" placeholder="Full name" value={form.contactName}
                  onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
              </div>
              <div className="vv-field">
                <label className="vv-label">Number of staff</label>
                <input className="vv-input" type="number" min="0" placeholder="e.g. 5" value={form.staffCount}
                  onChange={e => setForm(f => ({ ...f, staffCount: e.target.value }))} />
              </div>
              <div className="vv-field">
                <label className="vv-label">Email</label>
                <input className="vv-input" type="email" placeholder="vendor@example.com" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="vv-field">
                <label className="vv-label">Phone</label>
                <input className="vv-input" type="tel" placeholder="+234 800 000 0000" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="vv-field full">
                <label className="vv-checkbox-row">
                  <input type="checkbox" checked={form.canOverrideCapacity}
                    onChange={e => setForm(f => ({ ...f, canOverrideCapacity: e.target.checked }))} />
                  Allow this vendor to activate walk-in mode (bypass venue capacity)
                </label>
              </div>
            </div>
            {formError && <div className="vv-form-error">{formError}</div>}
            <div className="vv-form-footer">
              <button className="vv-btn-ghost" onClick={closeForm}>Cancel</button>
              <button className="vv-btn-gold" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editId ? "Save changes" : "Add vendor"}
              </button>
            </div>
          </div>
        )}

        {loading && <p style={{ fontSize: "0.82rem", color: "var(--text-3)" }}>Loading vendors…</p>}
        {error   && <p style={{ fontSize: "0.82rem", color: "#ef4444" }}>{error}</p>}

        {!loading && !error && vendors.length === 0 && !showForm && (
          <div className="vv-empty">
            <div className="vv-empty-title">No vendors yet</div>
            <div className="vv-empty-desc">
              Add caterers, security, media, and other event crew.
              Each gets a private portal link and their own brief.
            </div>
            <button className="vv-btn-gold" onClick={openAddForm}>+ Add first vendor</button>
          </div>
        )}

        {!loading && vendors.length > 0 && (
          <div className="vv-list">
            {vendors.map(vendor => {
              const portalLink  = `${typeof window !== "undefined" ? window.location.origin : ""}/vendor/${vendor.portalToken}`
              const hasBrief    = !!(vendor.arriveTime || vendor.arriveLocation || vendor.instructions)
              const isBriefOpen = briefOpenId === vendor.id

              return (
                <div className="vv-card" key={vendor.id}>

                  {/* Header: name + actions */}
                  <div className="vv-card-top">
                    <div style={{ minWidth: 0 }}>
                      <div className="vv-vendor-name">{vendor.name}</div>
                      <span className="vv-vendor-role">{roleLabel(vendor.role)}</span>
                    </div>
                    <div className="vv-card-actions">
                      <button className="vv-btn-ghost" onClick={() => openEditForm(vendor)}>Edit</button>
                      <button className="vv-btn-red" onClick={() => handleDelete(vendor.id)} disabled={deleting === vendor.id}>
                        {deleting === vendor.id ? "…" : "Remove"}
                      </button>
                    </div>
                  </div>

                  {/* Contact details */}
                  <div className="vv-details">
                    {vendor.contactName && <span className="vv-detail">👤 {vendor.contactName}</span>}
                    {vendor.phone       && <span className="vv-detail">📞 {vendor.phone}</span>}
                    {vendor.email       && <span className="vv-detail">✉ {vendor.email}</span>}
                  </div>

                  {/* Badges */}
                  <div className="vv-badge-row">
                    {vendor.staffCount != null && (
                      <span className="vv-badge vv-badge-staff">{vendor.staffCount} staff</span>
                    )}
                    {vendor.canOverrideCapacity && (
                      <span className="vv-badge vv-badge-override">Walk-in override</span>
                    )}
                    {hasBrief && (
                      <span className="vv-badge vv-badge-brief">Brief written</span>
                    )}
                    {vendor.lastAccessed && (
                      <span className="vv-badge vv-badge-accessed">
                        Portal accessed {new Date(vendor.lastAccessed).toLocaleDateString("en-NG")}
                      </span>
                    )}
                  </div>

                  {/* Portal link */}
                  <div className="vv-link-row">
                    <div className="vv-link-val">{portalLink}</div>
                    <button
                      className="vv-btn-ghost"
                      style={{
                        borderColor: copiedId === vendor.id ? "#22c55e" : undefined,
                        color:       copiedId === vendor.id ? "#22c55e" : undefined,
                      }}
                      onClick={() => copyPortalLink(vendor.portalToken, vendor.id)}
                    >
                      {copiedId === vendor.id ? "✓ Copied" : "Copy link"}
                    </button>
                  </div>

                  {/* ── Vendor brief section ── */}
                  <div className="vv-brief-bar">
                    <div className="vv-brief-bar-left">
                      <div className="vv-brief-bar-label">Vendor brief</div>
                      {hasBrief ? (
                        <div className="vv-brief-preview">
                          {[vendor.arriveTime, vendor.arriveLocation, vendor.instructions]
                            .filter(Boolean).join(" · ")}
                        </div>
                      ) : (
                        <div className="vv-brief-empty">No brief written yet</div>
                      )}
                    </div>
                    <button
                      className="vv-btn-ghost"
                      style={{ flexShrink: 0 }}
                      onClick={() => isBriefOpen ? closeBrief() : openBrief(vendor)}
                    >
                      {isBriefOpen ? "Close" : hasBrief ? "Edit brief" : "Write brief"}
                    </button>
                  </div>

                  {/* Brief editor — expands inline */}
                  {isBriefOpen && (
                    <div className="vv-brief-editor">
                      <div className="vv-brief-title">Brief for {vendor.name}</div>
                      <p className="vv-brief-hint">
                        Only <strong>{vendor.name}</strong> sees this on their portal.
                        Write exactly what you need — arrival time, location, instructions.
                      </p>

                      <div className="vv-brief-grid">
                        <div className="vv-field">
                          <label className="vv-label">Arrival time</label>
                          <input className="vv-input" placeholder="e.g. 12:00 PM"
                            value={briefForm.arriveTime}
                            onChange={e => setBriefForm(f => ({ ...f, arriveTime: e.target.value }))} />
                        </div>
                        <div className="vv-field">
                          <label className="vv-label">Arrival location</label>
                          <input className="vv-input" placeholder="e.g. Couple's residence, Lekki Phase 1"
                            value={briefForm.arriveLocation}
                            onChange={e => setBriefForm(f => ({ ...f, arriveLocation: e.target.value }))} />
                        </div>
                        <div className="vv-field" style={{ gridColumn: "1/-1" }}>
                          <label className="vv-label">Instructions</label>
                          <textarea
                            className="vv-textarea"
                            style={{ minHeight: "100px" }}
                            placeholder={
                              vendor.role === "CATERER"
                                ? "e.g. Prepare jollof rice for 300 guests + 20 vendor crew. Serve appetisers at 3PM, main course at 5PM."
                                : vendor.role === "PHOTOGRAPHER" || vendor.role === "VIDEOGRAPHER"
                                ? "e.g. Arrive at couple's residence by 12PM for pre-wedding shots. Reception at Eko Hotels starts 3PM. Drone shots at sunset."
                                : vendor.role === "DRINK_VENDOR"
                                ? "e.g. Set up bar by 2PM. Cocktail hour starts 4PM. Ensure enough stock for 300 guests + 20 vendor crew."
                                : "e.g. Detailed instructions for this vendor…"
                            }
                            value={briefForm.instructions}
                            onChange={e => setBriefForm(f => ({ ...f, instructions: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="vv-brief-footer">
                        <div>
                          {briefError           && <div className="vv-brief-error">{briefError}</div>}
                          {briefSavedId===vendor.id && <div className="vv-brief-saved">✓ Brief saved</div>}
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button className="vv-btn-ghost" onClick={closeBrief}>Cancel</button>
                          <button className="vv-btn-gold" onClick={() => handleSaveBrief(vendor.id)} disabled={savingBrief}>
                            {savingBrief ? "Saving…" : "Save brief"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
