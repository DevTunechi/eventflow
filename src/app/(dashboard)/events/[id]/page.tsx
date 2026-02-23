"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import Link from "next/link"
import Image from "next/image"

interface GuestTier {
  id: string
  name: string
  color: string
  capacity: number
  seatingType: "PRE_ASSIGNED" | "DYNAMIC"
  menuAccess: "PRE_EVENT" | "AT_EVENT"
  tablePrefix: string | null
  _count?: { guests: number }
}

interface EventDetail {
  id: string
  title: string
  slug: string
  description: string | null
  date: string
  endDate: string | null
  venue: string
  city: string
  state: string
  country: string
  coverImage: string | null
  brandColor: string | null
  inviteModel: "OPEN" | "CLOSED"
  requireOtp: boolean
  status: "DRAFT" | "PUBLISHED" | "ONGOING" | "COMPLETED" | "CANCELLED"
  guestTiers: GuestTier[]
  _count?: { guests: number }
  createdAt: string
}

const STATUS_CONFIG = {
  DRAFT:     { color: "#6b7280", label: "Draft" },
  PUBLISHED: { color: "#22c55e", label: "Published" },
  ONGOING:   { color: "#f59e0b", label: "Ongoing" },
  COMPLETED: { color: "#3b82f6", label: "Completed" },
  CANCELLED: { color: "#ef4444", label: "Cancelled" },
}

export default function EventDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const { user } = useAuth()

  const [event,      setEvent]      = useState<EventDetail | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [copied,     setCopied]     = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  const fetchEvent = useCallback(async () => {
    try {
      const token = await user?.getIdToken()
      const hdrs: Record<string, string> = { "Content-Type": "application/json" }
      if (token) hdrs["Authorization"] = `Bearer ${token}`
      const res = await fetch(`/api/events/${id}`, { headers: hdrs })
      if (!res.ok) throw new Error("Failed to load event")
      const data = await res.json()
      setEvent(data.event)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [id, user])

  useEffect(() => { fetchEvent() }, [fetchEvent])

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const handlePublish = async () => {
    if (!event) return
    setPublishing(true)
    try {
      const token = await user?.getIdToken()
      const hdrs: Record<string, string> = { "Content-Type": "application/json" }
      if (token) hdrs["Authorization"] = `Bearer ${token}`
      const res = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: hdrs,
        body: JSON.stringify({ status: "PUBLISHED" }),
      })
      if (!res.ok) throw new Error("Publish failed")
      const data = await res.json()
      setEvent(data.event)
    } catch (err) {
      console.error(err)
    } finally {
      setPublishing(false)
    }
  }

  const handleDelete = async () => {
    if (!event || !confirm("Delete this event? This cannot be undone.")) return
    setDeleting(true)
    try {
      const token = await user?.getIdToken()
      const hdrs: Record<string, string> = {}
      if (token) hdrs["Authorization"] = `Bearer ${token}`
      await fetch(`/api/events/${id}`, { method: "DELETE", headers: hdrs })
      router.push("/events")
    } catch (err) {
      console.error(err)
      setDeleting(false)
    }
  }

  const baseUrl  = typeof window !== "undefined" ? window.location.origin : ""
  const openLink = `${baseUrl}/invite/${event?.slug}`

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ width: 24, height: 24, border: "1.5px solid rgba(180,140,60,0.2)", borderTopColor: "#b48c3c", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error || !event) return (
    <div style={{ padding: "3rem", textAlign: "center" }}>
      <p style={{ color: "var(--text-2)", marginBottom: "1rem" }}>{error ?? "Event not found"}</p>
      <Link href="/events" style={{ color: "var(--gold)", textDecoration: "none", fontSize: "0.85rem" }}>← Back to events</Link>
    </div>
  )

  const status    = STATUS_CONFIG[event.status]
  const eventDate = new Date(event.date)
  const dateStr   = eventDate.toLocaleDateString("en-NG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
  const timeStr   = eventDate.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        .ed-page { max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem 4rem; animation: edFadeIn 0.4s ease; }
        @keyframes edFadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

        .ed-topbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:2rem; flex-wrap:wrap; gap:1rem; }
        .ed-back { font-size:0.8rem; color:var(--text-3); text-decoration:none; letter-spacing:0.04em; display:flex; align-items:center; gap:0.4rem; transition:color 0.2s; }
        .ed-back:hover { color:var(--gold); }
        .ed-actions { display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap; }

        .ed-btn { padding:0.55rem 1.25rem; font-family:'DM Sans',sans-serif; font-size:0.8rem; font-weight:400; letter-spacing:0.06em; text-transform:uppercase; cursor:pointer; border:none; text-decoration:none; transition:all 0.25s ease; display:inline-flex; align-items:center; justify-content:center; gap:0.5rem; }
        .ed-btn-ghost { background:transparent; border:1px solid var(--border); color:var(--text-2); }
        .ed-btn-ghost:hover { border-color:var(--border-hover); color:var(--text); }
        .ed-btn-gold { background:var(--gold); color:#0a0a0a; font-weight:500; }
        .ed-btn-gold:hover { background:#c9a050; }
        .ed-btn-gold:disabled { opacity:0.5; cursor:not-allowed; }
        .ed-btn-danger { background:transparent; border:1px solid rgba(239,68,68,0.3); color:rgba(239,68,68,0.7); }
        .ed-btn-danger:hover { border-color:#ef4444; color:#ef4444; }
        .ed-btn-danger:disabled { opacity:0.5; cursor:not-allowed; }

        .ed-cover { width:100%; aspect-ratio:16/6; position:relative; overflow:hidden; background:var(--bg-2); margin-bottom:2rem; }
        .ed-cover-placeholder { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:0.72rem; letter-spacing:0.1em; text-transform:uppercase; color:var(--text-3); }

        .ed-header { margin-bottom:2.5rem; }
        .ed-status-row { display:flex; align-items:center; gap:0.75rem; margin-bottom:1rem; flex-wrap:wrap; }
        .ed-status-badge { display:flex; align-items:center; gap:0.4rem; padding:0.3rem 0.75rem; border-radius:99px; font-size:0.68rem; font-weight:500; letter-spacing:0.08em; text-transform:uppercase; border:1px solid; }
        .ed-status-dot { width:5px; height:5px; border-radius:50%; }
        .ed-badge { font-size:0.68rem; letter-spacing:0.06em; color:var(--text-3); padding:0.3rem 0.75rem; border:1px solid var(--border); }

        .ed-title { font-family:'Cormorant Garamond',serif; font-size:clamp(2rem,4vw,3rem); font-weight:300; line-height:1.1; color:var(--text); margin-bottom:1rem; letter-spacing:-0.01em; }

        .ed-meta { display:flex; flex-wrap:wrap; gap:0.5rem 1.5rem; }
        .ed-meta-item { display:flex; align-items:center; gap:0.5rem; font-size:0.82rem; color:var(--text-2); font-weight:300; }
        .ed-meta-item svg { color:var(--gold); flex-shrink:0; }

        .ed-draft-banner { padding:1rem 1.25rem; background:rgba(180,140,60,0.06); border:1px solid rgba(180,140,60,0.2); margin-bottom:1.5rem; display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
        .ed-draft-text { font-size:0.8rem; color:rgba(180,140,60,0.85); font-weight:300; line-height:1.5; }
        .ed-draft-text strong { font-weight:500; display:block; margin-bottom:0.2rem; color:rgba(180,140,60,1); }

        .ed-body { display:grid; grid-template-columns:1fr 320px; gap:1.5rem; align-items:start; }
        @media (max-width:768px) { .ed-body { grid-template-columns:1fr; } }

        .ed-card { background:var(--bg-2); border:1px solid var(--border); padding:1.5rem; margin-bottom:1.25rem; }
        .ed-card-title { font-size:0.62rem; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--gold); margin-bottom:1.125rem; display:flex; align-items:center; gap:0.75rem; }
        .ed-card-title::after { content:''; flex:1; height:1px; background:var(--border); }

        .ed-description { font-size:0.88rem; color:var(--text-2); line-height:1.7; font-weight:300; }

        .ed-link-label { font-size:0.68rem; color:var(--text-3); letter-spacing:0.08em; text-transform:uppercase; margin-bottom:0.5rem; }
        .ed-link-row { display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem; }
        .ed-link-input { flex:1; padding:0.65rem 0.875rem; background:var(--bg); border:1px solid var(--border); color:var(--text-2); font-family:'DM Sans',sans-serif; font-size:0.78rem; outline:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .ed-copy-btn { padding:0.65rem 1rem; background:transparent; border:1px solid var(--border); color:var(--text-3); font-size:0.72rem; letter-spacing:0.06em; cursor:pointer; transition:all 0.2s; white-space:nowrap; font-family:'DM Sans',sans-serif; }
        .ed-copy-btn:hover { border-color:var(--gold); color:var(--gold); }
        .ed-copy-btn.copied { border-color:#22c55e; color:#22c55e; }

        .ed-invite-note { font-size:0.75rem; color:var(--text-3); line-height:1.6; padding:0.875rem; background:var(--bg); border-left:2px solid rgba(180,140,60,0.3); }

        .ed-tiers { display:flex; flex-direction:column; gap:0.75rem; }
        .ed-tier-card { padding:1rem 1.125rem; background:var(--bg); border:1px solid var(--border); display:flex; align-items:center; gap:1rem; }
        .ed-tier-swatch { width:10px; height:44px; flex-shrink:0; border-radius:2px; }
        .ed-tier-info { flex:1; min-width:0; }
        .ed-tier-name { font-size:0.9rem; font-weight:500; color:var(--text); margin-bottom:0.25rem; }
        .ed-tier-meta { font-size:0.7rem; color:var(--text-3); display:flex; gap:0.75rem; flex-wrap:wrap; }
        .ed-tier-count { font-size:0.88rem; font-weight:400; color:var(--text-2); text-align:right; white-space:nowrap; }
        .ed-tier-count span { display:block; font-size:0.62rem; color:var(--text-3); letter-spacing:0.06em; text-transform:uppercase; }

        .ed-stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; }
        .ed-stat { padding:1rem; background:var(--bg); border:1px solid var(--border); text-align:center; }
        .ed-stat-num { font-family:'Cormorant Garamond',serif; font-size:1.875rem; font-weight:300; color:var(--gold); line-height:1; margin-bottom:0.3rem; }
        .ed-stat-label { font-size:0.6rem; color:var(--text-3); letter-spacing:0.1em; text-transform:uppercase; }

        .ed-info-row { display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:0.5rem 0; border-bottom:1px solid var(--border); }
        .ed-info-row:last-child { border-bottom:none; }
        .ed-info-key { font-size:0.68rem; color:var(--text-3); letter-spacing:0.06em; text-transform:uppercase; }
        .ed-info-val { font-size:0.8rem; color:var(--text-2); text-align:right; }
      `}</style>

      <div className="ed-page">

        {/* Topbar */}
        <div className="ed-topbar">
          <Link href="/events" className="ed-back">← Events</Link>
          <div className="ed-actions">
            {event.status === "DRAFT" && (
              <button className="ed-btn ed-btn-gold" onClick={handlePublish} disabled={publishing}>
                {publishing ? "Publishing…" : "Publish Event"}
              </button>
            )}
            <Link href={`/events/${id}/edit`} className="ed-btn ed-btn-ghost">Edit</Link>
            <button className="ed-btn ed-btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>

        {/* Cover */}
        <div className="ed-cover">
          {event.coverImage
            ? <Image src={event.coverImage} alt={event.title} fill style={{ objectFit: "cover" }} />
            : <div className="ed-cover-placeholder">No cover image</div>
          }
        </div>

        {/* Header */}
        <div className="ed-header">
          <div className="ed-status-row">
            <span className="ed-status-badge" style={{ color: status.color, borderColor: `${status.color}40`, background: `${status.color}12` }}>
              <span className="ed-status-dot" style={{ background: status.color }} />
              {status.label}
            </span>
            <span className="ed-badge">{event.inviteModel === "OPEN" ? "🌐 Open Invites" : "🔒 Closed Invites"}</span>
            {event.requireOtp && <span className="ed-badge">🔑 OTP Required</span>}
          </div>
          <h1 className="ed-title">{event.title}</h1>
          <div className="ed-meta">
            <span className="ed-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {dateStr} · {timeStr}
            </span>
            <span className="ed-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              {event.venue}, {event.city}, {event.state}
            </span>
          </div>
        </div>

        {/* Draft banner */}
        {event.status === "DRAFT" && (
          <div className="ed-draft-banner">
            <div className="ed-draft-text">
              <strong>This event is a draft</strong>
              Guests cannot access invitation links until you publish.
            </div>
            <button className="ed-btn ed-btn-gold" onClick={handlePublish} disabled={publishing}>
              {publishing ? "Publishing…" : "Publish Now"}
            </button>
          </div>
        )}

        {/* Body */}
        <div className="ed-body">

          {/* Left */}
          <div>
            {event.description && (
              <div className="ed-card">
                <div className="ed-card-title">About</div>
                <p className="ed-description">{event.description}</p>
              </div>
            )}

            <div className="ed-card">
              <div className="ed-card-title">Invitation Links</div>
              {event.inviteModel === "OPEN" ? (
                <>
                  <div className="ed-link-label">Public RSVP Link</div>
                  <div className="ed-link-row">
                    <div className="ed-link-input">{openLink}</div>
                    <button
                      className={`ed-copy-btn${copied === "open" ? " copied" : ""}`}
                      onClick={() => copyToClipboard(openLink, "open")}
                    >
                      {copied === "open" ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="ed-invite-note">
                    Anyone with this link can RSVP. Share on social media, WhatsApp, or email.
                    {event.requireOtp && " Guests will verify with a one-time code before their RSVP is confirmed."}
                  </div>
                </>
              ) : (
                <>
                  <div className="ed-invite-note">
                    Personalised links are generated per guest via their unique <code style={{ background: "var(--bg)", padding: "0.1rem 0.35rem", fontSize: "0.75rem" }}>inviteToken</code>.<br /><br />
                    Format: <span style={{ color: "var(--gold)", fontSize: "0.78rem" }}>{baseUrl}/invite/<strong>[token]</strong></span><br /><br />
                    Manage and share individual links from the Guest Manager.
                  </div>
                  <Link href={`/events/${id}/guests`} className="ed-btn ed-btn-ghost" style={{ marginTop: "1rem", display: "inline-flex" }}>
                    Manage Guests →
                  </Link>
                </>
              )}
            </div>

            {event.guestTiers.length > 0 && (
              <div className="ed-card">
                <div className="ed-card-title">Guest Tiers</div>
                <div className="ed-tiers">
                  {event.guestTiers.map(tier => (
                    <div className="ed-tier-card" key={tier.id}>
                      <div className="ed-tier-swatch" style={{ background: tier.color }} title={tier.color} />
                      <div className="ed-tier-info">
                        <div className="ed-tier-name">{tier.name}</div>
                        <div className="ed-tier-meta">
                          <span>{tier.seatingType === "PRE_ASSIGNED" ? "Pre-assigned" : "Dynamic"} seating</span>
                          <span>Menu {tier.menuAccess === "PRE_EVENT" ? "pre-event" : "at event"}</span>
                          {tier.tablePrefix && <span>Prefix: {tier.tablePrefix}</span>}
                        </div>
                      </div>
                      <div className="ed-tier-count">
                        {tier._count?.guests ?? 0}<span>of {tier.capacity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div>
            <div className="ed-card">
              <div className="ed-card-title">Stats</div>
              <div className="ed-stat-grid">
                <div className="ed-stat">
                  <div className="ed-stat-num">{event._count?.guests ?? 0}</div>
                  <div className="ed-stat-label">Guests</div>
                </div>
                <div className="ed-stat">
                  <div className="ed-stat-num">{event.guestTiers.length}</div>
                  <div className="ed-stat-label">Tiers</div>
                </div>
                <div className="ed-stat">
                  <div className="ed-stat-num">{event.guestTiers.reduce((a, t) => a + t.capacity, 0)}</div>
                  <div className="ed-stat-label">Capacity</div>
                </div>
                <div className="ed-stat">
                  <div className="ed-stat-num">{event.guestTiers.reduce((a, t) => a + (t._count?.guests ?? 0), 0)}</div>
                  <div className="ed-stat-label">RSVPs</div>
                </div>
              </div>
            </div>

            <div className="ed-card">
              <div className="ed-card-title">Details</div>
              {[
                { label: "Slug",         value: event.slug },
                { label: "Invite Model", value: event.inviteModel },
                { label: "OTP",          value: event.requireOtp ? "Required" : "Not required" },
                { label: "Country",      value: event.country },
                { label: "Created",      value: new Date(event.createdAt).toLocaleDateString("en-NG") },
              ].map(row => (
                <div className="ed-info-row" key={row.label}>
                  <span className="ed-info-key">{row.label}</span>
                  <span className="ed-info-val">{row.value}</span>
                </div>
              ))}
            </div>

            {event.brandColor && (
              <div className="ed-card">
                <div className="ed-card-title">Brand Color</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                  <div style={{ width: 32, height: 32, background: event.brandColor, borderRadius: 3, border: "1px solid var(--border)", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.82rem", color: "var(--text-2)", fontFamily: "monospace" }}>{event.brandColor}</span>
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Link href={`/events/${id}/edit`} className="ed-btn ed-btn-ghost">Edit Event</Link>
              <Link href={`/events/${id}/guests`} className="ed-btn ed-btn-ghost">Manage Guests</Link>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
