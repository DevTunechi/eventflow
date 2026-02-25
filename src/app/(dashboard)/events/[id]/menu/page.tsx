"use client"

// ─────────────────────────────────────────────
// src/app/(dashboard)/events/[id]/menu/page.tsx
// ─────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

type MenuCategory = "APPETIZER" | "MAIN" | "DRINK" | "DESSERT" | "SPECIAL"

interface MenuItem {
  id:          string
  category:    MenuCategory
  name:        string
  description: string | null
  isAvailable: boolean
  sortOrder:   number
  _count?:     { guestMeals: number }
}

interface EventSummary {
  id:         string
  name:       string
  guestTiers: { id: string; name: string; menuAccess: "PRE_EVENT" | "AT_EVENT" }[]
}

const CATEGORY_CONFIG: Record<MenuCategory, { label: string; icon: string; color: string }> = {
  APPETIZER: { label: "Appetizer",  icon: "🥗", color: "#10b981" },
  MAIN:      { label: "Main",       icon: "🍛", color: "#f59e0b" },
  DRINK:     { label: "Drinks",     icon: "🥤", color: "#3b82f6" },
  DESSERT:   { label: "Dessert",    icon: "🍰", color: "#ec4899" },
  SPECIAL:   { label: "Chef Special", icon: "⭐", color: "#b48c3c" },
}

const CATEGORY_ORDER: MenuCategory[] = ["APPETIZER", "MAIN", "DRINK", "DESSERT", "SPECIAL"]

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {}
  const token = localStorage.getItem("ef-session") ?? ""
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function MenuPage() {
  const { id } = useParams<{ id: string }>()

  const [event,      setEvent]      = useState<EventSummary | null>(null)
  const [items,      setItems]      = useState<MenuItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    category: "MAIN" as MenuCategory,
    name:        "",
    description: "",
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const hdrs = getAuthHeaders()
      const [evRes, mRes] = await Promise.all([
        fetch(`/api/events/${id}`,       { headers: hdrs }),
        fetch(`/api/events/${id}/menu`,  { headers: hdrs }),
      ])
      if (!evRes.ok) throw new Error("Failed to load event")
      const evData = await evRes.json()
      setEvent({
        id:         evData.event.id,
        name:       evData.event.name,
        guestTiers: evData.event.guestTiers ?? [],
      })
      if (mRes.ok) {
        const mData = await mRes.json()
        setItems(Array.isArray(mData) ? mData : [])
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!form.name.trim()) { setSaveError("Item name is required."); return }
    setSaving(true)
    setSaveError("")
    try {
      const res = await fetch(`/api/events/${id}/menu`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify({
          category:    form.category,
          name:        form.name.trim(),
          description: form.description.trim() || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed") }
      const { item } = await res.json()
      setItems(prev => [...prev, item])
      setForm({ category: "MAIN", name: "", description: "" })
      setShowForm(false)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to add item")
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (itemId: string, isAvailable: boolean) => {
    setTogglingId(itemId)
    try {
      const res = await fetch(`/api/events/${id}/menu/${itemId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify({ isAvailable: !isAvailable }),
      })
      if (res.ok) {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, isAvailable: !isAvailable } : i))
      }
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (itemId: string, name: string) => {
    if (!confirm(`Remove "${name}" from the menu?`)) return
    setDeletingId(itemId)
    try {
      await fetch(`/api/events/${id}/menu/${itemId}`, { method: "DELETE", headers: getAuthHeaders() })
      setItems(prev => prev.filter(i => i.id !== itemId))
    } finally {
      setDeletingId(null)
    }
  }

  const preOrderTiers = event?.guestTiers.filter(t => t.menuAccess === "PRE_EVENT") ?? []
  const itemsByCategory = CATEGORY_ORDER.map(cat => ({
    cat,
    cfg: CATEGORY_CONFIG[cat],
    items: items.filter(i => i.category === cat),
  })).filter(g => g.items.length > 0 || showForm)

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
        .mp { max-width:900px; margin:0 auto; padding:0 0 4rem; animation:mpIn 0.3s ease; }
        @keyframes mpIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:none} }
        .mp-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:2rem; flex-wrap:wrap; gap:0.75rem; }
        .mp-back { font-size:0.78rem; color:var(--text-3); text-decoration:none; display:flex; align-items:center; gap:0.35rem; transition:color 0.2s; }
        .mp-back:hover { color:var(--gold); }
        .mp-title { font-family:'Cormorant Garamond',serif; font-size:clamp(1.5rem,3vw,2.25rem); font-weight:300; color:var(--text); letter-spacing:-0.01em; margin-bottom:0.25rem; }
        .mp-sub { font-size:0.78rem; color:var(--text-3); margin-bottom:1.75rem; }

        .mp-btn { padding:0.5rem 1rem; font-family:'DM Sans',sans-serif; font-size:0.775rem; cursor:pointer; border:none; transition:all 0.2s; display:inline-flex; align-items:center; gap:0.4rem; border-radius:5px; }
        .mp-btn-gold  { background:var(--gold); color:#0a0a0a; font-weight:500; }
        .mp-btn-gold:hover:not(:disabled) { background:#c9a050; }
        .mp-btn-ghost { background:transparent; border:1px solid var(--border); color:var(--text-2); }
        .mp-btn-ghost:hover { border-color:var(--border-hover); color:var(--text); }

        .mp-info-box { padding:0.875rem 1rem; background:rgba(180,140,60,0.04); border:1px solid rgba(180,140,60,0.15); font-size:0.78rem; color:rgba(180,140,60,0.8); line-height:1.65; margin-bottom:1.75rem; }
        .mp-info-box strong { color:#b48c3c; }

        .mp-preorder-tiers { display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:1.75rem; }
        .mp-tier-badge { font-size:0.65rem; font-weight:500; padding:0.25rem 0.7rem; border-radius:99px; border:1px solid; }

        .mp-form-card { background:var(--bg-2); border:1px solid var(--border); padding:1.5rem; margin-bottom:1.75rem; max-width:540px; }
        .mp-form-title { font-size:0.6rem; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--gold); margin-bottom:1.25rem; }
        .mp-field { margin-bottom:1.125rem; }
        .mp-label { display:block; font-size:0.72rem; font-weight:500; color:var(--text-2); letter-spacing:0.03em; margin-bottom:0.4rem; }
        .mp-req { color:var(--gold); margin-left:2px; }
        .mp-input, .mp-sel, .mp-textarea { width:100%; padding:0.6rem 0.875rem; background:var(--bg-3); border:1px solid var(--border); border-radius:5px; color:var(--text); font-family:'DM Sans',sans-serif; font-size:0.825rem; outline:none; box-sizing:border-box; transition:border-color 0.15s; }
        .mp-input:focus, .mp-sel:focus, .mp-textarea:focus { border-color:var(--gold); }
        .mp-textarea { resize:vertical; min-height:65px; line-height:1.6; }
        .mp-sel option { background:var(--bg-2); }
        .mp-cat-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:0.5rem; }
        @media(max-width:480px) { .mp-cat-grid { grid-template-columns:repeat(3,1fr); } }
        .mp-cat-opt { padding:0.625rem 0.5rem; border:1.5px solid var(--border); border-radius:6px; cursor:pointer; text-align:center; transition:all 0.2s; background:transparent; }
        .mp-cat-opt:hover { border-color:rgba(180,140,60,0.35); }
        .mp-cat-opt.on { border-color:rgba(180,140,60,0.5); background:rgba(180,140,60,0.06); }
        .mp-cat-icon { font-size:1.25rem; display:block; margin-bottom:0.25rem; }
        .mp-cat-lbl { font-size:0.62rem; color:var(--text-3); font-family:'DM Sans',sans-serif; }
        .mp-cat-opt.on .mp-cat-lbl { color:var(--gold); }
        .mp-form-error { font-size:0.75rem; color:#ef4444; margin-top:0.75rem; padding:0.6rem 0.875rem; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); border-radius:4px; }
        .mp-form-actions { display:flex; gap:0.625rem; margin-top:1.25rem; }

        .mp-section { margin-bottom:2rem; }
        .mp-section-header { display:flex; align-items:center; gap:0.75rem; padding:0.75rem 1rem; background:var(--bg-2); border:1px solid var(--border); border-bottom:none; }
        .mp-section-icon { font-size:1.125rem; }
        .mp-section-title { font-size:0.8rem; font-weight:500; color:var(--text); }
        .mp-section-count { font-size:0.68rem; color:var(--text-3); padding:0.2rem 0.5rem; border:1px solid var(--border); margin-left:auto; }

        .mp-list { border:1px solid var(--border); background:var(--bg-2); }
        .mp-item { display:flex; align-items:flex-start; gap:0.875rem; padding:1rem; border-bottom:1px solid var(--border); transition:background 0.15s; }
        .mp-item:last-child { border-bottom:none; }
        .mp-item:hover { background:rgba(180,140,60,0.02); }
        .mp-item.unavailable { opacity:0.5; }
        .mp-item-info { flex:1; min-width:0; }
        .mp-item-name { font-size:0.875rem; font-weight:500; color:var(--text); margin-bottom:0.2rem; }
        .mp-item-desc { font-size:0.75rem; color:var(--text-3); line-height:1.5; font-weight:300; }
        .mp-item-orders { font-size:0.68rem; color:var(--text-3); margin-top:0.35rem; }
        .mp-item-orders strong { color:var(--gold); }
        .mp-item-actions { display:flex; gap:0.5rem; align-items:center; flex-shrink:0; }
        .mp-toggle { padding:0.3rem 0.65rem; font-family:'DM Sans',sans-serif; font-size:0.68rem; cursor:pointer; border-radius:4px; border:1px solid; transition:all 0.2s; }
        .mp-toggle-on  { border-color:rgba(34,197,94,0.3); color:#22c55e; background:rgba(34,197,94,0.08); }
        .mp-toggle-on:hover { background:rgba(34,197,94,0.15); }
        .mp-toggle-off { border-color:var(--border); color:var(--text-3); background:transparent; }
        .mp-toggle-off:hover { border-color:rgba(239,68,68,0.3); color:#ef4444; }
        .mp-item-del { padding:0.3rem 0.65rem; background:transparent; border:1px solid rgba(239,68,68,0.2); color:rgba(239,68,68,0.6); font-size:0.68rem; cursor:pointer; border-radius:4px; transition:all 0.2s; }
        .mp-item-del:hover:not(:disabled) { border-color:#ef4444; color:#ef4444; }
        .mp-item-del:disabled { opacity:0.3; cursor:not-allowed; }

        .mp-empty { padding:4rem 2rem; text-align:center; border:1px solid var(--border); background:var(--bg-2); }
        .mp-empty-icon { font-size:2.5rem; margin-bottom:1rem; opacity:0.4; }
        .mp-empty-title { font-size:0.925rem; color:var(--text-2); margin-bottom:0.5rem; }
        .mp-empty-sub { font-size:0.78rem; color:var(--text-3); line-height:1.65; }
      `}</style>

      <div className="mp">
        <div className="mp-top">
          <Link href={`/events/${id}`} className="mp-back">← {event.name}</Link>
          <button className="mp-btn mp-btn-gold" onClick={() => setShowForm(v => !v)}>
            {showForm ? "Cancel" : "+ Add Item"}
          </button>
        </div>

        <h1 className="mp-title">Menu</h1>
        <p className="mp-sub">{event.name}</p>

        <div className="mp-info-box">
          <strong>Pre-order menu —</strong> Only guests in tiers with Pre-event meal access will see and select from this menu during RSVP. All other guests order from waitstaff on the day. Items marked unavailable are hidden from the RSVP form.
        </div>

        {preOrderTiers.length > 0 && (
          <div style={{ marginBottom: "1.75rem" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 500, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: "0.625rem" }}>
              Tiers with pre-order access
            </div>
            <div className="mp-preorder-tiers">
              {preOrderTiers.map(t => (
                <span key={t.id} className="mp-tier-badge" style={{ color: "#4caf7d", borderColor: "rgba(76,175,125,0.35)", background: "rgba(76,175,125,0.08)" }}>
                  ✓ {t.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {preOrderTiers.length === 0 && (
          <div style={{ padding: "0.875rem 1rem", background: "rgba(107,114,128,0.06)", border: "1px solid rgba(107,114,128,0.15)", fontSize: "0.78rem", color: "rgba(240,236,228,0.45)", lineHeight: 1.6, marginBottom: "1.75rem" }}>
            No tiers have pre-order meal access enabled. Go to your event settings to configure guest tiers, or guests can still order from waitstaff on the day.
          </div>
        )}

        {showForm && (
          <div className="mp-form-card">
            <div className="mp-form-title">Add Menu Item</div>
            <div className="mp-field">
              <label className="mp-label">Category</label>
              <div className="mp-cat-grid">
                {CATEGORY_ORDER.map(cat => {
                  const cfg = CATEGORY_CONFIG[cat]
                  return (
                    <button
                      key={cat}
                      type="button"
                      className={`mp-cat-opt${form.category === cat ? " on" : ""}`}
                      onClick={() => setForm(p => ({ ...p, category: cat }))}
                    >
                      <span className="mp-cat-icon">{cfg.icon}</span>
                      <span className="mp-cat-lbl">{cfg.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="mp-field">
              <label className="mp-label">Dish / Drink Name <span className="mp-req">*</span></label>
              <input className="mp-input" placeholder="e.g. Jollof Rice & Grilled Chicken" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="mp-field">
              <label className="mp-label">Description</label>
              <textarea className="mp-textarea" placeholder="e.g. Served with coleslaw and fried plantain" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            {saveError && <div className="mp-form-error">{saveError}</div>}
            <div className="mp-form-actions">
              <button className="mp-btn mp-btn-gold" onClick={handleAdd} disabled={saving}>{saving ? "Saving…" : "Add Item"}</button>
              <button className="mp-btn mp-btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="mp-empty">
            <div className="mp-empty-icon">🍽️</div>
            <div className="mp-empty-title">No menu items yet</div>
            <div className="mp-empty-sub">Add your menu items — appetisers, mains, drinks, and desserts. Guests with pre-order access will select from these during RSVP, giving your caterer exact counts before the event.</div>
          </div>
        ) : (
          CATEGORY_ORDER.map(cat => {
            const catItems = items.filter(i => i.category === cat)
            if (!catItems.length) return null
            const cfg = CATEGORY_CONFIG[cat]
            return (
              <div className="mp-section" key={cat}>
                <div className="mp-section-header">
                  <span className="mp-section-icon">{cfg.icon}</span>
                  <span className="mp-section-title">{cfg.label}</span>
                  <span className="mp-section-count">{catItems.length}</span>
                </div>
                <div className="mp-list">
                  {catItems.map(item => (
                    <div key={item.id} className={`mp-item${!item.isAvailable ? " unavailable" : ""}`}>
                      <div className="mp-item-info">
                        <div className="mp-item-name">{item.name}</div>
                        {item.description && <div className="mp-item-desc">{item.description}</div>}
                        {(item._count?.guestMeals ?? 0) > 0 && (
                          <div className="mp-item-orders"><strong>{item._count?.guestMeals}</strong> pre-order{(item._count?.guestMeals ?? 0) > 1 ? "s" : ""}</div>
                        )}
                      </div>
                      <div className="mp-item-actions">
                        <button
                          className={`mp-toggle ${item.isAvailable ? "mp-toggle-on" : "mp-toggle-off"}`}
                          onClick={() => handleToggle(item.id, item.isAvailable)}
                          disabled={togglingId === item.id}
                        >
                          {togglingId === item.id ? "…" : item.isAvailable ? "Available" : "Unavailable"}
                        </button>
                        <button
                          className="mp-item-del"
                          onClick={() => handleDelete(item.id, item.name)}
                          disabled={deletingId === item.id}
                        >
                          {deletingId === item.id ? "…" : "Remove"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
