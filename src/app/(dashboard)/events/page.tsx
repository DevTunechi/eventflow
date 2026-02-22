// ─────────────────────────────────────────────
// src/app/(dashboard)/events/page.tsx
//
// Events list — shows all planner's events
// with status badges, key stats, and quick
// actions. Entry point to the create flow.
// ─────────────────────────────────────────────

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"

interface Event {
  id:             string
  name:           string
  slug:           string
  eventType:      string
  eventDate:      string
  status:         string
  inviteModel:    string
  invitationCard: string | null
  venueName:      string | null
  venueCapacity:  number | null
  _count: {
    guests:  number
    vendors: number
  }
}

const STATUS = {
  DRAFT:     { label: "Draft",     color: "#f0a500" },
  PUBLISHED: { label: "Published", color: "#4caf7d" },
  ONGOING:   { label: "Ongoing",   color: "#38bdf8" },
  COMPLETED: { label: "Completed", color: "#6b7280" },
  CANCELLED: { label: "Cancelled", color: "#ef4444" },
} as Record<string, { label: string; color: string }>

const EVENT_TYPE_LABELS: Record<string, string> = {
  WEDDING: "Wedding", BIRTHDAY: "Birthday",
  CORPORATE: "Corporate", BURIAL: "Burial",
  ANNIVERSARY: "Anniversary", OTHER: "Other",
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-NG", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
  })

const daysUntil = (iso: string) => {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  if (days < 0)   return null
  if (days === 0) return "Today"
  if (days === 1) return "Tomorrow"
  return `In ${days} days`
}

export default function EventsPage() {
  const [events,  setEvents]  = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState("ALL")

  useEffect(() => {
    const token = localStorage.getItem("ef-session") ?? ""
    const hdrs: Record<string, string> = {};
    if (token) hdrs["Authorization"] = `Bearer ${token}`;

    fetch("/api/events", { headers: hdrs })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setEvents(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setEvents([]); setLoading(false) })
  }, [])

  const filtered = filter === "ALL"
    ? events
    : events.filter(e => e.status === filter)

  return (
    <>
      <style>{`
        .ev-root { max-width: 1200px; }

        .ev-header {
          display: flex; align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 2rem; gap: 1rem; flex-wrap: wrap;
        }

        .ev-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(1.5rem, 3vw, 2rem);
          font-weight: 300; color: var(--text);
          letter-spacing: -0.01em; margin-bottom: 0.25rem;
        }

        .ev-subtitle { font-size: 0.8rem; color: var(--text-3); font-weight: 300; }

        .ev-new-btn {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.625rem 1.25rem;
          background: var(--gold); color: #0a0a0a;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.8rem; font-weight: 500;
          letter-spacing: 0.03em; border: none;
          border-radius: 6px; cursor: pointer;
          text-decoration: none;
          transition: all 0.2s ease; white-space: nowrap; flex-shrink: 0;
        }

        .ev-new-btn:hover {
          background: #c9a84c; transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(180,140,60,0.3);
        }

        .ev-new-btn svg { width: 15px; height: 15px; }

        .ev-filters {
          display: flex; gap: 0.375rem;
          margin-bottom: 1.5rem; flex-wrap: wrap;
        }

        .ev-filter-btn {
          padding: 0.375rem 0.875rem; border-radius: 20px;
          font-size: 0.75rem; font-weight: 400;
          border: 1px solid var(--border);
          background: transparent; color: var(--text-2);
          cursor: pointer; transition: all 0.15s ease;
          font-family: 'DM Sans', sans-serif;
        }

        .ev-filter-btn:hover { border-color: var(--border-hover); color: var(--text); }
        .ev-filter-btn.active { background: var(--gold-dim); border-color: var(--gold); color: var(--gold); }

        /* 3-col grid → 2 → 1 */
        .ev-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.25rem;
        }

        .ev-card {
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-radius: 12px; overflow: hidden;
          text-decoration: none; color: inherit;
          display: flex; flex-direction: column;
          transition: all 0.2s ease; position: relative;
        }

        .ev-card:hover {
          border-color: var(--border-hover);
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.15);
        }

        .ev-card-thumb {
          width: 100%; aspect-ratio: 16 / 9;
          background: var(--bg-3); position: relative;
          overflow: hidden; flex-shrink: 0;
        }

        .ev-card-thumb-placeholder {
          width: 100%; height: 100%;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 0.5rem;
          background: linear-gradient(135deg, var(--bg-3), var(--bg-2));
        }

        .ev-card-thumb-placeholder svg { width: 28px; height: 28px; color: var(--text-3); opacity: 0.35; }
        .ev-card-thumb-placeholder span { font-size: 0.65rem; color: var(--text-3); letter-spacing: 0.05em; }

        /* Status badge — top right over thumbnail */
        .ev-card-status {
          position: absolute; top: 0.75rem; right: 0.75rem;
          font-size: 0.58rem; font-weight: 500;
          letter-spacing: 0.1em; text-transform: uppercase;
          padding: 0.25rem 0.6rem; border-radius: 20px;
          backdrop-filter: blur(8px); z-index: 2;
        }

        /* Invite model badge — top left */
        .ev-card-model {
          position: absolute; top: 0.75rem; left: 0.75rem;
          font-size: 0.6rem; font-weight: 500;
          padding: 0.2rem 0.5rem; border-radius: 20px;
          background: rgba(0,0,0,0.55); color: rgba(255,255,255,0.85);
          backdrop-filter: blur(8px); z-index: 2;
        }

        .ev-card-body {
          padding: 1.125rem; flex: 1;
          display: flex; flex-direction: column; gap: 0.625rem;
        }

        .ev-card-type {
          font-size: 0.62rem; font-weight: 500;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--gold);
        }

        .ev-card-name {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.25rem; font-weight: 400;
          color: var(--text); line-height: 1.2; letter-spacing: -0.01em;
        }

        .ev-card-meta {
          font-size: 0.775rem; color: var(--text-2);
          display: flex; align-items: center; gap: 0.45rem;
        }

        .ev-card-meta svg { width: 12px; height: 12px; color: var(--text-3); flex-shrink: 0; }

        .ev-card-countdown {
          font-size: 0.68rem; color: var(--gold);
          font-weight: 500; margin-left: 0.25rem;
        }

        .ev-card-stats {
          display: flex; gap: 1.25rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--border);
          margin-top: auto;
        }

        .ev-stat-val {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.25rem; font-weight: 400;
          color: var(--text); line-height: 1;
          display: block;
        }

        .ev-stat-label {
          font-size: 0.63rem; color: var(--text-3);
          letter-spacing: 0.03em; display: block;
          margin-top: 0.2rem;
        }

        /* Empty state */
        .ev-empty {
          grid-column: 1 / -1;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 5rem 2rem; text-align: center;
          border: 1px dashed var(--border);
          border-radius: 12px; gap: 1rem;
        }

        .ev-empty svg { width: 44px; height: 44px; color: var(--text-3); opacity: 0.3; }

        .ev-empty-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.375rem; font-weight: 300; color: var(--text-2);
        }

        .ev-empty-sub {
          font-size: 0.8rem; color: var(--text-3);
          max-width: 320px; line-height: 1.7;
        }

        /* Skeleton */
        .ev-skeleton {
          background: var(--bg-3); border-radius: 6px;
          animation: evShimmer 1.4s ease infinite;
        }

        @keyframes evShimmer {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.75; }
        }

        .ev-card-skeleton {
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-radius: 12px; overflow: hidden;
        }

        @media (max-width: 1024px) { .ev-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px)  {
          .ev-grid   { grid-template-columns: 1fr; }
          .ev-header { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <div className="ev-root">

        {/* Header */}
        <div className="ev-header">
          <div>
            <h2 className="ev-title">Your Events</h2>
            <p className="ev-subtitle">
              {loading ? "Loading..." : `${events.length} event${events.length !== 1 ? "s" : ""} total`}
            </p>
          </div>
          <Link href="/events/new" className="ev-new-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Event
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="ev-filters">
          {["ALL", "DRAFT", "PUBLISHED", "ONGOING", "COMPLETED", "CANCELLED"].map(f => (
            <button
              key={f}
              className={`ev-filter-btn ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "ALL" ? "All Events" : STATUS[f]?.label ?? f}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="ev-grid">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="ev-card-skeleton">
                  <div className="ev-skeleton" style={{ aspectRatio: "16/9" }} />
                  <div style={{ padding: "1.125rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div className="ev-skeleton" style={{ height: 10, width: "35%" }} />
                    <div className="ev-skeleton" style={{ height: 22, width: "70%" }} />
                    <div className="ev-skeleton" style={{ height: 12, width: "55%" }} />
                    <div style={{ display: "flex", gap: "1.25rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
                      <div className="ev-skeleton" style={{ height: 30, width: 40 }} />
                      <div className="ev-skeleton" style={{ height: 30, width: 40 }} />
                    </div>
                  </div>
                </div>
              ))

            : filtered.length === 0
              ? (
                <div className="ev-empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <path d="M16 2v4M8 2v4M3 10h18"/>
                  </svg>
                  <div className="ev-empty-title">
                    {filter === "ALL" ? "No events yet" : `No ${STATUS[filter]?.label?.toLowerCase()} events`}
                  </div>
                  <p className="ev-empty-sub">
                    {filter === "ALL"
                      ? "Create your first event to get started. It only takes a few minutes."
                      : `You have no ${STATUS[filter]?.label?.toLowerCase()} events right now.`
                    }
                  </p>
                  {filter === "ALL" && (
                    <Link href="/events/new" className="ev-new-btn" style={{ marginTop: "0.5rem" }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      Create your first event
                    </Link>
                  )}
                </div>
              )

              : filtered.map((event, i) => {
                  const st        = STATUS[event.status] ?? { label: event.status, color: "#6b7280" }
                  const countdown = daysUntil(event.eventDate)

                  return (
                    <Link key={event.id} href={`/events/${event.id}`} className="ev-card">

                      {/* Thumbnail */}
                      <div className="ev-card-thumb">
                        {event.invitationCard
                          ? <Image src={event.invitationCard} alt={event.name} fill style={{ objectFit: "cover" }} sizes="(max-width: 600px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                          : (
                            <div className="ev-card-thumb-placeholder">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                <rect x="3" y="3" width="18" height="18" rx="2"/>
                                <path d="M3 9h18M9 21V9"/>
                              </svg>
                              <span>No invite card uploaded</span>
                            </div>
                          )
                        }
                        {/* Invite model badge */}
                        <span className="ev-card-model">
                          {event.inviteModel === "CLOSED" ? "🔒 Closed Invite" : "🔓 Open Invite"}
                        </span>
                        {/* Status badge */}
                        <span className="ev-card-status" style={{ background: `${st.color}22`, color: st.color, border: `1px solid ${st.color}44` }}>
                          {st.label}
                        </span>
                      </div>

                      {/* Body */}
                      <div className="ev-card-body">
                        <span className="ev-card-type">{EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}</span>
                        <div className="ev-card-name">{event.name}</div>

                        <div className="ev-card-meta">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                          </svg>
                          {formatDate(event.eventDate)}
                          {countdown && <span className="ev-card-countdown">{countdown}</span>}
                        </div>

                        {event.venueName && (
                          <div className="ev-card-meta">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                            </svg>
                            {event.venueName}
                          </div>
                        )}

                        {/* Stats */}
                        <div className="ev-card-stats">
                          <div>
                            <span className="ev-stat-val">{event._count.guests}</span>
                            <span className="ev-stat-label">Guests</span>
                          </div>
                          <div>
                            <span className="ev-stat-val">{event._count.vendors}</span>
                            <span className="ev-stat-label">Vendors</span>
                          </div>
                          {event.venueCapacity && (
                            <div>
                              <span className="ev-stat-val">{event.venueCapacity}</span>
                              <span className="ev-stat-label">Capacity</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })
          }
        </div>
      </div>
    </>
  )
}
