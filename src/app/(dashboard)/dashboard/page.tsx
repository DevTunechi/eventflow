// ─────────────────────────────────────────────
// src/app/(dashboard)/dashboard/page.tsx
//
// Overview page — the first thing a planner
// sees after login. Shows:
//   - 7 stat cards (live counts from DB)
//   - Upcoming events list
//   - Recent RSVP activity feed
// ─────────────────────────────────────────────

"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import Link from "next/link"

// ── Types ─────────────────────────────────────

interface Stats {
  totalEvents:    number
  totalGuests:    number
  checkedIn:      number
  pendingRsvps:   number
  totalVendors:   number
  upcomingEvents: number
  gateCrashers:   number // guests who scanned twice — flagged on entry
}

interface UpcomingEvent {
  id:        string
  name:      string
  eventDate: string
  status:    string
  _count:    { guests: number }
}

interface RecentRsvp {
  id:         string
  firstName:  string
  lastName:   string
  rsvpAt:     string
  rsvpStatus: string
  event:      { name: string }
}

// ── Stat card definitions ─────────────────────
const getStatCards = (s: Stats) => [
  {
    label: "Total Events",
    value: s.totalEvents,
    accent: "#b48c3c",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
    ),
  },
  {
    label: "Guests RSVPd",
    value: s.totalGuests,
    accent: "#4a9eff",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    label: "Checked In",
    value: s.checkedIn,
    accent: "#4caf7d",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    ),
  },
  {
    label: "Pending RSVPs",
    value: s.pendingRsvps,
    accent: "#f0a500",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    label: "Total Vendors",
    value: s.totalVendors,
    accent: "#a78bfa",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      </svg>
    ),
  },
  {
    label: "Upcoming Events",
    value: s.upcomingEvents,
    accent: "#38bdf8",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
  },
  {
    label: "Gate Crashers",
    value: s.gateCrashers,
    accent: "#ef4444",
    alert: true, // shows red alert badge if value > 0
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
]

// ── Status colour maps ────────────────────────
const STATUS_COLORS: Record<string, string> = {
  CONFIRMED:  "#4caf7d",
  PENDING:    "#f0a500",
  DECLINED:   "#ef4444",
  WAITLISTED: "#a78bfa",
  NO_SHOW:    "#6b7280",
}

const EVENT_STATUS_COLORS: Record<string, string> = {
  PUBLISHED: "#4caf7d",
  DRAFT:     "#f0a500",
  ONGOING:   "#38bdf8",
  COMPLETED: "#6b7280",
  CANCELLED: "#ef4444",
}

// ── Helpers ───────────────────────────────────
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  })

const timeAgo = (iso: string) => {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 1)  return "just now"
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function OverviewPage() {
  const { user } = useAuth()

  const [stats,          setStats]          = useState<Stats | null>(null)
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([])
  const [recentRsvps,    setRecentRsvps]    = useState<RecentRsvp[]>([])
  const [loading,        setLoading]        = useState(true)

  // Fetch all three data sources in parallel on mount
  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem("ef-session") ?? ""
        const hdrs: Record<string, string> = {};
        if (token) hdrs["Authorization"] = `Bearer ${token}`;
        const [sRes, eRes, rRes] = await Promise.all([
          fetch("/api/auth/overview/stats",       { headers: hdrs }),
          fetch("/api/auth/overview/upcoming",    { headers: hdrs }),
          fetch("/api/auth/overview/recent-rsvps",{ headers: hdrs }),
        ])
        if (sRes.ok) setStats(await sRes.json())
        if (eRes.ok) setUpcomingEvents(await eRes.json())
        if (rRes.ok) setRecentRsvps(await rRes.json())
      } catch (e) {
        console.error("Overview load error:", e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Time-based greeting
  const hour      = new Date().getHours()
  const greeting  = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const firstName = user?.displayName?.split(" ")[0] ?? "Planner"

  return (
    <>
      <style>{`
        .ov-root { max-width: 1200px; }

        /* ── Greeting ── */
        .ov-greeting { margin-bottom: 2rem; }

        .ov-greeting-text {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(1.5rem, 3vw, 2rem);
          font-weight: 300;
          color: var(--text);
          letter-spacing: -0.01em;
          margin-bottom: 0.25rem;
        }

        .ov-greeting-text em { font-style: italic; color: var(--gold); }

        .ov-greeting-sub {
          font-size: 0.8rem;
          color: var(--text-3);
          font-weight: 300;
        }

        /* ── Stat grid — 4 cols → 3 → 2 ── */
        .ov-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .ov-stat-card {
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          transition: border-color 0.2s ease, transform 0.2s ease;
          position: relative;
          overflow: hidden;
          cursor: default;
        }

        .ov-stat-card:hover {
          border-color: var(--border-hover);
          transform: translateY(-2px);
        }

        /* Coloured top accent line per card */
        .ov-stat-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: var(--card-accent, var(--gold));
          opacity: 0.7;
        }

        .ov-stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .ov-stat-icon {
          width: 36px; height: 36px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        .ov-stat-icon svg { width: 16px; height: 16px; }

        /* Red "Alert" badge — only on gate crashers when > 0 */
        .ov-stat-alert {
          font-size: 0.6rem;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 0.2rem 0.5rem;
          border-radius: 20px;
          background: rgba(239,68,68,0.12);
          color: #ef4444;
          border: 1px solid rgba(239,68,68,0.2);
        }

        .ov-stat-value {
          font-family: 'Cormorant Garamond', serif;
          font-size: 2.25rem;
          font-weight: 400;
          color: var(--text);
          line-height: 1;
          letter-spacing: -0.02em;
        }

        .ov-stat-label {
          font-size: 0.72rem;
          color: var(--text-3);
          font-weight: 400;
          letter-spacing: 0.02em;
        }

        /* ── Bottom 2-col grid ── */
        .ov-bottom {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        /* ── Section card ── */
        .ov-section {
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-radius: 10px;
          overflow: hidden;
        }

        .ov-section-header {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .ov-section-title {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .ov-section-link {
          font-size: 0.7rem;
          color: var(--gold);
          text-decoration: none;
          opacity: 0.8;
          transition: opacity 0.15s;
        }

        .ov-section-link:hover { opacity: 1; }

        /* ── Event rows ── */
        .ov-event-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1.25rem;
          border-bottom: 1px solid var(--border);
          transition: background 0.15s;
          text-decoration: none;
          color: inherit;
        }

        .ov-event-item:last-child { border-bottom: none; }
        .ov-event-item:hover { background: var(--gold-dim); }

        .ov-event-info { flex: 1; min-width: 0; }

        .ov-event-name {
          font-size: 0.825rem;
          font-weight: 500;
          color: var(--text);
          margin-bottom: 0.2rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ov-event-meta {
          font-size: 0.7rem;
          color: var(--text-3);
        }

        .ov-event-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.3rem;
          flex-shrink: 0;
          margin-left: 1rem;
        }

        /* Reusable pill badge */
        .ov-badge {
          font-size: 0.58rem;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 0.2rem 0.5rem;
          border-radius: 20px;
        }

        /* ── RSVP rows ── */
        .ov-rsvp-item {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          padding: 0.75rem 1.25rem;
          border-bottom: 1px solid var(--border);
        }

        .ov-rsvp-item:last-child { border-bottom: none; }

        /* Initial avatar circle */
        .ov-rsvp-avatar {
          width: 32px; height: 32px;
          border-radius: 50%;
          background: var(--gold-dim);
          border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 0.85rem;
          color: var(--gold);
          flex-shrink: 0;
        }

        .ov-rsvp-info { flex: 1; min-width: 0; }

        .ov-rsvp-name {
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text);
          margin-bottom: 0.15rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ov-rsvp-event {
          font-size: 0.7rem;
          color: var(--text-3);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ov-rsvp-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.3rem;
          flex-shrink: 0;
        }

        .ov-rsvp-time { font-size: 0.65rem; color: var(--text-3); }

        /* ── Empty state ── */
        .ov-empty {
          padding: 2.5rem 1.25rem;
          text-align: center;
          font-size: 0.8rem;
          color: var(--text-3);
          line-height: 1.8;
        }

        /* ── Skeleton shimmer ── */
        .ov-skeleton {
          background: var(--bg-3);
          border-radius: 6px;
          animation: shimmer 1.4s ease infinite;
        }

        @keyframes shimmer {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.75; }
        }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .ov-stats { grid-template-columns: repeat(3, 1fr); }
        }

        @media (max-width: 768px) {
          .ov-stats  { grid-template-columns: repeat(2, 1fr); }
          .ov-bottom { grid-template-columns: 1fr; }
        }

        @media (max-width: 400px) {
          .ov-stats      { gap: 0.75rem; }
          .ov-stat-value { font-size: 1.875rem; }
        }
      `}</style>

      <div className="ov-root">

        {/* ── Greeting ── */}
        <div className="ov-greeting">
          <h2 className="ov-greeting-text">
            {greeting}, <em>{firstName}.</em>
          </h2>
          <p className="ov-greeting-sub">
            Here's what's happening across your events.
          </p>
        </div>

        {/* ── Stat Cards ── */}
        <div className="ov-stats">
          {loading
            ? Array.from({ length: 7 }).map((_, i) => (
                // Skeleton placeholders while loading
                <div key={i} className="ov-stat-card">
                  <div className="ov-skeleton" style={{ height: 36, width: 36, borderRadius: 8 }} />
                  <div className="ov-skeleton" style={{ height: 40, width: "55%" }} />
                  <div className="ov-skeleton" style={{ height: 11, width: "40%" }} />
                </div>
              ))
            : stats
              ? getStatCards(stats).map((card) => (
                  <div
                    key={card.label}
                    className="ov-stat-card"
                    // CSS custom property drives the top accent colour
                    style={{ "--card-accent": card.accent } as React.CSSProperties}
                  >
                    <div className="ov-stat-top">
                      <div
                        className="ov-stat-icon"
                        style={{ background: `${card.accent}18`, color: card.accent }}
                      >
                        {card.icon}
                      </div>

                      {/* Alert badge — only shows for gate crashers with value > 0 */}
                      {card.alert && card.value > 0 && (
                        <span className="ov-stat-alert">Alert</span>
                      )}
                    </div>

                    <div className="ov-stat-value">{card.value}</div>
                    <div className="ov-stat-label">{card.label}</div>
                  </div>
                ))
              : null
          }
        </div>

        {/* ── Bottom section ── */}
        <div className="ov-bottom">

          {/* Upcoming Events */}
          <div className="ov-section">
            <div className="ov-section-header">
              <span className="ov-section-title">Upcoming Events</span>
              <Link href="/events" className="ov-section-link">View all →</Link>
            </div>

            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ padding: "0.75rem 1.25rem", display: "flex", gap: "1rem", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div className="ov-skeleton" style={{ height: 13, width: "70%", marginBottom: 6 }} />
                      <div className="ov-skeleton" style={{ height: 11, width: "40%" }} />
                    </div>
                    <div className="ov-skeleton" style={{ height: 20, width: 60, borderRadius: 20 }} />
                  </div>
                ))
              : upcomingEvents.length === 0
                ? (
                  <div className="ov-empty">
                    No upcoming events yet.<br />
                    <Link href="/events" style={{ color: "var(--gold)", fontSize: "0.75rem" }}>
                      Create your first event →
                    </Link>
                  </div>
                )
                : upcomingEvents.map(event => (
                    <Link key={event.id} href={`/events/${event.id}`} className="ov-event-item">
                      <div className="ov-event-info">
                        <div className="ov-event-name">{event.name}</div>
                        <div className="ov-event-meta">{formatDate(event.eventDate)}</div>
                      </div>
                      <div className="ov-event-right">
                        <span
                          className="ov-badge"
                          style={{
                            background: `${EVENT_STATUS_COLORS[event.status] ?? "#6b7280"}18`,
                            color: EVENT_STATUS_COLORS[event.status] ?? "#6b7280",
                            border: `1px solid ${EVENT_STATUS_COLORS[event.status] ?? "#6b7280"}30`,
                          }}
                        >
                          {event.status}
                        </span>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>
                          {event._count.guests} guests
                        </span>
                      </div>
                    </Link>
                  ))
            }
          </div>

          {/* Recent RSVP Activity */}
          <div className="ov-section">
            <div className="ov-section-header">
              <span className="ov-section-title">Recent RSVPs</span>
              <Link href="/guests" className="ov-section-link">View all →</Link>
            </div>

            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ padding: "0.75rem 1.25rem", display: "flex", gap: "0.875rem", alignItems: "center" }}>
                    <div className="ov-skeleton" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="ov-skeleton" style={{ height: 13, width: "60%", marginBottom: 6 }} />
                      <div className="ov-skeleton" style={{ height: 11, width: "45%" }} />
                    </div>
                  </div>
                ))
              : recentRsvps.length === 0
                ? (
                  <div className="ov-empty">
                    No RSVPs yet.<br />
                    <span style={{ fontSize: "0.75rem" }}>
                      Share your event link to get started.
                    </span>
                  </div>
                )
                : recentRsvps.map(rsvp => (
                    <div key={rsvp.id} className="ov-rsvp-item">
                      {/* First letter of first name as avatar */}
                      <div className="ov-rsvp-avatar">
                        {rsvp.firstName[0]?.toUpperCase()}
                      </div>

                      <div className="ov-rsvp-info">
                        <div className="ov-rsvp-name">{rsvp.firstName} {rsvp.lastName}</div>
                        <div className="ov-rsvp-event">{rsvp.event.name}</div>
                      </div>

                      <div className="ov-rsvp-right">
                        <span
                          className="ov-badge"
                          style={{
                            background: `${STATUS_COLORS[rsvp.rsvpStatus] ?? "#6b7280"}18`,
                            color: STATUS_COLORS[rsvp.rsvpStatus] ?? "#6b7280",
                            border: `1px solid ${STATUS_COLORS[rsvp.rsvpStatus] ?? "#6b7280"}30`,
                          }}
                        >
                          {rsvp.rsvpStatus}
                        </span>
                        <span className="ov-rsvp-time">
                          {rsvp.rsvpAt ? timeAgo(rsvp.rsvpAt) : "—"}
                        </span>
                      </div>
                    </div>
                  ))
            }
          </div>

        </div>
      </div>
    </>
  )
}
