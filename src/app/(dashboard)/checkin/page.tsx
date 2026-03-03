"use client"

// src/app/(dashboard)/checkin/page.tsx
// Planner view — usher links, QR codes, active/inactive toggle per usher

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"

interface Usher {
  id:          string
  name:        string
  role:        "MAIN" | "FLOOR"
  isActive:    boolean
  accessToken: string
  phone:       string | null
}

interface EventWithUshers {
  id:        string
  name:      string
  eventDate: string
  status:    string
  ushers:    Usher[]
}

const APP_URL = typeof window !== "undefined" ? window.location.origin : ""

const getAuthHeaders = (): Record<string, string> => {
  const token = typeof window !== "undefined" ? localStorage.getItem("ef-session") ?? "" : ""
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function CheckinPage() {
  const [events,      setEvents]      = useState<EventWithUshers[]>([])
  const [loading,     setLoading]     = useState(true)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [qrOpen,      setQrOpen]      = useState<string | null>(null)   // accessToken
  const [toggling,    setToggling]    = useState<string | null>(null)    // usherId

  const fetchEvents = useCallback(async () => {
    try {
      const res  = await fetch("/api/events?withUshers=true", { headers: getAuthHeaders() })
      const data = await res.json()
      setEvents(data.events ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${APP_URL}/checkin/${token}`)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const toggleActive = async (eventId: string, usherId: string, current: boolean) => {
    setToggling(usherId)
    try {
      await fetch(`/api/events/${eventId}/ushers/${usherId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify({ isActive: !current }),
      })
      setEvents(prev => prev.map(ev =>
        ev.id !== eventId ? ev : {
          ...ev,
          ushers: ev.ushers.map(u => u.id === usherId ? { ...u, isActive: !current } : u),
        }
      ))
    } catch { /* silent */ }
    finally { setToggling(null) }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        .ci { max-width: 860px; margin: 0 auto; padding: 2rem 1.5rem 4rem; animation: ciIn 0.3s ease; }
        @keyframes ciIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }

        /* ── Header ── */
        .ci-hdr { margin-bottom: 2rem; }
        .ci-eyebrow { font-size: 0.6rem; font-weight: 500; letter-spacing: 0.22em; text-transform: uppercase; color: var(--gold); margin-bottom: 0.5rem; }
        .ci-title { font-family: 'Cormorant Garamond', serif; font-size: clamp(1.75rem, 4vw, 2.5rem); font-weight: 300; color: var(--text); line-height: 1.1; margin-bottom: 0.5rem; }
        .ci-sub { font-size: 0.8rem; color: var(--text-3); line-height: 1.6; font-weight: 300; }

        /* ── Empty ── */
        .ci-empty { padding: 3rem; text-align: center; border: 1px solid var(--border); background: var(--bg-2); }
        .ci-empty-icon { font-size: 2rem; margin-bottom: 0.75rem; opacity: 0.4; }
        .ci-empty-text { font-size: 0.8rem; color: var(--text-3); margin-bottom: 1rem; }

        /* ── Event block ── */
        .ci-event { margin-bottom: 2rem; }
        .ci-event-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem; }
        .ci-event-name { font-family: 'Cormorant Garamond', serif; font-size: 1.125rem; font-weight: 400; color: var(--text); }
        .ci-event-meta { display: flex; align-items: center; gap: 0.5rem; }
        .ci-event-date { font-size: 0.7rem; color: var(--text-3); }
        .ci-status { font-size: 0.58rem; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.18rem 0.55rem; border-radius: 99px; border: 1px solid; }

        /* ── No ushers ── */
        .ci-no-ushers { padding: 1rem 1.25rem; background: var(--bg-2); border: 1px solid var(--border); font-size: 0.78rem; color: var(--text-3); display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
        .ci-add-link { font-size: 0.72rem; color: var(--gold); text-decoration: none; }
        .ci-add-link:hover { text-decoration: underline; }

        /* ── Usher card ── */
        .ci-usher { background: var(--bg-2); border: 1px solid var(--border); padding: 1rem 1.25rem; margin-bottom: 0.5rem; transition: border-color 0.2s; }
        .ci-usher.inactive { opacity: 0.5; }
        .ci-usher-top { display: flex; align-items: center; gap: 0.875rem; margin-bottom: 0.875rem; }
        .ci-usher-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--gold-dim); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-family: 'Bebas Neue', sans-serif; font-size: 0.9rem; color: var(--gold); flex-shrink: 0; letter-spacing: 0.05em; }
        .ci-usher-info { flex: 1; min-width: 0; }
        .ci-usher-name { font-size: 0.875rem; font-weight: 500; color: var(--text); margin-bottom: 0.2rem; }
        .ci-usher-role-row { display: flex; align-items: center; gap: 0.5rem; }
        .ci-role-chip { font-size: 0.58rem; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.15rem 0.5rem; border-radius: 99px; border: 1px solid; }
        .ci-role-main { color: #f59e0b; border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.08); }
        .ci-role-floor { color: #6b7280; border-color: rgba(107,114,128,0.3); background: rgba(107,114,128,0.08); }
        .ci-usher-phone { font-size: 0.7rem; color: var(--text-3); }

        /* ── Toggle ── */
        .ci-toggle-wrap { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
        .ci-toggle-label { font-size: 0.68rem; color: var(--text-3); }
        .ci-toggle { position: relative; width: 36px; height: 20px; cursor: pointer; }
        .ci-toggle input { opacity: 0; width: 0; height: 0; }
        .ci-toggle-track { position: absolute; inset: 0; border-radius: 99px; background: var(--bg-3); border: 1px solid var(--border); transition: all 0.2s; }
        .ci-toggle input:checked + .ci-toggle-track { background: var(--gold); border-color: var(--gold); }
        .ci-toggle-thumb { position: absolute; top: 3px; left: 3px; width: 12px; height: 12px; border-radius: 50%; background: var(--text-3); transition: all 0.2s; }
        .ci-toggle input:checked ~ .ci-toggle-thumb { left: 19px; background: #0a0a0a; }

        /* ── Link row ── */
        .ci-link-row { display: flex; gap: 0.5rem; align-items: stretch; }
        .ci-link-val { flex: 1; min-width: 0; padding: 0.5rem 0.75rem; background: var(--bg); border: 1px solid var(--border); font-size: 0.7rem; color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; }
        .ci-btn { padding: 0.5rem 0.875rem; background: transparent; border: 1px solid var(--border); color: var(--text-3); font-family: 'DM Sans', sans-serif; font-size: 0.7rem; cursor: pointer; transition: all 0.2s; white-space: nowrap; flex-shrink: 0; }
        .ci-btn:hover { border-color: var(--gold); color: var(--gold); }
        .ci-btn.ok { border-color: #22c55e; color: #22c55e; }
        .ci-btn-qr { display: flex; align-items: center; gap: 0.35rem; }

        /* ── QR Modal ── */
        .ci-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 200; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); animation: fadeIn 0.15s ease; }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        .ci-modal { background: var(--bg-2); border: 1px solid var(--border); padding: 2rem; width: 320px; max-width: 90vw; text-align: center; position: relative; }
        .ci-modal-title { font-family: 'Cormorant Garamond', serif; font-size: 1.125rem; font-weight: 300; color: var(--text); margin-bottom: 0.375rem; }
        .ci-modal-sub { font-size: 0.72rem; color: var(--text-3); margin-bottom: 1.5rem; }
        .ci-qr-frame { width: 200px; height: 200px; margin: 0 auto 1.25rem; background: white; display: flex; align-items: center; justify-content: center; padding: 12px; }
        .ci-qr-frame img { width: 100%; height: 100%; }
        .ci-modal-close { position: absolute; top: 0.75rem; right: 0.875rem; background: transparent; border: none; color: var(--text-3); font-size: 1rem; cursor: pointer; line-height: 1; }
        .ci-modal-close:hover { color: var(--text); }
        .ci-modal-url { font-size: 0.65rem; color: var(--text-3); word-break: break-all; margin-bottom: 1rem; font-family: monospace; }
        .ci-modal-copy { width: 100%; padding: 0.625rem; background: var(--gold); color: #0a0a0a; border: none; font-family: 'DM Sans', sans-serif; font-size: 0.78rem; font-weight: 500; cursor: pointer; transition: background 0.2s; }
        .ci-modal-copy:hover { background: #c9a050; }

        @media (max-width: 600px) {
          .ci-link-row { flex-wrap: wrap; }
          .ci-link-val { min-width: 100%; }
        }
      `}</style>

      <div className="ci">
        {/* Header */}
        <div className="ci-hdr">
          <div className="ci-eyebrow">Gate Management</div>
          <h1 className="ci-title">Check-in</h1>
          <p className="ci-sub">
            Share usher links or QR codes with your crew on event day.
            MAIN ushers scan at the gate — FLOOR ushers seat guests.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "2rem 0", color: "var(--text-3)", fontSize: "0.8rem" }}>
            <div style={{ width: 18, height: 18, border: "1.5px solid rgba(180,140,60,0.2)", borderTopColor: "#b48c3c", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            Loading events…
          </div>
        )}

        {/* Empty state */}
        {!loading && events.length === 0 && (
          <div className="ci-empty">
            <div className="ci-empty-icon">🎯</div>
            <p className="ci-empty-text">No events found. Create an event and add ushers to get started.</p>
            <Link href="/events" style={{ fontSize: "0.78rem", color: "var(--gold)", textDecoration: "none" }}>
              Go to Events →
            </Link>
          </div>
        )}

        {/* Event list */}
        {!loading && events.map(event => {
          const statusColors: Record<string, string> = {
            DRAFT:     "#6b7280",
            PUBLISHED: "#22c55e",
            ONGOING:   "#f59e0b",
            COMPLETED: "#3b82f6",
            CANCELLED: "#ef4444",
          }
          const sc = statusColors[event.status] ?? "#6b7280"
          const dateStr = new Date(event.eventDate).toLocaleDateString("en-NG", {
            day: "numeric", month: "short", year: "numeric",
          })

          return (
            <div className="ci-event" key={event.id}>
              {/* Event header */}
              <div className="ci-event-hdr">
                <div>
                  <div className="ci-event-name">{event.name}</div>
                  <div className="ci-event-date">{dateStr}</div>
                </div>
                <div className="ci-event-meta">
                  <span className="ci-status" style={{ color: sc, borderColor: `${sc}40`, background: `${sc}12` }}>
                    {event.status.charAt(0) + event.status.slice(1).toLowerCase()}
                  </span>
                  <Link href={`/events/${event.id}/ushers`} className="ci-add-link">
                    + Add usher
                  </Link>
                </div>
              </div>

              {/* No ushers */}
              {event.ushers.length === 0 && (
                <div className="ci-no-ushers">
                  <span>No ushers assigned to this event yet.</span>
                  <Link href={`/events/${event.id}/ushers`} className="ci-add-link">Add ushers →</Link>
                </div>
              )}

              {/* Usher cards */}
              {event.ushers.map(usher => {
                const usherLink = `${APP_URL}/checkin/${usher.accessToken}`
                const isCopied  = copiedToken === usher.accessToken
                const isQrOpen  = qrOpen === usher.accessToken
                const qrSrc     = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(usherLink)}`

                return (
                  <div className={`ci-usher${usher.isActive ? "" : " inactive"}`} key={usher.id}>
                    {/* Top row */}
                    <div className="ci-usher-top">
                      <div className="ci-usher-avatar">
                        {usher.name[0]?.toUpperCase() ?? "U"}
                      </div>
                      <div className="ci-usher-info">
                        <div className="ci-usher-name">{usher.name}</div>
                        <div className="ci-usher-role-row">
                          <span className={`ci-role-chip ${usher.role === "MAIN" ? "ci-role-main" : "ci-role-floor"}`}>
                            {usher.role === "MAIN" ? "⬡ Gate" : "↗ Floor"}
                          </span>
                          {usher.phone && <span className="ci-usher-phone">{usher.phone}</span>}
                        </div>
                      </div>

                      {/* Active toggle */}
                      <div className="ci-toggle-wrap">
                        <span className="ci-toggle-label">
                          {usher.isActive ? "Active" : "Off"}
                        </span>
                        <label className="ci-toggle">
                          <input
                            type="checkbox"
                            checked={usher.isActive}
                            disabled={toggling === usher.id}
                            onChange={() => toggleActive(event.id, usher.id, usher.isActive)}
                          />
                          <div className="ci-toggle-track" />
                          <div className="ci-toggle-thumb" />
                        </label>
                      </div>
                    </div>

                    {/* Link + buttons */}
                    <div className="ci-link-row">
                      <div className="ci-link-val" title={usherLink}>{usherLink}</div>
                      <button
                        className={`ci-btn${isCopied ? " ok" : ""}`}
                        onClick={() => copyLink(usher.accessToken)}
                      >
                        {isCopied ? "✓ Copied" : "Copy"}
                      </button>
                      <button
                        className="ci-btn ci-btn-qr"
                        onClick={() => setQrOpen(usher.accessToken)}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                          <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
                        </svg>
                        QR
                      </button>
                    </div>

                    {/* QR Modal */}
                    {isQrOpen && (
                      <div className="ci-modal-bg" onClick={() => setQrOpen(null)}>
                        <div className="ci-modal" onClick={e => e.stopPropagation()}>
                          <button className="ci-modal-close" onClick={() => setQrOpen(null)}>✕</button>
                          <div className="ci-modal-title">{usher.name}</div>
                          <div className="ci-modal-sub">
                            {usher.role === "MAIN" ? "Gate Scanner" : "Floor Usher"} · scan to open link
                          </div>
                          <div className="ci-qr-frame">
                            <img src={qrSrc} alt="Usher QR code" />
                          </div>
                          <div className="ci-modal-url">{usherLink}</div>
                          <button
                            className="ci-modal-copy"
                            onClick={() => copyLink(usher.accessToken)}
                          >
                            {isCopied ? "✓ Copied" : "Copy Link"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </>
  )
}
