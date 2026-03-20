// ─────────────────────────────────────────────
// FILE: src/app/dashboard/events/[id]/vendors/page.tsx
//
// Planner-facing vendor management page.
// Accessible at: /dashboard/events/[id]/vendors
//
// Features:
//   - List all vendors for the event
//   - Add vendor with name, role, contact, staffCount, notes
//   - Edit / delete vendor
//   - Toggle capacity override permission per vendor
//   - Copy vendor's unique portal link
// ─────────────────────────────────────────────

"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
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
  staffCount:             number | null
  portalToken:            string
  lastAccessed:           string | null
  canOverrideCapacity:    boolean
  capacityOverrideActive: boolean
}

// All vendor roles from the VendorRole enum in schema.prisma
const VENDOR_ROLES = [
  "CATERER", "SECURITY", "MEDIA", "LIVE_BAND", "DJ",
  "MC", "HYPEMAN", "AFTER_PARTY", "DECORATOR",
  "PHOTOGRAPHER", "VIDEOGRAPHER", "OTHER",
]

// Display-friendly role labels
function roleLabel(role: string): string {
  const map: Record<string, string> = {
    CATERER: "Caterer", SECURITY: "Security", MEDIA: "Media",
    LIVE_BAND: "Live Band", DJ: "DJ", MC: "MC", HYPEMAN: "Hypeman",
    AFTER_PARTY: "After Party", DECORATOR: "Decorator",
    PHOTOGRAPHER: "Photographer", VIDEOGRAPHER: "Videographer", OTHER: "Other",
  }
  return map[role] ?? role
}

// Empty form state — used for both add and edit
const EMPTY_FORM = {
  name:                "",
  contactName:         "",
  email:               "",
  phone:               "",
  role:                "OTHER",
  notes:               "",
  staffCount:          "",   // Stored as string in form, parsed to Int on submit
  canOverrideCapacity: false,
}

// ── Auth helper ───────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("ef-session") ?? ""
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ── Main Component ────────────────────────────

export default function VendorsPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const router = useRouter()

  const [vendors,   setVendors]   = useState<Vendor[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [showForm,  setShowForm]  = useState(false)
  const [editId,    setEditId]    = useState<string | null>(null)   // ID of vendor being edited
  const [form,      setForm]      = useState({ ...EMPTY_FORM })
  const [saving,    setSaving]    = useState(false)
  const [formError, setFormError] = useState("")
  const [copiedId,  setCopiedId]  = useState<string | null>(null)   // Track which link was just copied
  const [deleting,  setDeleting]  = useState<string | null>(null)   // ID of vendor being deleted

  // ── Data fetching ──────────────────────────

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

  // ── Form helpers ───────────────────────────

  // Open form to add a new vendor
  const openAddForm = () => {
    setForm({ ...EMPTY_FORM })
    setEditId(null)
    setFormError("")
    setShowForm(true)
  }

  // Open form pre-filled with an existing vendor's data
  const openEditForm = (v: Vendor) => {
    setForm({
      name:                v.name,
      contactName:         v.contactName ?? "",
      email:               v.email       ?? "",
      phone:               v.phone       ?? "",
      role:                v.role,
      notes:               v.notes       ?? "",
      staffCount:          v.staffCount != null ? String(v.staffCount) : "",
      canOverrideCapacity: v.canOverrideCapacity,
    })
    setEditId(v.id)
    setFormError("")
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditId(null)
    setFormError("")
  }

  // ── Save (create or update) ────────────────

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError("Vendor name is required."); return }

    setSaving(true)
    setFormError("")

    // Parse staffCount: convert to integer if provided, null otherwise
    const staffCount = form.staffCount.trim()
      ? parseInt(form.staffCount, 10)
      : null

    const body = {
      name:                form.name.trim(),
      contactName:         form.contactName.trim() || null,
      email:               form.email.trim()       || null,
      phone:               form.phone.trim()        || null,
      role:                form.role,
      notes:               form.notes.trim()       || null,
      staffCount,           // Number of staff this vendor is bringing
      canOverrideCapacity: form.canOverrideCapacity,
    }

    try {
      const url    = editId
        ? `/api/events/${eventId}/vendors/${editId}` // PATCH existing
        : `/api/events/${eventId}/vendors`           // POST new
      const method = editId ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const d = await res.json()
        setFormError(d.error ?? "Failed to save vendor")
        return
      }

      // Refresh the list and close the form
      await fetchVendors()
      closeForm()
    } catch {
      setFormError("Network error — please try again.")
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ─────────────────────────────────

  const handleDelete = async (vendorId: string) => {
    if (!confirm("Remove this vendor? This cannot be undone.")) return
    setDeleting(vendorId)
    try {
      await fetch(`/api/events/${eventId}/vendors/${vendorId}`, {
        method:  "DELETE",
        headers: getAuthHeaders(),
      })
      setVendors(prev => prev.filter(v => v.id !== vendorId))
    } catch {
      // Silent fail — vendor stays in list
    } finally {
      setDeleting(null)
    }
  }

  // ── Copy portal link ───────────────────────

  const copyPortalLink = (portalToken: string, vendorId: string) => {
    const link = `${window.location.origin}/vendor/${portalToken}`
    navigator.clipboard.writeText(link)
    setCopiedId(vendorId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ── Render ─────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .vv { max-width: 780px; margin: 0 auto; padding: 2rem 1.25rem 4rem; font-family: 'DM Sans', sans-serif; animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }

        .vv-top  { display:flex; align-items:center; justify-content:space-between; margin-bottom:2rem; flex-wrap:wrap; gap:0.75rem; }
        .vv-back { font-size:0.78rem; color:var(--text-3); text-decoration:none; display:flex; align-items:center; gap:0.35rem; transition:color 0.2s; }
        .vv-back:hover { color:var(--gold); }
        .vv-heading { font-family:'Cormorant Garamond',serif; font-size:1.625rem; font-weight:300; color:var(--text); }

        /* Primary button */
        .vv-btn-gold { padding:0.5rem 1.125rem; background:var(--gold); color:#0a0a0a; border:none; font-family:'DM Sans',sans-serif; font-size:0.78rem; font-weight:500; letter-spacing:0.05em; text-transform:uppercase; cursor:pointer; transition:background 0.2s; }
        .vv-btn-gold:hover { background:#c9a050; }

        /* Ghost button */
        .vv-btn-ghost { padding:0.45rem 0.875rem; background:transparent; border:1px solid var(--border); color:var(--text-2); font-family:'DM Sans',sans-serif; font-size:0.72rem; cursor:pointer; transition:all 0.2s; white-space:nowrap; }
        .vv-btn-ghost:hover { border-color:var(--border-hover); color:var(--text); }

        /* Danger ghost */
        .vv-btn-red { padding:0.45rem 0.875rem; background:transparent; border:1px solid rgba(239,68,68,0.25); color:rgba(239,68,68,0.6); font-family:'DM Sans',sans-serif; font-size:0.72rem; cursor:pointer; transition:all 0.2s; }
        .vv-btn-red:hover { border-color:#ef4444; color:#ef4444; }
        .vv-btn-red:disabled { opacity:0.4; cursor:not-allowed; }

        /* Vendor cards */
        .vv-list  { display:flex; flex-direction:column; gap:0.75rem; }
        .vv-card  { background:var(--bg-2); border:1px solid var(--border); padding:1.125rem 1.25rem; }
        .vv-card-top    { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; flex-wrap:wrap; margin-bottom:0.75rem; }
        .vv-vendor-name { font-size:0.95rem; font-weight:500; color:var(--text); margin-bottom:0.2rem; }
        .vv-vendor-role { display:inline-block; font-size:0.6rem; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; padding:0.2rem 0.6rem; border:1px solid var(--border); color:var(--text-3); }
        .vv-card-actions { display:flex; gap:0.5rem; flex-shrink:0; flex-wrap:wrap; }

        /* Vendor detail rows */
        .vv-details { display:flex; flex-wrap:wrap; gap:0.375rem 1.5rem; font-size:0.75rem; color:var(--text-2); margin-bottom:0.875rem; }
        .vv-detail  { display:flex; align-items:center; gap:0.35rem; }

        /* Portal link row */
        .vv-link-row { display:flex; gap:0.5rem; align-items:center; }
        .vv-link-val { flex:1; min-width:0; padding:0.45rem 0.75rem; background:var(--bg); border:1px solid var(--border); font-size:0.7rem; color:var(--text-3); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

        /* Staff + override badges */
        .vv-badge-row { display:flex; gap:0.5rem; margin-top:0.625rem; flex-wrap:wrap; }
        .vv-badge { font-size:0.6rem; font-weight:500; letter-spacing:0.06em; padding:0.2rem 0.5rem; border-radius:99px; border:1px solid; white-space:nowrap; }
        .vv-badge-staff    { color:#4a9eff; border-color:rgba(74,158,255,0.3); background:rgba(74,158,255,0.08); }
        .vv-badge-override { color:#f59e0b; border-color:rgba(245,158,11,0.3); background:rgba(245,158,11,0.08); }
        .vv-badge-accessed { color:#22c55e; border-color:rgba(34,197,94,0.3);  background:rgba(34,197,94,0.08); }

        /* Form overlay */
        .vv-form-wrap { background:var(--bg-2); border:1px solid var(--border); padding:1.5rem; margin-bottom:1.5rem; }
        .vv-form-title { font-size:0.6rem; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--gold); margin-bottom:1.25rem; }
        .vv-form-grid  { display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; }
        @media (max-width:540px) { .vv-form-grid { grid-template-columns:1fr; } }
        .vv-field      { display:flex; flex-direction:column; gap:0.35rem; }
        .vv-field.full { grid-column:1/-1; }
        .vv-label      { font-size:0.65rem; color:var(--text-3); letter-spacing:0.06em; text-transform:uppercase; }
        .vv-input, .vv-select, .vv-textarea {
          padding:0.55rem 0.75rem; background:var(--bg-3); border:1px solid var(--border);
          color:var(--text); font-family:'DM Sans',sans-serif; font-size:0.82rem; outline:none;
          transition:border-color 0.2s; width:100%;
        }
        .vv-input:focus, .vv-select:focus, .vv-textarea:focus { border-color:var(--gold); }
        .vv-textarea { resize:vertical; min-height:80px; }
        .vv-checkbox-row { display:flex; align-items:center; gap:0.625rem; font-size:0.8rem; color:var(--text-2); cursor:pointer; }
        .vv-form-footer  { display:flex; gap:0.625rem; justify-content:flex-end; margin-top:1rem; flex-wrap:wrap; }
        .vv-form-error   { font-size:0.75rem; color:#ef4444; margin-top:0.5rem; }

        /* Empty state */
        .vv-empty { padding:3rem; text-align:center; border:1px dashed var(--border); }
        .vv-empty-title { font-family:'Cormorant Garamond',serif; font-size:1.25rem; font-weight:300; color:var(--text-2); margin-bottom:0.5rem; }
        .vv-empty-desc  { font-size:0.8rem; color:var(--text-3); margin-bottom:1.25rem; }

        /* Last accessed hint */
        .vv-accessed { font-size:0.65rem; color:#22c55e; margin-top:0.35rem; }
      `}</style>

      <div className="vv">

        {/* Top navigation */}
        <div className="vv-top">
          <div>
            <Link href={`/dashboard/events/${eventId}`} className="vv-back">← Back to event</Link>
            <h1 className="vv-heading" style={{ marginTop: "0.5rem" }}>Vendors</h1>
          </div>
          <button className="vv-btn-gold" onClick={openAddForm}>+ Add Vendor</button>
        </div>

        {/* Add / Edit form */}
        {showForm && (
          <div className="vv-form-wrap">
            <div className="vv-form-title">{editId ? "Edit Vendor" : "Add Vendor"}</div>
            <div className="vv-form-grid">

              {/* Vendor / company name */}
              <div className="vv-field">
                <label className="vv-label">Vendor / company name *</label>
                <input className="vv-input" placeholder="e.g. Lagos Catering Co." value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              {/* Role */}
              <div className="vv-field">
                <label className="vv-label">Role *</label>
                <select className="vv-select" value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {VENDOR_ROLES.map(r => (
                    <option key={r} value={r}>{roleLabel(r)}</option>
                  ))}
                </select>
              </div>

              {/* Contact person name */}
              <div className="vv-field">
                <label className="vv-label">Contact person</label>
                <input className="vv-input" placeholder="Full name" value={form.contactName}
                  onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
              </div>

              {/* Number of staff attending the event */}
              <div className="vv-field">
                <label className="vv-label">Number of staff</label>
                <input
                  className="vv-input"
                  type="number"
                  min="0"
                  placeholder="e.g. 5"
                  value={form.staffCount}
                  onChange={e => setForm(f => ({ ...f, staffCount: e.target.value }))}
                />
              </div>

              {/* Email */}
              <div className="vv-field">
                <label className="vv-label">Email</label>
                <input className="vv-input" type="email" placeholder="vendor@example.com" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>

              {/* Phone */}
              <div className="vv-field">
                <label className="vv-label">Phone</label>
                <input className="vv-input" type="tel" placeholder="+234 800 000 0000" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>

              {/* Notes — spans full width */}
              <div className="vv-field full">
                <label className="vv-label">Notes</label>
                <textarea className="vv-textarea" placeholder="Setup instructions, contact notes, special requirements…"
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              {/* Capacity override — only meaningful for SECURITY vendors */}
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
                {saving ? "Saving…" : editId ? "Save Changes" : "Add Vendor"}
              </button>
            </div>
          </div>
        )}

        {/* Loading / error states */}
        {loading && <p style={{ fontSize: "0.82rem", color: "var(--text-3)" }}>Loading vendors…</p>}
        {error   && <p style={{ fontSize: "0.82rem", color: "#ef4444" }}>{error}</p>}

        {/* Vendor list */}
        {!loading && !error && vendors.length === 0 && !showForm && (
          <div className="vv-empty">
            <div className="vv-empty-title">No vendors yet</div>
            <div className="vv-empty-desc">Add caterers, security, media, and other event crew. Each gets a private portal link.</div>
            <button className="vv-btn-gold" onClick={openAddForm}>+ Add First Vendor</button>
          </div>
        )}

        {!loading && vendors.length > 0 && (
          <div className="vv-list">
            {vendors.map(vendor => {
              const portalLink = `${typeof window !== "undefined" ? window.location.origin : ""}/vendor/${vendor.portalToken}`
              return (
                <div className="vv-card" key={vendor.id}>
                  <div className="vv-card-top">
                    <div>
                      <div className="vv-vendor-name">{vendor.name}</div>
                      <span className="vv-vendor-role">{roleLabel(vendor.role)}</span>
                    </div>
                    <div className="vv-card-actions">
                      <button className="vv-btn-ghost" onClick={() => openEditForm(vendor)}>Edit</button>
                      <button className="vv-btn-red" onClick={() => handleDelete(vendor.id)} disabled={deleting === vendor.id}>
                        {deleting === vendor.id ? "Removing…" : "Remove"}
                      </button>
                    </div>
                  </div>

                  {/* Contact details */}
                  <div className="vv-details">
                    {vendor.contactName && <span className="vv-detail">👤 {vendor.contactName}</span>}
                    {vendor.phone       && <span className="vv-detail">📞 {vendor.phone}</span>}
                    {vendor.email       && <span className="vv-detail">✉ {vendor.email}</span>}
                  </div>

                  {/* Badges: staff count, override permission */}
                  <div className="vv-badge-row">
                    {vendor.staffCount != null && (
                      <span className="vv-badge vv-badge-staff">
                        {vendor.staffCount} staff
                      </span>
                    )}
                    {vendor.canOverrideCapacity && (
                      <span className="vv-badge vv-badge-override">Walk-in override</span>
                    )}
                    {vendor.lastAccessed && (
                      <span className="vv-badge vv-badge-accessed">
                        Portal accessed {new Date(vendor.lastAccessed).toLocaleDateString("en-NG")}
                      </span>
                    )}
                  </div>

                  {/* Portal link — copy button */}
                  <div className="vv-link-row" style={{ marginTop: "0.875rem" }}>
                    <div className="vv-link-val">{portalLink}</div>
                    <button
                      className="vv-btn-ghost"
                      style={{ borderColor: copiedId === vendor.id ? "#22c55e" : undefined, color: copiedId === vendor.id ? "#22c55e" : undefined }}
                      onClick={() => copyPortalLink(vendor.portalToken, vendor.id)}
                    >
                      {copiedId === vendor.id ? "✓ Copied" : "Copy link"}
                    </button>
                  </div>

                  {/* Notes if present */}
                  {vendor.notes && (
                    <p style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: "0.75rem", lineHeight: 1.6, borderLeft: "2px solid var(--border)", paddingLeft: "0.75rem" }}>
                      {vendor.notes}
                    </p>
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
