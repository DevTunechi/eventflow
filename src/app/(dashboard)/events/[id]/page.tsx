"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import Link from "next/link"
import Image from "next/image"
import PostPublishChecklist from "@/components/PostPublishChecklist"

// ─────────────────────────────────────────────
// HostLinkCard
// ─────────────────────────────────────────────

interface HostLinkCardProps {
  eventId:   string
  eventName: string
}

interface HostLinkStatus {
  hasHostLink: boolean
  hostEmail:   string | null
  hostName:    string | null
  hostLink:    string | null
}

function HostLinkCard({ eventId, eventName }: HostLinkCardProps) {
  const [status,   setStatus]   = useState<HostLinkStatus | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [form,     setForm]     = useState({ hostName: "", hostEmail: "" })
  const [sending,  setSending]  = useState(false)
  const [sent,     setSent]     = useState(false)
  const [copied,   setCopied]   = useState(false)
  const [error,    setError]    = useState("")
  const [showForm, setShowForm] = useState(false)

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === "undefined") return {}
    const token = localStorage.getItem("ef-session") ?? ""
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/host-link`, { headers: getAuthHeaders() })
        if (res.ok) setStatus(await res.json())
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [eventId])

  const handleSend = async () => {
    if (!form.hostName.trim() || !form.hostEmail.trim()) { setError("Both fields are required."); return }
    setSending(true); setError("")
    try {
      const res = await fetch(`/api/events/${eventId}/host-link`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify({ hostName: form.hostName, hostEmail: form.hostEmail, resend: true }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed"); return }
      const d = await res.json()
      setStatus({ hasHostLink: true, hostEmail: form.hostEmail, hostName: form.hostName, hostLink: d.hostLink })
      setSent(true)
      setShowForm(false)
    } catch { setError("Failed to send host link") }
    finally { setSending(false) }
  }

  const copyLink = () => {
    if (!status?.hostLink) return
    navigator.clipboard.writeText(status.hostLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return null

  return (
    <div style={{
      background: "var(--bg-2)", border: "1px solid var(--border)",
      padding: "1.375rem", marginBottom: "1.25rem",
    }}>
      <div style={{
        fontSize: "0.6rem", fontWeight: 500, letterSpacing: "0.2em",
        textTransform: "uppercase", color: "var(--gold)", marginBottom: "1.125rem",
        display: "flex", alignItems: "center", gap: "0.75rem",
      }}>
        Host Access
        <span style={{ flex: 1, height: 1, background: "var(--border)", display: "block" }} />
      </div>

      {status?.hasHostLink ? (
        <>
          <p style={{ fontSize: "0.75rem", color: "var(--text-2)", marginBottom: "0.75rem", lineHeight: 1.6 }}>
            Host link sent to <strong style={{ color: "var(--text)" }}>{status.hostName}</strong> ({status.hostEmail}).
            {sent && <span style={{ color: "#22c55e" }}> ✓ Just sent.</span>}
          </p>

          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <div style={{
              flex: 1, minWidth: 0, padding: "0.5rem 0.75rem", background: "var(--bg)",
              border: "1px solid var(--border)", fontSize: "0.72rem",
              color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {status.hostLink}
            </div>
            <button onClick={copyLink} style={{
              padding: "0.5rem 0.875rem", background: "transparent",
              border: `1px solid ${copied ? "#22c55e" : "var(--border)"}`,
              color: copied ? "#22c55e" : "var(--text-3)",
              fontFamily: "'DM Sans', sans-serif", fontSize: "0.7rem",
              cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap",
              flexShrink: 0,
            }}>
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>

          {!showForm ? (
            <button onClick={() => setShowForm(true)} style={{
              background: "transparent", border: "none", padding: 0,
              color: "var(--text-3)", fontSize: "0.7rem", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", textDecoration: "underline",
            }}>
              Send to a different person
            </button>
          ) : (
            <HostLinkForm
              form={form} setForm={setForm} error={error}
              sending={sending} onSend={handleSend} onCancel={() => setShowForm(false)}
            />
          )}
        </>
      ) : (
        <>
          <p style={{ fontSize: "0.75rem", color: "var(--text-2)", lineHeight: 1.6, marginBottom: "1rem" }}>
            Give the host a read-only link to track RSVPs, check-in progress, gifts, and tributes in real time.
          </p>
          {!showForm ? (
            <button onClick={() => setShowForm(true)} style={{
              padding: "0.5rem 1rem", background: "var(--gold)", color: "#0a0a0a",
              border: "none", fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem",
              fontWeight: 500, cursor: "pointer", letterSpacing: "0.04em",
            }}>
              Send Host Link
            </button>
          ) : (
            <HostLinkForm
              form={form} setForm={setForm} error={error}
              sending={sending} onSend={handleSend} onCancel={() => setShowForm(false)}
            />
          )}
        </>
      )}
    </div>
  )
}

function HostLinkForm({ form, setForm, error, sending, onSend, onCancel }: {
  form:     { hostName: string; hostEmail: string }
  setForm:  (f: { hostName: string; hostEmail: string }) => void
  error:    string
  sending:  boolean
  onSend:   () => void
  onCancel: () => void
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <input
        placeholder="Host's name (e.g. Adunola)"
        value={form.hostName}
        onChange={e => setForm({ ...form, hostName: e.target.value })}
        style={{
          padding: "0.55rem 0.75rem", background: "var(--bg-3)",
          border: "1px solid var(--border)", borderRadius: 5,
          color: "var(--text)", fontFamily: "'DM Sans', sans-serif",
          fontSize: "0.8rem", outline: "none", width: "100%",
        }}
      />
      <input
        placeholder="Host's email"
        type="email"
        value={form.hostEmail}
        onChange={e => setForm({ ...form, hostEmail: e.target.value })}
        style={{
          padding: "0.55rem 0.75rem", background: "var(--bg-3)",
          border: "1px solid var(--border)", borderRadius: 5,
          color: "var(--text)", fontFamily: "'DM Sans', sans-serif",
          fontSize: "0.8rem", outline: "none", width: "100%",
        }}
      />
      {error && <p style={{ fontSize: "0.72rem", color: "#ef4444" }}>{error}</p>}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button onClick={onSend} disabled={sending} style={{
          flex: 1, padding: "0.55rem", background: "var(--gold)", color: "#0a0a0a",
          border: "none", fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem",
          fontWeight: 500, cursor: "pointer", opacity: sending ? 0.5 : 1,
        }}>
          {sending ? "Sending…" : "Send via Email"}
        </button>
        <button onClick={onCancel} style={{
          padding: "0.55rem 0.875rem", background: "transparent",
          border: "1px solid var(--border)", color: "var(--text-3)",
          fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", cursor: "pointer",
        }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// EventDetailPage
// ─────────────────────────────────────────────

interface GuestTier {
  id: string
  name: string
  color: string | null
  maxGuests: number | null
  seatingType: "PRE_ASSIGNED" | "DYNAMIC"
  menuAccess: "PRE_EVENT" | "AT_EVENT"
  tablePrefix: string | null
  _count?: { guests: number }
}

interface Vendor { id: string; name: string; role: string }
interface Usher  { id: string; name: string; role: string }

interface EventDetail {
  id: string
  name: string
  slug: string
  description: string | null
  eventType: string
  eventDate: string
  startTime: string | null
  endTime: string | null
  venueName: string | null
  venueAddress: string | null
  venueCapacity: number | null
  invitationCard: string | null
  brandColor: string | null
  inviteModel: "OPEN" | "CLOSED"
  requireOtp: boolean
  rsvpDeadline: string | null
  status: "DRAFT" | "PUBLISHED" | "ONGOING" | "COMPLETED" | "CANCELLED"
  guestTiers: GuestTier[]
  vendors: Vendor[]
  ushers: Usher[]
  _count?: { guests: number }
  createdAt: string
}

const STATUS_CONFIG = {
  DRAFT:     { color: "#6b7280", label: "Draft"     },
  PUBLISHED: { color: "#22c55e", label: "Published" },
  ONGOING:   { color: "#f59e0b", label: "Ongoing"   },
  COMPLETED: { color: "#3b82f6", label: "Completed" },
  CANCELLED: { color: "#ef4444", label: "Cancelled" },
}

const NAV_TABS = [
  { key: "guests",  label: "Guests",  icon: "👥", desc: "Add guests and manage RSVPs"      },
  { key: "vendors", label: "Vendors", icon: "🏢", desc: "Caterers, security, media & more" },
  { key: "ushers",  label: "Ushers",  icon: "🎯", desc: "Gate and floor usher assignments" },
  { key: "tables",  label: "Tables",  icon: "🪑", desc: "Seating layout and assignments"   },
  { key: "menu",    label: "Menu",    icon: "🍽️", desc: "Food and drink management"        },
]

export default function EventDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const { user } = useAuth()

  const [event,         setEvent]         = useState<EventDetail | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [copied,        setCopied]        = useState(false)
  const [publishing,    setPublishing]    = useState(false)
  const [deleting,      setDeleting]      = useState(false)
  const [showChecklist, setShowChecklist] = useState(false)

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("ef-session") ?? ""
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${id}`, { headers: getAuthHeaders() })
      if (!res.ok) throw new Error("Failed to load event")
      const data = await res.json()
      setEvent({
        ...data.event,
        guestTiers: data.event.guestTiers ?? [],
        vendors:    data.event.vendors    ?? [],
        ushers:     data.event.ushers     ?? [],
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchEvent() }, [fetchEvent])

  const copyLink = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePublish = async () => {
    if (!event) return
    setPublishing(true)
    try {
      const res = await fetch(`/api/events/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify({ status: "PUBLISHED" }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEvent({
        ...data.event,
        guestTiers: data.event.guestTiers ?? [],
        vendors:    data.event.vendors    ?? [],
        ushers:     data.event.ushers     ?? [],
      })
      setShowChecklist(true)
    } catch { console.error("Publish failed") }
    finally  { setPublishing(false) }
  }

  const handleDelete = async () => {
    if (!event || !confirm("Delete this event? This cannot be undone.")) return
    setDeleting(true)
    try {
      await fetch(`/api/events/${id}`, { method: "DELETE", headers: getAuthHeaders() })
      router.push("/events")
    } catch { setDeleting(false) }
  }

  const baseUrl  = typeof window !== "undefined" ? window.location.origin : ""
  const openLink = `${baseUrl}/invite/${event?.slug}`

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

  const status    = STATUS_CONFIG[event.status]
  const eventDate = new Date(event.eventDate)
  const dateStr   = eventDate.toLocaleDateString("en-NG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        /* ── Root ── */
        .ed {
          max-width: 1000px;
          margin: 0 auto;
          padding: 2rem 1.25rem 4rem;
          animation: edIn 0.35s ease;
          width: 100%;
          /* Prevent ANY child from causing horizontal scroll */
          overflow-x: hidden;
        }
        @keyframes edIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }

        /* ── Top bar ── */
        .ed-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 0.75rem;
          width: 100%;
        }
        .ed-back {
          font-size: 0.78rem; color: var(--text-3); text-decoration: none;
          display: flex; align-items: center; gap: 0.35rem; transition: color 0.2s;
          flex-shrink: 0;
        }
        .ed-back:hover { color: var(--gold); }

        /* Action buttons row — wraps neatly on mobile */
        .ed-acts {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          /* Push to right but allow wrap-down, never clip */
          justify-content: flex-end;
          flex: 1;
          min-width: 0;
        }

        /* ── Buttons ── */
        .ed-btn {
          padding: 0.5rem 1rem;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          cursor: pointer;
          border: none;
          text-decoration: none;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          white-space: nowrap;
        }
        .ed-btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--text-2); }
        .ed-btn-ghost:hover { border-color: var(--border-hover); color: var(--text); }
        .ed-btn-gold  { background: var(--gold); color: #0a0a0a; font-weight: 500; }
        .ed-btn-gold:hover    { background: #c9a050; }
        .ed-btn-gold:disabled { opacity: 0.5; cursor: not-allowed; }
        .ed-btn-red  { background: transparent; border: 1px solid rgba(239,68,68,0.25); color: rgba(239,68,68,0.6); }
        .ed-btn-red:hover    { border-color: #ef4444; color: #ef4444; }
        .ed-btn-red:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── Cover image ── */
        .ed-cover {
          width: 100%;
          aspect-ratio: 16/5.5;
          position: relative;
          overflow: hidden;
          background: var(--bg-2);
          margin-bottom: 2rem;
        }
        .ed-cover-empty {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--text-3);
        }

        /* ── Header ── */
        .ed-hdr { margin-bottom: 2rem; }
        .ed-badges {
          display: flex; align-items: center; gap: 0.5rem;
          margin-bottom: 0.875rem; flex-wrap: wrap;
        }
        .ed-status {
          display: flex; align-items: center; gap: 0.35rem;
          padding: 0.28rem 0.7rem; border-radius: 99px;
          font-size: 0.65rem; font-weight: 500; letter-spacing: 0.08em;
          text-transform: uppercase; border: 1px solid;
          white-space: nowrap;
        }
        .ed-status-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
        .ed-badge {
          font-size: 0.65rem; letter-spacing: 0.05em; color: var(--text-3);
          padding: 0.28rem 0.7rem; border: 1px solid var(--border);
          white-space: nowrap;
        }
        .ed-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(1.625rem, 5vw, 3rem);
          font-weight: 300; line-height: 1.15;
          color: var(--text); margin-bottom: 0.875rem;
          letter-spacing: -0.01em;
          /* Long event names should wrap, not overflow */
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        .ed-meta { display: flex; flex-wrap: wrap; gap: 0.375rem 1.25rem; }
        .ed-meta-item {
          display: flex; align-items: flex-start; gap: 0.45rem;
          font-size: 0.8rem; color: var(--text-2); font-weight: 300;
          min-width: 0; word-break: break-word;
        }
        .ed-meta-item svg { color: var(--gold); flex-shrink: 0; margin-top: 2px; }

        /* ── Draft banner ── */
        .ed-draft {
          padding: 1rem 1.25rem;
          background: rgba(180,140,60,0.06);
          border: 1px solid rgba(180,140,60,0.2);
          margin-bottom: 1.75rem;
          display: flex; align-items: center;
          justify-content: space-between;
          gap: 1rem; flex-wrap: wrap;
        }
        .ed-draft-text { font-size: 0.8rem; color: rgba(180,140,60,0.85); line-height: 1.5; }
        .ed-draft-text strong { font-weight: 500; display: block; color: #b48c3c; margin-bottom: 0.15rem; }

        /* ── Two-column body ── */
        .ed-body {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 1.5rem;
          align-items: start;
          width: 100%;
          min-width: 0;
        }
        /* Stack to single column on anything below ~700px */
        @media (max-width: 700px) {
          .ed-body { grid-template-columns: 1fr; }
          .ed { padding: 1.5rem 1rem 4rem; }
        }

        /* ── Cards ── */
        .ed-card {
          background: var(--bg-2);
          border: 1px solid var(--border);
          padding: 1.375rem;
          margin-bottom: 1.25rem;
          min-width: 0;
          /* Prevent inner content from exploding card width */
          overflow: hidden;
        }
        .ed-card-title {
          font-size: 0.6rem; font-weight: 500; letter-spacing: 0.2em;
          text-transform: uppercase; color: var(--gold);
          margin-bottom: 1.125rem;
          display: flex; align-items: center; gap: 0.75rem;
        }
        .ed-card-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }

        /* ── Invite link block ── */
        .ed-link-label {
          font-size: 0.65rem; color: var(--text-3);
          letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 0.45rem;
        }
        .ed-link-row {
          display: flex; gap: 0.5rem; margin-bottom: 0.75rem;
          min-width: 0; max-width: 100%;
        }
        .ed-link-val {
          flex: 1; min-width: 0;
          padding: 0.6rem 0.875rem;
          background: var(--bg); border: 1px solid var(--border);
          color: var(--text-2); font-size: 0.76rem;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ed-copy {
          padding: 0.6rem 0.875rem; background: transparent;
          border: 1px solid var(--border); color: var(--text-3);
          font-size: 0.7rem; letter-spacing: 0.05em;
          cursor: pointer; transition: all 0.2s;
          font-family: 'DM Sans', sans-serif; white-space: nowrap; flex-shrink: 0;
        }
        .ed-copy:hover { border-color: var(--gold); color: var(--gold); }
        .ed-copy.ok    { border-color: #22c55e; color: #22c55e; }
        .ed-note {
          font-size: 0.73rem; color: var(--text-3); line-height: 1.6;
          padding: 0.75rem; background: var(--bg);
          border-left: 2px solid rgba(180,140,60,0.3);
          /* URLs inside notes should wrap */
          word-break: break-all;
          overflow-wrap: anywhere;
        }

        /* ── Guest tiers ── */
        .ed-tiers { display: flex; flex-direction: column; gap: 0.625rem; }
        .ed-tier {
          padding: 0.875rem 1rem; background: var(--bg);
          border: 1px solid var(--border);
          display: flex; align-items: center; gap: 0.875rem;
          min-width: 0;
        }
        .ed-tier-bar { width: 4px; height: 40px; flex-shrink: 0; border-radius: 2px; }
        .ed-tier-info { flex: 1; min-width: 0; }
        .ed-tier-name { font-size: 0.875rem; font-weight: 500; color: var(--text); margin-bottom: 0.2rem; word-break: break-word; }
        .ed-tier-meta { font-size: 0.68rem; color: var(--text-3); display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .ed-tier-chip {
          font-size: 0.6rem; font-weight: 500; letter-spacing: 0.06em;
          padding: 0.15rem 0.45rem; border-radius: 99px; border: 1px solid; white-space: nowrap;
        }
        .ed-tier-count { text-align: right; white-space: nowrap; flex-shrink: 0; }
        .ed-tier-count-num   { font-size: 0.95rem; color: var(--text-2); font-weight: 400; }
        .ed-tier-count-label { font-size: 0.6rem; color: var(--text-3); letter-spacing: 0.06em; text-transform: uppercase; }

        /* ── Manage Event nav ── */
        .ed-nextsteps { display: flex; flex-direction: column; gap: 0.5rem; }
        .ed-nav-card {
          display: flex; align-items: center; gap: 0.875rem;
          padding: 0.875rem 1rem; background: var(--bg);
          border: 1px solid var(--border); text-decoration: none;
          transition: all 0.2s; cursor: pointer;
          min-width: 0;
        }
        .ed-nav-card:hover { border-color: var(--gold); background: rgba(180,140,60,0.04); }
        .ed-nav-icon  { font-size: 1.125rem; flex-shrink: 0; width: 32px; text-align: center; }
        .ed-nav-info  { flex: 1; min-width: 0; }
        .ed-nav-label { font-size: 0.82rem; font-weight: 500; color: var(--text); margin-bottom: 0.15rem; }
        .ed-nav-desc  { font-size: 0.7rem; color: var(--text-3); }
        .ed-nav-count {
          font-size: 0.7rem; color: var(--text-3); white-space: nowrap;
          padding: 0.2rem 0.5rem; border: 1px solid var(--border); flex-shrink: 0;
        }
        .ed-nav-arrow { color: var(--text-3); font-size: 0.8rem; flex-shrink: 0; transition: transform 0.2s; }
        .ed-nav-card:hover .ed-nav-arrow { transform: translateX(3px); color: var(--gold); }

        /* ── Stats grid ── */
        .ed-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.625rem; }
        .ed-stat  { padding: 0.875rem; background: var(--bg); border: 1px solid var(--border); text-align: center; }
        .ed-stat-num   { font-family: 'Cormorant Garamond', serif; font-size: 1.875rem; font-weight: 300; color: var(--gold); line-height: 1; margin-bottom: 0.25rem; }
        .ed-stat-label { font-size: 0.58rem; color: var(--text-3); letter-spacing: 0.1em; text-transform: uppercase; }

        /* ── Details rows ── */
        .ed-info-row {
          display: flex; justify-content: space-between; align-items: center;
          gap: 0.75rem; padding: 0.5rem 0; border-bottom: 1px solid var(--border);
        }
        .ed-info-row:last-child { border-bottom: none; }
        .ed-info-k { font-size: 0.65rem; color: var(--text-3); letter-spacing: 0.06em; text-transform: uppercase; flex-shrink: 0; }
        .ed-info-v { font-size: 0.78rem; color: var(--text-2); text-align: right; word-break: break-all; overflow-wrap: anywhere; }

        /* ── Description ── */
        .ed-description { font-size: 0.85rem; color: var(--text-2); line-height: 1.7; font-weight: 300; word-break: break-word; }

        /* ── Sidebar bottom action on mobile ── */
        .ed-sidebar-actions { display: flex; flex-direction: column; gap: 0.5rem; }
      `}</style>

      <div className="ed">

        {/* Topbar */}
        <div className="ed-top">
          <Link href="/events" className="ed-back">← Events</Link>
          <div className="ed-acts">
            {event.status === "DRAFT" && (
              <button className="ed-btn ed-btn-gold" onClick={handlePublish} disabled={publishing}>
                {publishing ? "Publishing…" : "Publish"}
              </button>
            )}
            <Link href={`/events/${id}/edit`} className="ed-btn ed-btn-ghost">Edit</Link>
            <button className="ed-btn ed-btn-red" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>

        {/* Cover */}
        <div className="ed-cover">
          {event.invitationCard
            ? <Image src={event.invitationCard} alt={event.name} fill style={{ objectFit: "cover" }} unoptimized />
            : <div className="ed-cover-empty">No invitation card uploaded</div>
          }
        </div>

        {/* Header */}
        <div className="ed-hdr">
          <div className="ed-badges">
            <span className="ed-status" style={{ color: status.color, borderColor: `${status.color}40`, background: `${status.color}12` }}>
              <span className="ed-status-dot" style={{ background: status.color }} />
              {status.label}
            </span>
            <span className="ed-badge">{event.inviteModel === "OPEN" ? "🌐 Open" : "🔒 Closed"} Invites</span>
            {event.requireOtp && <span className="ed-badge">🔑 OTP</span>}
            <span className="ed-badge">{event.eventType.charAt(0) + event.eventType.slice(1).toLowerCase()}</span>
          </div>

          <h1 className="ed-title">{event.name}</h1>

          <div className="ed-meta">
            <span className="ed-meta-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {dateStr}{event.startTime && ` · ${event.startTime}`}
            </span>
            {event.venueName && (
              <span className="ed-meta-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {event.venueName}{event.venueAddress && `, ${event.venueAddress}`}
              </span>
            )}
          </div>
        </div>

        {/* Draft banner */}
        {event.status === "DRAFT" && (
          <div className="ed-draft">
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

          {/* ── Left column ── */}
          <div style={{ minWidth: 0 }}>
            {event.description && (
              <div className="ed-card">
                <div className="ed-card-title">About</div>
                <p className="ed-description">{event.description}</p>
              </div>
            )}

            {/* Invite links */}
            <div className="ed-card">
              <div className="ed-card-title">Invitation Link</div>
              {event.inviteModel === "OPEN" ? (
                <>
                  <div className="ed-link-label">Public RSVP Link</div>
                  <div className="ed-link-row">
                    <div className="ed-link-val">{openLink}</div>
                    <button className={`ed-copy${copied ? " ok" : ""}`} onClick={() => copyLink(openLink)}>
                      {copied ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="ed-note">
                    Anyone with this link can RSVP.{event.requireOtp && " Guests must verify their phone number with an OTP."}
                  </div>
                </>
              ) : (
                <>
                  <div className="ed-note">
                    Personalised links are generated per guest.<br /><br />
                    Format: <span style={{ color: "var(--gold)", fontSize: "0.76rem", wordBreak: "break-all" }}>{baseUrl}/invite/<strong>[token]</strong></span><br /><br />
                    Go to <strong>Guests</strong> to add guests and copy their individual links.
                  </div>
                  <Link href={`/events/${id}/guests`} className="ed-btn ed-btn-ghost" style={{ marginTop: "0.875rem", display: "inline-flex" }}>
                    Manage Guests →
                  </Link>
                </>
              )}
            </div>

            {/* Tiers */}
            {event.guestTiers.length > 0 && (
              <div className="ed-card">
                <div className="ed-card-title">Guest Tiers</div>
                <div className="ed-tiers">
                  {event.guestTiers.map(tier => (
                    <div className="ed-tier" key={tier.id}>
                      <div className="ed-tier-bar" style={{ background: tier.color ?? "#b48c3c" }} />
                      <div className="ed-tier-info">
                        <div className="ed-tier-name">{tier.name}</div>
                        <div className="ed-tier-meta">
                          <span className="ed-tier-chip" style={{
                            color: tier.seatingType === "PRE_ASSIGNED" ? "#4a9eff" : "#6b7280",
                            borderColor: tier.seatingType === "PRE_ASSIGNED" ? "rgba(74,158,255,0.3)" : "var(--border)",
                            background: tier.seatingType === "PRE_ASSIGNED" ? "rgba(74,158,255,0.08)" : "transparent",
                          }}>
                            {tier.seatingType === "PRE_ASSIGNED" ? "Pre-assigned" : "Dynamic"}
                          </span>
                          <span className="ed-tier-chip" style={{
                            color: tier.menuAccess === "PRE_EVENT" ? "#4caf7d" : "#6b7280",
                            borderColor: tier.menuAccess === "PRE_EVENT" ? "rgba(76,175,125,0.3)" : "var(--border)",
                            background: tier.menuAccess === "PRE_EVENT" ? "rgba(76,175,125,0.08)" : "transparent",
                          }}>
                            {tier.menuAccess === "PRE_EVENT" ? "Pre-order" : "At event"}
                          </span>
                          {tier.tablePrefix && (
                            <span style={{ color: "var(--text-3)", fontSize: "0.68rem" }}>Prefix: {tier.tablePrefix}</span>
                          )}
                        </div>
                      </div>
                      <div className="ed-tier-count">
                        <div className="ed-tier-count-num">{tier._count?.guests ?? 0}{tier.maxGuests ? `/${tier.maxGuests}` : ""}</div>
                        <div className="ed-tier-count-label">Guests</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manage Event nav */}
            <div className="ed-card">
              <div className="ed-card-title">Manage Event</div>
              <div className="ed-nextsteps">
                {NAV_TABS.map(tab => (
                  <Link key={tab.key} href={`/events/${id}/${tab.key}`} className="ed-nav-card">
                    <div className="ed-nav-icon">{tab.icon}</div>
                    <div className="ed-nav-info">
                      <div className="ed-nav-label">{tab.label}</div>
                      <div className="ed-nav-desc">{tab.desc}</div>
                    </div>
                    {tab.key === "vendors" && event.vendors.length > 0 && (
                      <span className="ed-nav-count">{event.vendors.length}</span>
                    )}
                    {tab.key === "ushers" && event.ushers.length > 0 && (
                      <span className="ed-nav-count">{event.ushers.length}</span>
                    )}
                    {tab.key === "guests" && (event._count?.guests ?? 0) > 0 && (
                      <span className="ed-nav-count">{event._count?.guests}</span>
                    )}
                    <span className="ed-nav-arrow">→</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Host Access */}
            <HostLinkCard eventId={event.id} eventName={event.name} />
          </div>

          {/* ── Right sidebar ── */}
          <div style={{ minWidth: 0 }}>
            <div className="ed-card">
              <div className="ed-card-title">Stats</div>
              <div className="ed-stats">
                <div className="ed-stat">
                  <div className="ed-stat-num">{event._count?.guests ?? 0}</div>
                  <div className="ed-stat-label">Guests</div>
                </div>
                <div className="ed-stat">
                  <div className="ed-stat-num">{event.guestTiers.length}</div>
                  <div className="ed-stat-label">Tiers</div>
                </div>
                <div className="ed-stat">
                  <div className="ed-stat-num">{event.venueCapacity ?? "—"}</div>
                  <div className="ed-stat-label">Capacity</div>
                </div>
                <div className="ed-stat">
                  <div className="ed-stat-num">{event.vendors.length}</div>
                  <div className="ed-stat-label">Vendors</div>
                </div>
              </div>
            </div>

            <div className="ed-card">
              <div className="ed-card-title">Details</div>
              {[
                { k: "Slug",    v: event.slug },
                { k: "Model",   v: event.inviteModel },
                { k: "OTP",     v: event.requireOtp ? "Required" : "Off" },
                { k: "Created", v: new Date(event.createdAt).toLocaleDateString("en-NG") },
                ...(event.rsvpDeadline ? [{ k: "RSVP Closes", v: new Date(event.rsvpDeadline).toLocaleDateString("en-NG") }] : []),
              ].map(row => (
                <div className="ed-info-row" key={row.k}>
                  <span className="ed-info-k">{row.k}</span>
                  <span className="ed-info-v">{row.v}</span>
                </div>
              ))}
            </div>

            {event.brandColor && (
              <div className="ed-card">
                <div className="ed-card-title">Brand Color</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ width: 30, height: 30, background: event.brandColor, borderRadius: 3, border: "1px solid var(--border)", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-2)", fontFamily: "monospace", wordBreak: "break-all" }}>{event.brandColor}</span>
                </div>
              </div>
            )}

            <div className="ed-sidebar-actions">
              <Link href={`/events/${id}/edit`} className="ed-btn ed-btn-ghost" style={{ justifyContent: "center" }}>Edit Event</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Post-publish checklist */}
      {showChecklist && event && (
        <PostPublishChecklist
          eventId={event.id}
          eventName={event.name}
          guestCount={event._count?.guests ?? 0}
          onClose={() => setShowChecklist(false)}
        />
      )}
    </>
  )
}
