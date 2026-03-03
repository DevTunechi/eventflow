"use client"

// src/app/(dashboard)/events/[id]/guests/page.tsx
// Capacity warnings: venue, tables, per-tier
// Added: email field, email invite option, per-guest Send Link for CLOSED events

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

interface GuestTier {
  id:        string
  name:      string
  color:     string | null
  maxGuests: number | null
  _count?:   { guests: number }
}

interface Guest {
  id: string; firstName: string; lastName: string
  phone: string | null; email: string | null
  rsvpStatus: RSVPStatus; rsvpAt: string | null
  checkedIn: boolean; checkedInAt: string | null
  inviteSentAt: string | null; inviteToken: string | null
  isFlagged: boolean
  tier: { id: string; name: string; color: string | null } | null
  tableNumber: string | null; createdAt: string
}

interface EventSummary {
  id: string; name: string; inviteModel: "OPEN" | "CLOSED"
  status: string; guestTiers: GuestTier[]; slug: string
  venueCapacity: number | null; totalTables: number | null; seatsPerTable: number | null
  _count: { guests: number }
}

type RSVPStatus  = "PENDING" | "CONFIRMED" | "DECLINED" | "WAITLISTED" | "NO_SHOW"
type ActiveTab   = "list" | "add" | "import"
type ImportType  = "csv" | "sheets"
type InviteChannel = "whatsapp" | "email"

const APP_URL = typeof window !== "undefined" ? window.location.origin : ""

const RSVP_CONFIG: Record<RSVPStatus, { label: string; color: string; bg: string }> = {
  PENDING:    { label: "Pending",    color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  CONFIRMED:  { label: "Confirmed",  color: "#22c55e", bg: "rgba(34,197,94,0.12)"   },
  DECLINED:   { label: "Declined",   color: "#ef4444", bg: "rgba(239,68,68,0.12)"   },
  WAITLISTED: { label: "Waitlisted", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  NO_SHOW:    { label: "No Show",    color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
}

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {}
  const token = localStorage.getItem("ef-session") ?? ""
  return token ? { Authorization: `Bearer ${token}` } : {}
}
const initials = (f: string, l: string) => `${f[0]??""}${l[0]??""}`.toUpperCase()
const fmtDate  = (d: string | null) => d ? new Date(d).toLocaleDateString("en-NG", { day:"numeric", month:"short", year:"numeric" }) : "—"
const fmtTime  = (d: string | null) => d ? new Date(d).toLocaleTimeString("en-NG", { hour:"2-digit", minute:"2-digit" }) : ""

// ── Capacity bar ──────────────────────────────
function CapacityBar({ label, current, limit, color = "#b48c3c" }: { label: string; current: number; limit: number; color?: string }) {
  const pct    = Math.min(current / limit, 1)
  const isFull = current >= limit
  const isWarn = pct >= 0.8 && !isFull
  const bar    = isFull ? "#ef4444" : isWarn ? "#f59e0b" : color
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"0.3rem" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
        <span style={{ fontSize:"0.68rem", fontWeight:500, letterSpacing:"0.04em", color:"var(--text-2)" }}>{label}</span>
        <span style={{ fontSize:"0.68rem", color: isFull ? "#ef4444" : isWarn ? "#f59e0b" : "var(--text-3)" }}>
          {current} / {limit}{isFull ? " · Full" : isWarn ? ` · ${limit - current} left` : ""}
        </span>
      </div>
      <div style={{ height:4, background:"var(--bg-3)", borderRadius:2, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct*100}%`, background:bar, borderRadius:2, transition:"width 0.3s" }} />
      </div>
    </div>
  )
}

// ── Tier group ────────────────────────────────
function TierGroup({ label, color, guests, isCollapsed, onToggle, deletingId, handleDelete, inviteModel, sendingGuestId, handleSendGuestLink }: {
  label: string; color: string; guests: Guest[]; isCollapsed: boolean
  onToggle: () => void; deletingId: string | null; handleDelete: (id: string, name: string) => void
  inviteModel: "OPEN" | "CLOSED"; sendingGuestId: string | null
  handleSendGuestLink: (guest: Guest) => void
}) {
  const confirmed = guests.filter(g => g.rsvpStatus === "CONFIRMED").length
  return (
    <div className="gp-tier-group">
      <button className="gp-tier-header" onClick={onToggle}>
        <div style={{ display:"flex", alignItems:"center", gap:"0.625rem" }}>
          <div style={{ width:9, height:9, borderRadius:"50%", background:color, flexShrink:0 }} />
          <span style={{ fontSize:"0.8rem", fontWeight:500, color:"var(--text)" }}>{label}</span>
          <span className="gp-tier-pill">{guests.length}</span>
          {confirmed > 0 && <span className="gp-tier-pill" style={{ color:"#22c55e", borderColor:"rgba(34,197,94,0.3)", background:"rgba(34,197,94,0.08)" }}>{confirmed} confirmed</span>}
        </div>
        <span style={{ fontSize:"0.7rem", color:"var(--text-3)", transition:"transform 0.2s", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▾</span>
      </button>
      {!isCollapsed && guests.map(g => {
        const rsvp = RSVP_CONFIG[g.rsvpStatus]
        const name = `${g.firstName} ${g.lastName}`
        const canSendLink = inviteModel === "CLOSED" && !g.inviteSentAt && g.inviteToken && (g.email || g.phone)
        return (
          <div className="gp-row" key={g.id}>
            <div className="gp-row-guest">
              <div className="gp-avatar" style={{ background:color+"33", border:`1.5px solid ${color}55`, color }}>{initials(g.firstName,g.lastName)}</div>
              <div>
                <div style={{ fontSize:"0.78rem", fontWeight:500, color:"var(--text)", display:"flex", alignItems:"center", gap:"0.3rem" }}>
                  {name}{g.isFlagged && <span className="gp-flag">⚠</span>}
                </div>
                <div style={{ fontSize:"0.63rem", color:"var(--text-3)" }}>{g.phone ?? g.email ?? "—"}</div>
              </div>
            </div>
            <div className="gp-row-cell gp-hide-sm">
              <span className="gp-status" style={{ color:rsvp.color, background:rsvp.bg, borderColor:rsvp.color+"44" }}>{rsvp.label}</span>
              {g.rsvpAt && <div style={{ fontSize:"0.6rem", color:"var(--text-3)", marginTop:"0.1rem" }}>{fmtDate(g.rsvpAt)}</div>}
            </div>
            <div className="gp-row-cell gp-hide-md">
              <div style={{ display:"flex", alignItems:"center", gap:"0.35rem", fontSize:"0.7rem" }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background: g.checkedIn ? "#22c55e" : "var(--border)", flexShrink:0 }} />
                <span style={{ color: g.checkedIn ? "#22c55e" : "var(--text-3)" }}>{g.checkedIn ? `In · ${fmtTime(g.checkedInAt)}` : "Not yet"}</span>
              </div>
            </div>
            <div className="gp-row-cell gp-hide-md">
              {g.inviteSentAt
                ? <span style={{ fontSize:"0.7rem", color:"#22c55e" }}>✓ {fmtDate(g.inviteSentAt)}</span>
                : canSendLink
                  ? <button className="gp-btn-send-link" onClick={() => handleSendGuestLink(g)} disabled={sendingGuestId === g.id}>
                      {sendingGuestId === g.id ? "…" : g.email ? "✉ Send" : "📲 Send"}
                    </button>
                  : <span style={{ fontSize:"0.7rem", color:"var(--text-3)" }}>Not sent</span>
              }
            </div>
            <div className="gp-row-cell gp-hide-lg"><span style={{ fontSize:"0.72rem", color:"var(--text-3)" }}>{g.tableNumber ?? "—"}</span></div>
            <div style={{ textAlign:"right" }}>
              <button className="gp-btn-danger" onClick={() => handleDelete(g.id, name)} disabled={deletingId === g.id}>{deletingId === g.id ? "…" : "Remove"}</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function GuestsPage() {
  const { id } = useParams<{ id: string }>()
  const [event, setEvent]               = useState<EventSummary | null>(null)
  const [guests, setGuests]             = useState<Guest[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [activeTab, setActiveTab]       = useState<ActiveTab>("list")
  const [search, setSearch]             = useState("")
  const [filterStatus, setFilterStatus] = useState<RSVPStatus | "ALL">("ALL")
  const [filterTier, setFilterTier]     = useState<string>("ALL")
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const toggleGroup = (label: string) => setCollapsedGroups(prev => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n })

  // Add form — now includes email
  const [addForm, setAddForm]       = useState({ firstName:"", lastName:"", phone:"", email:"", tierId:"" })
  const [adding, setAdding]         = useState(false)
  const [addError, setAddError]     = useState("")
  const [addSuccess, setAddSuccess] = useState(false)

  const [importType, setImportType]       = useState<ImportType>("csv")
  const [csvFile, setCsvFile]             = useState<File | null>(null)
  const [csvPreview, setCsvPreview]       = useState<{ firstName: string; lastName: string; phone: string }[]>([])
  const [csvError, setCsvError]           = useState("")
  const [sheetsUrl, setSheetsUrl]         = useState("")
  const [sheetsError, setSheetsError]     = useState("")
  const [importing, setImporting]         = useState(false)
  const [importSuccess, setImportSuccess] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Bulk invite channel toggle
  const [inviteChannel, setInviteChannel] = useState<InviteChannel>("whatsapp")
  const [sending, setSending]             = useState(false)
  const [sendResult, setSendResult]       = useState<{ sent: number; failed: number; errors?: string[] } | null>(null)

  // Per-guest send link
  const [sendingGuestId, setSendingGuestId] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const hdrs = getAuthHeaders()
      const [evRes, gRes] = await Promise.all([
        fetch(`/api/events/${id}`, { headers: hdrs }),
        fetch(`/api/events/${id}/guests`, { headers: hdrs }),
      ])
      if (!evRes.ok) throw new Error("Failed to load event")
      const { event: ev } = await evRes.json()
      setEvent({
        id: ev.id, name: ev.name, inviteModel: ev.inviteModel, status: ev.status, slug: ev.slug,
        venueCapacity: ev.venueCapacity ?? null,
        totalTables:   ev.totalTables   ?? null,
        seatsPerTable: ev.seatsPerTable ?? null,
        _count: ev._count ?? { guests: 0 },
        guestTiers: (ev.guestTiers ?? []).map((t: GuestTier) => ({
          id: t.id, name: t.name, color: t.color,
          maxGuests: t.maxGuests ?? null, _count: t._count,
        })),
      })
      if (gRes.ok) { const d = await gRes.json(); setGuests(Array.isArray(d) ? d : []) }
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to load") }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  // ── Capacity ──────────────────────────────────
  const totalGuests   = guests.length
  const venueCapacity = event?.venueCapacity ?? null
  const tableSeats    = (event?.totalTables && event?.seatsPerTable) ? event.totalTables * event.seatsPerTable : null
  const caps          = [venueCapacity, tableSeats].filter(Boolean) as number[]
  const hardCap       = caps.length ? Math.min(...caps) : null
  const isVenueFull   = venueCapacity !== null && totalGuests >= venueCapacity
  const isTableFull   = tableSeats   !== null && totalGuests >= tableSeats
  const isAtCapacity  = isVenueFull || isTableFull

  const getTierInfo = (tierId: string) => {
    if (!tierId) return null
    const tier = event?.guestTiers.find(t => t.id === tierId)
    if (!tier?.maxGuests) return null
    const cnt = guests.filter(g => g.tier?.id === tierId).length
    return { name: tier.name, current: cnt, limit: tier.maxGuests, isFull: cnt >= tier.maxGuests }
  }
  const selTier     = getTierInfo(addForm.tierId)
  const canAddGuest = !isAtCapacity && !selTier?.isFull

  // ── Filter + group ────────────────────────────
  const filtered = guests.filter(g => {
    const n = `${g.firstName} ${g.lastName}`.toLowerCase()
    return (!search || n.includes(search.toLowerCase()) || (g.phone??"").includes(search) || (g.email??"").includes(search))
      && (filterStatus === "ALL" || g.rsvpStatus === filterStatus)
      && (filterTier   === "ALL" || g.tier?.id === filterTier)
  })
  const groupedGuests = (() => {
    const map = new Map<string, { label: string; color: string; guests: Guest[] }>()
    filtered.forEach(g => {
      const k = g.tier?.id ?? "__none__"
      if (!map.has(k)) map.set(k, { label: g.tier?.name ?? "No Tier", color: g.tier?.color ?? "#6b7280", guests: [] })
      map.get(k)!.guests.push(g)
    })
    const out: { label: string; color: string; guests: Guest[] }[] = []
    event?.guestTiers.forEach(t => { if (map.has(t.id)) out.push(map.get(t.id)!) })
    if (map.has("__none__")) out.push(map.get("__none__")!)
    return out
  })()

  const stats = {
    total:     guests.length,
    confirmed: guests.filter(g => g.rsvpStatus === "CONFIRMED").length,
    pending:   guests.filter(g => g.rsvpStatus === "PENDING").length,
    checkedIn: guests.filter(g => g.checkedIn).length,
    notSent:   guests.filter(g => !g.inviteSentAt).length,
  }

  const handleAdd = async () => {
    if (!addForm.firstName.trim() || !addForm.lastName.trim()) { setAddError("First name and last name are required."); return }
    if (isAtCapacity) { setAddError(isVenueFull ? `Venue capacity (${venueCapacity}) reached.` : `All ${tableSeats} table seats are filled.`); return }
    if (selTier?.isFull) { setAddError(`The ${selTier.name} tier is full (${selTier.limit} max).`); return }
    setAdding(true); setAddError("")
    try {
      const res = await fetch(`/api/events/${id}/guests`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          firstName: addForm.firstName.trim(),
          lastName:  addForm.lastName.trim(),
          phone:     addForm.phone.trim()  || null,
          email:     addForm.email.trim()  || null,
          tierId:    addForm.tierId        || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail ?? d.error ?? "Failed") }
      const { guest: g } = await res.json()
      setGuests(prev => [g, ...prev])
      setEvent(prev => prev ? { ...prev, _count: { guests: prev._count.guests + 1 } } : prev)
      setAddForm({ firstName:"", lastName:"", phone:"", email:"", tierId:"" })
      setAddSuccess(true); setTimeout(() => setAddSuccess(false), 3000)
    } catch (e: unknown) { setAddError(e instanceof Error ? e.message : "Failed to add guest") }
    finally { setAdding(false) }
  }

  // ── Bulk send invites ─────────────────────────
  const handleSendInvites = async () => {
    const unsent = guests.filter(g => !g.inviteSentAt)
    if (!unsent.length) return
    const channelLabel = inviteChannel === "email" ? "email" : "WhatsApp"
    if (!confirm(`Send ${channelLabel} invites to ${unsent.length} guest${unsent.length > 1 ? "s" : ""}?`)) return
    setSending(true); setSendResult(null)
    try {
      const res = await fetch(`/api/events/${id}/guests/send-invites`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ guestIds: unsent.map(g => g.id), channel: inviteChannel }),
      })
      const d = await res.json()
      setSendResult({ sent: d.sent ?? 0, failed: d.failed ?? 0, errors: d.errors })
      await load()
    } catch { setSendResult({ sent: 0, failed: unsent.length }) }
    finally { setSending(false) }
  }

  // ── Per-guest send link ───────────────────────
  const handleSendGuestLink = async (guest: Guest) => {
    if (!guest.inviteToken) return
    setSendingGuestId(guest.id)
    try {
      const channel: InviteChannel = guest.email ? "email" : "whatsapp"
      const res = await fetch(`/api/events/${id}/guests/send-invites`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ guestIds: [guest.id], channel }),
      })
      if (res.ok) {
        setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, inviteSentAt: new Date().toISOString() } : g))
      }
    } catch { /* silent */ }
    finally { setSendingGuestId(null) }
  }

  const handleCsvFile = (file: File) => {
    setCsvError(""); setCsvPreview([])
    if (!file.name.endsWith(".csv")) { setCsvError("Please upload a .csv file."); return }
    const r = new FileReader()
    r.onload = e => {
      const lines  = (e.target?.result as string).trim().split(/\r?\n/)
      if (lines.length < 2) { setCsvError("CSV appears to be empty."); return }
      const header = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z]/g,""))
      const fi = header.findIndex(h => h.includes("first") || h === "firstname")
      const li = header.findIndex(h => h.includes("last")  || h === "lastname")
      const pi = header.findIndex(h => h.includes("phone") || h === "mobile")
      if (fi === -1 || li === -1) { setCsvError("CSV must have First Name and Last Name columns."); return }
      const rows = lines.slice(1).map(line => {
        const c = line.split(",")
        return { firstName:(c[fi]??"").trim(), lastName:(c[li]??"").trim(), phone: pi !== -1 ? (c[pi]??"").trim() : "" }
      }).filter(r => r.firstName || r.lastName)
      if (!rows.length) { setCsvError("No valid rows found."); return }
      if (hardCap !== null && totalGuests + rows.length > hardCap) {
        const rem = hardCap - totalGuests
        if (rem <= 0) { setCsvError(`Event is at capacity (${hardCap}). Cannot import.`); return }
        setCsvError(`Only ${rem} seat${rem > 1 ? "s" : ""} remaining — import capped at ${rem}.`)
        setCsvPreview(rows.slice(0, rem))
      } else {
        setCsvPreview(rows.slice(0, 200))
      }
      setCsvFile(file)
    }
    r.readAsText(file)
  }

  const handleCsvImport = async () => {
    if (!csvPreview.length) return
    setImporting(true)
    try {
      const res = await fetch(`/api/events/${id}/guests/import`, {
        method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ guests: csvPreview, source: "csv" }),
      })
      if (!res.ok) throw new Error("Import failed")
      const d = await res.json()
      setImportSuccess(d.imported ?? csvPreview.length)
      setCsvPreview([]); setCsvFile(null); await load()
    } catch (e: unknown) { setCsvError(e instanceof Error ? e.message : "Import failed") }
    finally { setImporting(false) }
  }

  const handleSheetsSync = async () => {
    if (!sheetsUrl.trim()) { setSheetsError("Paste your Google Sheets link."); return }
    if (!sheetsUrl.includes("docs.google.com/spreadsheets")) { setSheetsError("Doesn't look like a Google Sheets link."); return }
    setImporting(true); setSheetsError("")
    try {
      const res = await fetch(`/api/events/${id}/guests/sync-sheets`, {
        method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ sheetsUrl }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Sync failed") }
      const d = await res.json(); setImportSuccess(d.imported ?? 0); await load()
    } catch (e: unknown) { setSheetsError(e instanceof Error ? e.message : "Sync failed") }
    finally { setImporting(false) }
  }

  const handleDelete = async (guestId: string, name: string) => {
    if (!confirm(`Remove ${name}?`)) return
    setDeletingId(guestId)
    try {
      await fetch(`/api/events/${id}/guests/${guestId}`, { method:"DELETE", headers:getAuthHeaders() })
      setGuests(prev => prev.filter(g => g.id !== guestId))
      setEvent(prev => prev ? { ...prev, _count: { guests: Math.max(0, prev._count.guests - 1) } } : prev)
    } finally { setDeletingId(null) }
  }

  const handleExport = () => {
    const rows = [
      ["First Name","Last Name","Phone","Email","Tier","RSVP","Checked In","Table","Invite Sent"],
      ...guests.map(g => [g.firstName,g.lastName,g.phone??"",g.email??"",g.tier?.name??"",g.rsvpStatus,g.checkedIn?"Yes":"No",g.tableNumber??"",g.inviteSentAt?fmtDate(g.inviteSentAt):"No"])
    ]
    const blob = new Blob([rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n")], { type:"text/csv" })
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${event?.name??"guests"}-guests.csv` })
    a.click(); URL.revokeObjectURL(a.href)
  }

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh", gap:"0.75rem" }}>
      <div style={{ width:22, height:22, border:"1.5px solid rgba(180,140,60,0.2)", borderTopColor:"#b48c3c", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if (error || !event) return (
    <div style={{ padding:"3rem", textAlign:"center" }}>
      <p style={{ color:"var(--text-2)", marginBottom:"1rem" }}>{error ?? "Event not found"}</p>
      <Link href="/events" style={{ color:"var(--gold)", textDecoration:"none" }}>← Back</Link>
    </div>
  )

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box}
        .gp{max-width:1000px;margin:0 auto;padding:0 0 5rem;animation:gpIn 0.3s ease}
        @keyframes gpIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
        .gp-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;gap:.75rem;flex-wrap:wrap}
        .gp-back{font-size:.78rem;color:var(--text-3);text-decoration:none;display:flex;align-items:center;gap:.35rem;transition:color .2s;flex-shrink:0}
        .gp-back:hover{color:var(--gold)}
        .gp-top-right{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;justify-content:flex-end}
        .gp-btn{padding:.45rem .875rem;font-family:'DM Sans',sans-serif;font-size:.75rem;cursor:pointer;border:none;transition:all .2s;display:inline-flex;align-items:center;gap:.35rem;letter-spacing:.02em;text-decoration:none;border-radius:5px;white-space:nowrap}
        .gp-btn-gold{background:var(--gold);color:#0a0a0a;font-weight:500}
        .gp-btn-gold:hover:not(:disabled){background:#c9a050}
        .gp-btn-gold:disabled{opacity:.45;cursor:not-allowed}
        .gp-btn-ghost{background:transparent;border:1px solid var(--border);color:var(--text-2)}
        .gp-btn-ghost:hover{border-color:var(--border-hover);color:var(--text)}
        .gp-btn-send{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);color:#22c55e}
        .gp-btn-send:hover:not(:disabled){background:rgba(34,197,94,.18)}
        .gp-btn-send:disabled{opacity:.4;cursor:not-allowed}
        .gp-btn-danger{background:transparent;border:1px solid rgba(239,68,68,.2);color:rgba(239,68,68,.6);padding:.28rem .55rem;font-size:.68rem;font-family:'DM Sans',sans-serif;cursor:pointer;border-radius:4px;transition:all .2s}
        .gp-btn-danger:hover:not(:disabled){border-color:#ef4444;color:#ef4444}
        .gp-btn-danger:disabled{opacity:.3;cursor:not-allowed}
        .gp-btn-send-link{background:transparent;border:1px solid rgba(180,140,60,.3);color:var(--gold);padding:.2rem .5rem;font-size:.65rem;font-family:'DM Sans',sans-serif;cursor:pointer;border-radius:4px;transition:all .2s;white-space:nowrap}
        .gp-btn-send-link:hover:not(:disabled){background:rgba(180,140,60,.1)}
        .gp-btn-send-link:disabled{opacity:.3;cursor:not-allowed}
        .gp-title{font-family:'Cormorant Garamond',serif;font-size:clamp(1.5rem,5vw,2.25rem);font-weight:300;color:var(--text);letter-spacing:-.01em;margin-bottom:.25rem}
        .gp-sub{font-size:.78rem;color:var(--text-3);display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:1.5rem}
        .gp-model-badge{font-size:.6rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;padding:.2rem .6rem;border-radius:99px;border:1px solid}
        .gp-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:.5rem;margin-bottom:1.25rem}
        @media(min-width:480px){.gp-stats{grid-template-columns:repeat(3,1fr)}}
        @media(min-width:700px){.gp-stats{grid-template-columns:repeat(5,1fr)}}
        .gp-stat{background:var(--bg-2);border:1px solid var(--border);padding:.75rem;text-align:center;border-radius:5px}
        .gp-stat-num{font-family:'Cormorant Garamond',serif;font-size:1.625rem;font-weight:300;color:var(--gold);line-height:1;margin-bottom:.2rem}
        .gp-stat-label{font-size:.55rem;color:var(--text-3);letter-spacing:.1em;text-transform:uppercase}
        .gp-capacity{background:var(--bg-2);border:1px solid var(--border);padding:.875rem 1rem;margin-bottom:1.25rem;border-radius:5px;display:flex;flex-direction:column;gap:.75rem}
        .gp-cap-banner{padding:.875rem 1rem;margin-bottom:1.25rem;border-radius:5px;font-size:.8rem;line-height:1.55}
        .gp-cap-full{background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.25);color:#ef4444}
        .gp-cap-warn{background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.2);color:#f59e0b}
        .gp-tabs{display:flex;border-bottom:1px solid var(--border);margin-bottom:1.5rem;overflow-x:auto;-webkit-overflow-scrolling:touch}
        .gp-tabs::-webkit-scrollbar{display:none}
        .gp-tab{padding:.625rem 1rem;font-size:.75rem;color:var(--text-3);cursor:pointer;border-bottom:2px solid transparent;transition:all .2s;font-family:'DM Sans',sans-serif;background:transparent;border-top:none;border-left:none;border-right:none;letter-spacing:.03em;white-space:nowrap;flex-shrink:0}
        .gp-tab:hover{color:var(--text-2)}
        .gp-tab.active{color:var(--gold);border-bottom-color:var(--gold)}
        .gp-filters{display:flex;gap:.5rem;margin-bottom:.75rem;flex-wrap:wrap}
        .gp-search{flex:1;min-width:150px;padding:.525rem .75rem;background:var(--bg-2);border:1px solid var(--border);color:var(--text);font-family:'DM Sans',sans-serif;font-size:.8rem;outline:none;border-radius:5px}
        .gp-search:focus{border-color:var(--gold)}
        .gp-select{padding:.525rem .625rem;background:var(--bg-2);border:1px solid var(--border);color:var(--text-2);font-family:'DM Sans',sans-serif;font-size:.75rem;outline:none;border-radius:5px;cursor:pointer;max-width:130px}
        .gp-select:focus{border-color:var(--gold)}
        .gp-list-toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:.625rem;flex-wrap:wrap;gap:.5rem}
        .gp-count{font-size:.7rem;color:var(--text-3)}
        .gp-collapse-btn{font-size:.65rem;color:var(--text-3);background:transparent;border:1px solid var(--border);border-radius:4px;padding:.25rem .6rem;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s}
        .gp-collapse-btn:hover{border-color:var(--gold);color:var(--gold)}
        .gp-col-header{display:grid;grid-template-columns:1fr 110px 110px 130px 80px 80px;gap:.5rem;padding:.4rem 1rem;border:1px solid var(--border);border-bottom:none;border-radius:6px 6px 0 0;background:var(--bg-2)}
        .gp-col-header span{font-size:.55rem;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3)}
        .gp-tier-group{border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:.5rem}
        .gp-tier-header{width:100%;display:flex;align-items:center;justify-content:space-between;padding:.7rem 1rem;background:var(--bg-2);border:none;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .15s}
        .gp-tier-header:hover{background:rgba(180,140,60,.05)}
        .gp-tier-pill{font-size:.58rem;font-weight:500;padding:.15rem .45rem;border-radius:99px;border:1px solid var(--border);color:var(--text-3);background:var(--bg-3)}
        .gp-row{display:grid;grid-template-columns:1fr 110px 110px 130px 80px 80px;gap:.5rem;padding:.6rem 1rem;border-top:1px solid var(--border);align-items:center;transition:background .12s}
        .gp-row:hover{background:rgba(180,140,60,.025)}
        @media(max-width:900px){.gp-col-header,.gp-row{grid-template-columns:1fr 110px 110px 80px}}
        @media(max-width:640px){.gp-col-header,.gp-row{grid-template-columns:1fr 90px 70px}}
        @media(max-width:420px){.gp-col-header{display:none}.gp-row{grid-template-columns:1fr 70px}}
        @media(max-width:900px){.gp-hide-lg{display:none!important}}
        @media(max-width:640px){.gp-hide-md{display:none!important}}
        @media(max-width:420px){.gp-hide-sm{display:none!important}}
        .gp-row-guest{display:flex;align-items:center;gap:.5rem;min-width:0}
        .gp-avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.58rem;font-weight:600;flex-shrink:0}
        .gp-row-cell{font-size:.72rem}
        .gp-status{font-size:.58rem;font-weight:500;letter-spacing:.06em;text-transform:uppercase;padding:.15rem .45rem;border-radius:99px;white-space:nowrap;border:1px solid transparent;display:inline-block}
        .gp-flag{font-size:.52rem;font-weight:500;padding:.1rem .3rem;border-radius:99px;background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.25)}
        .gp-invite-bar{background:rgba(180,140,60,.06);border:1px solid rgba(180,140,60,.2);padding:.875rem 1rem;margin-bottom:1.25rem;border-radius:5px;display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap}
        .gp-channel-toggle{display:flex;background:var(--bg-3);border:1px solid var(--border);border-radius:5px;padding:2px;gap:2px;flex-shrink:0}
        .gp-channel-btn{padding:.3rem .65rem;font-family:'DM Sans',sans-serif;font-size:.65rem;border:none;border-radius:4px;cursor:pointer;transition:all .15s;color:var(--text-3);background:transparent}
        .gp-channel-btn.on{background:var(--gold);color:#0a0a0a;font-weight:500}
        .gp-banner{padding:.75rem 1rem;margin-bottom:1rem;font-size:.78rem;border-radius:5px}
        .gp-banner-ok{background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);color:#22c55e}
        .gp-banner-err{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);color:#ef4444}
        .gp-empty{padding:3rem 1.5rem;text-align:center}
        .gp-empty-icon{font-size:2.25rem;margin-bottom:.875rem;opacity:.4}
        .gp-empty-title{font-size:.9rem;color:var(--text-2);margin-bottom:.5rem}
        .gp-empty-sub{font-size:.75rem;color:var(--text-3);line-height:1.6}
        .gp-form-card{background:var(--bg-2);border:1px solid var(--border);padding:1.25rem;border-radius:5px;max-width:560px}
        .gp-form-title{font-size:.58rem;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:1.125rem}
        .gp-field{margin-bottom:1rem}
        .gp-label{display:block;font-size:.7rem;font-weight:500;color:var(--text-2);letter-spacing:.03em;margin-bottom:.35rem}
        .gp-req{color:var(--gold);margin-left:2px}
        .gp-input,.gp-sel{width:100%;padding:.55rem .75rem;background:var(--bg-3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:.8rem;outline:none;transition:border-color .15s}
        .gp-input:focus,.gp-sel:focus{border-color:var(--gold)}
        .gp-sel option{background:var(--bg-2)}
        .gp-row2{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}
        @media(max-width:400px){.gp-row2{grid-template-columns:1fr}}
        .gp-hint{font-size:.66rem;color:var(--text-3);margin-top:.25rem}
        .gp-form-actions{display:flex;gap:.5rem;margin-top:1.25rem;flex-wrap:wrap}
        .gp-form-error{font-size:.73rem;color:#ef4444;margin-top:.625rem;padding:.5rem .75rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:4px}
        .gp-tier-cap{font-size:.68rem;padding:.4rem .6rem;border-radius:4px;margin-top:.35rem;display:flex;align-items:center;gap:.35rem}
        .gp-tier-cap-warn{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);color:#f59e0b}
        .gp-tier-cap-full{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);color:#ef4444}
        .gp-import-tabs{display:flex;gap:.5rem;margin-bottom:1.25rem;flex-wrap:wrap}
        .gp-itab{padding:.45rem 1rem;font-family:'DM Sans',sans-serif;font-size:.75rem;cursor:pointer;border-radius:5px;border:1px solid var(--border);color:var(--text-3);background:transparent;transition:all .2s}
        .gp-itab.on{background:var(--gold-dim);border-color:rgba(180,140,60,.35);color:var(--gold)}
        .gp-upload-zone{border:1.5px dashed var(--border);border-radius:7px;padding:1.75rem 1.25rem;text-align:center;cursor:pointer;transition:all .2s;background:var(--bg-3)}
        .gp-upload-zone:hover{border-color:var(--gold);background:rgba(180,140,60,.04)}
        .gp-info-box{padding:.75rem .875rem;background:var(--bg-3);border:1px solid var(--border);border-radius:5px;font-size:.75rem;color:var(--text-3);line-height:1.6;margin-bottom:.875rem}
        .gp-info-box strong{color:var(--text-2)}
        .gp-preview-table{width:100%;border-collapse:collapse;font-size:.75rem}
        .gp-preview-table th{font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);padding:.45rem .625rem;text-align:left;border-bottom:1px solid var(--border)}
        .gp-preview-table td{padding:.4rem .625rem;color:var(--text-2);border-bottom:1px solid var(--border)}
        .gp-preview-table tr:last-child td{border-bottom:none}
        .gp-sheets-input{width:100%;padding:.55rem .75rem;background:var(--bg-3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:.8rem;outline:none;margin-bottom:.75rem}
        .gp-sheets-input:focus{border-color:var(--gold)}
      `}</style>

      <div className="gp">
        {/* Topbar */}
        <div className="gp-top">
          <Link href={`/events/${id}`} className="gp-back">← {event.name}</Link>
          <div className="gp-top-right">
            {guests.length > 0 && <button className="gp-btn gp-btn-ghost" onClick={handleExport}>↓ Export</button>}
            {event.inviteModel === "CLOSED" && stats.notSent > 0 && (
              <button className="gp-btn gp-btn-send" onClick={handleSendInvites} disabled={sending}>
                {sending ? "Sending…" : `${inviteChannel === "email" ? "✉" : "📲"} Invites (${stats.notSent})`}
              </button>
            )}
            <button className="gp-btn gp-btn-gold" onClick={() => setActiveTab("add")} disabled={isAtCapacity}>
              {isAtCapacity ? "At Capacity" : "+ Add"}
            </button>
          </div>
        </div>

        {/* Heading */}
        <h1 className="gp-title">Guests</h1>
        <div className="gp-sub">
          <span>{event.name}</span>
          <span style={{ color:"var(--border)" }}>·</span>
          <span className="gp-model-badge" style={{
            color:       event.inviteModel === "OPEN" ? "#22c55e" : "#b48c3c",
            borderColor: event.inviteModel === "OPEN" ? "rgba(34,197,94,.3)" : "rgba(180,140,60,.3)",
            background:  event.inviteModel === "OPEN" ? "rgba(34,197,94,.08)" : "rgba(180,140,60,.08)",
          }}>{event.inviteModel === "OPEN" ? "🌐 Open" : "🔒 Closed"}</span>
        </div>

        {/* Stats */}
        <div className="gp-stats">
          {[{num:stats.total,label:"Total"},{num:stats.confirmed,label:"Confirmed"},{num:stats.pending,label:"Pending"},{num:stats.checkedIn,label:"Checked In"},{num:stats.notSent,label:"Not Sent"}].map(s => (
            <div className="gp-stat" key={s.label}>
              <div className="gp-stat-num">{s.num}</div>
              <div className="gp-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Capacity bars */}
        {(venueCapacity || tableSeats || event.guestTiers.some(t => t.maxGuests)) && (
          <div className="gp-capacity">
            {venueCapacity && <CapacityBar label="Venue Capacity" current={totalGuests} limit={venueCapacity} />}
            {tableSeats && tableSeats !== venueCapacity && <CapacityBar label="Table Seats" current={totalGuests} limit={tableSeats} color="#4a9eff" />}
            {event.guestTiers.filter(t => t.maxGuests).map(t => (
              <CapacityBar key={t.id} label={`${t.name} tier`} current={guests.filter(g => g.tier?.id === t.id).length} limit={t.maxGuests!} color={t.color ?? "#b48c3c"} />
            ))}
          </div>
        )}

        {/* Capacity banners */}
        {isAtCapacity && (
          <div className="gp-cap-banner gp-cap-full">🔴 <strong>Event is at capacity.</strong> No more guests can be added.</div>
        )}
        {!isAtCapacity && hardCap !== null && totalGuests >= hardCap * 0.9 && (
          <div className="gp-cap-banner gp-cap-warn">⚠ <strong>{hardCap - totalGuests} seat{hardCap - totalGuests !== 1 ? "s" : ""} remaining</strong> — approaching capacity.</div>
        )}

        {/* Invite bar — channel toggle + send button */}
        {event.inviteModel === "CLOSED" && stats.notSent > 0 && activeTab === "list" && !isAtCapacity && (
          <div className="gp-invite-bar">
            <div style={{ fontSize:".78rem", color:"rgba(180,140,60,.85)", lineHeight:1.5, flex:1, minWidth:0 }}>
              <strong style={{ display:"block", color:"#b48c3c", marginBottom:".1rem" }}>{stats.notSent} guest{stats.notSent > 1 ? "s" : ""} haven&apos;t received their invite yet</strong>
              Send all pending invites — choose channel below.
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:".5rem", flexShrink:0, flexWrap:"wrap" }}>
              <div className="gp-channel-toggle">
                <button className={`gp-channel-btn${inviteChannel === "whatsapp" ? " on" : ""}`} onClick={() => setInviteChannel("whatsapp")}>📲 WhatsApp</button>
                <button className={`gp-channel-btn${inviteChannel === "email" ? " on" : ""}`} onClick={() => setInviteChannel("email")}>✉ Email</button>
              </div>
              <button className="gp-btn gp-btn-send" onClick={handleSendInvites} disabled={sending}>{sending ? "Sending…" : "Send Invites"}</button>
            </div>
          </div>
        )}

        {/* Banners */}
        {sendResult && (
          <div className={`gp-banner ${sendResult.failed === 0 ? "gp-banner-ok" : "gp-banner-err"}`}>
            {sendResult.failed === 0 ? `✓ ${sendResult.sent} invite${sendResult.sent > 1 ? "s" : ""} sent` : `⚠ ${sendResult.sent} sent · ${sendResult.failed} failed`}
          </div>
        )}
        {addSuccess        && <div className="gp-banner gp-banner-ok">✓ Guest added successfully</div>}
        {importSuccess > 0 && <div className="gp-banner gp-banner-ok">✓ {importSuccess} guest{importSuccess > 1 ? "s" : ""} imported</div>}

        {/* Tabs */}
        <div className="gp-tabs">
          {[{key:"list",label:`Guest List (${guests.length})`},{key:"add",label:"Add Manually"},{key:"import",label:"Import"}].map(t => (
            <button key={t.key} className={`gp-tab${activeTab === t.key ? " active" : ""}`} onClick={() => setActiveTab(t.key as ActiveTab)}>{t.label}</button>
          ))}
        </div>

        {/* ══ LIST ══ */}
        {activeTab === "list" && (
          <>
            <div className="gp-filters">
              <input className="gp-search" placeholder="Search name, phone or email…" value={search} onChange={e => setSearch(e.target.value)} />
              <select className="gp-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value as RSVPStatus | "ALL")}>
                <option value="ALL">All Statuses</option>
                {Object.entries(RSVP_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              {event.guestTiers.length > 0 && (
                <select className="gp-select" value={filterTier} onChange={e => setFilterTier(e.target.value)}>
                  <option value="ALL">All Tiers</option>
                  {event.guestTiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </div>
            {filtered.length === 0 ? (
              <div className="gp-empty">
                <div className="gp-empty-icon">👥</div>
                <div className="gp-empty-title">{guests.length === 0 ? "No guests yet" : "No guests match filters"}</div>
                <div className="gp-empty-sub">{guests.length === 0 ? (event.inviteModel === "CLOSED" ? "Add manually, upload CSV, or sync a Google Sheet." : "Share the RSVP link.") : "Try adjusting filters."}</div>
              </div>
            ) : (
              <>
                <div className="gp-list-toolbar">
                  <span className="gp-count">{filtered.length} guest{filtered.length > 1 ? "s" : ""}{(search || filterStatus !== "ALL" || filterTier !== "ALL") ? " matching filters" : ""}</span>
                  {groupedGuests.length > 1 && (
                    <div style={{ display:"flex", gap:".375rem" }}>
                      <button className="gp-collapse-btn" onClick={() => setCollapsedGroups(new Set())}>Expand all</button>
                      <button className="gp-collapse-btn" onClick={() => setCollapsedGroups(new Set(groupedGuests.map(g => g.label)))}>Collapse all</button>
                    </div>
                  )}
                </div>
                <div className="gp-col-header">
                  <span>Guest</span><span>RSVP</span><span>Check-in</span>
                  <span className="gp-hide-md">Invite</span><span className="gp-hide-lg">Table</span><span></span>
                </div>
                {groupedGuests.map(g => (
                  <TierGroup key={g.label} label={g.label} color={g.color} guests={g.guests}
                    isCollapsed={collapsedGroups.has(g.label)} onToggle={() => toggleGroup(g.label)}
                    deletingId={deletingId} handleDelete={handleDelete}
                    inviteModel={event.inviteModel}
                    sendingGuestId={sendingGuestId}
                    handleSendGuestLink={handleSendGuestLink}
                  />
                ))}
              </>
            )}
          </>
        )}

        {/* ══ ADD ══ */}
        {activeTab === "add" && (
          <div className="gp-form-card">
            <div className="gp-form-title">Add Guest Manually</div>
            {isAtCapacity && <div className="gp-tier-cap gp-tier-cap-full" style={{ marginBottom:"1rem" }}>🔴 Event is at capacity — cannot add guests.</div>}
            <div className="gp-row2">
              <div className="gp-field">
                <label className="gp-label">First Name <span className="gp-req">*</span></label>
                <input className="gp-input" placeholder="e.g. Tunde" value={addForm.firstName} onChange={e => setAddForm(p => ({...p,firstName:e.target.value}))} disabled={isAtCapacity} />
              </div>
              <div className="gp-field">
                <label className="gp-label">Last Name <span className="gp-req">*</span></label>
                <input className="gp-input" placeholder="e.g. Adeyemi" value={addForm.lastName} onChange={e => setAddForm(p => ({...p,lastName:e.target.value}))} disabled={isAtCapacity} />
              </div>
            </div>
            <div className="gp-field">
              <label className="gp-label">Phone Number</label>
              <input className="gp-input" placeholder="e.g. 08012345678" value={addForm.phone} onChange={e => setAddForm(p => ({...p,phone:e.target.value}))} disabled={isAtCapacity} />
              <span className="gp-hint">Required to send a WhatsApp invite.</span>
            </div>
            <div className="gp-field">
              <label className="gp-label">Email Address</label>
              <input className="gp-input" type="email" placeholder="e.g. tunde@example.com" value={addForm.email} onChange={e => setAddForm(p => ({...p,email:e.target.value}))} disabled={isAtCapacity} />
              <span className="gp-hint">Required to send an email invite. If both are provided, email is preferred.</span>
            </div>
            {event.guestTiers.length > 0 && (
              <div className="gp-field">
                <label className="gp-label">Guest Tier</label>
                <select className="gp-sel" value={addForm.tierId} onChange={e => setAddForm(p => ({...p,tierId:e.target.value}))} disabled={isAtCapacity}>
                  <option value="">No tier assigned</option>
                  {event.guestTiers.map(t => {
                    const cnt  = guests.filter(g => g.tier?.id === t.id).length
                    const full = t.maxGuests ? cnt >= t.maxGuests : false
                    return <option key={t.id} value={t.id} disabled={full}>{t.name}{t.maxGuests ? ` (${cnt}/${t.maxGuests})` : ""}{full ? " — Full" : ""}</option>
                  })}
                </select>
                {selTier && (
                  selTier.isFull
                    ? <div className="gp-tier-cap gp-tier-cap-full">🔴 {selTier.name} is full ({selTier.limit} max)</div>
                    : selTier.current / selTier.limit >= 0.8
                      ? <div className="gp-tier-cap gp-tier-cap-warn">⚠ {selTier.limit - selTier.current} spot{selTier.limit - selTier.current > 1 ? "s" : ""} left in {selTier.name}</div>
                      : null
                )}
              </div>
            )}
            {addError && <div className="gp-form-error">{addError}</div>}
            <div className="gp-form-actions">
              <button className="gp-btn gp-btn-gold" onClick={handleAdd} disabled={adding || !canAddGuest}>{adding ? "Adding…" : "Add Guest"}</button>
              <button className="gp-btn gp-btn-ghost" onClick={() => setActiveTab("list")}>Cancel</button>
            </div>
          </div>
        )}

        {/* ══ IMPORT ══ */}
        {activeTab === "import" && (
          <div>
            <div className="gp-import-tabs">
              <button className={`gp-itab${importType === "csv" ? " on" : ""}`} onClick={() => setImportType("csv")}>📄 CSV Upload</button>
              <button className={`gp-itab${importType === "sheets" ? " on" : ""}`} onClick={() => setImportType("sheets")}>📊 Google Sheets</button>
            </div>
            {importType === "csv" && (
              <div className="gp-form-card" style={{ maxWidth:"100%" }}>
                <div className="gp-form-title">Import from CSV</div>
                <div className="gp-info-box">
                  <strong>Required:</strong> First Name, Last Name &nbsp;·&nbsp; <strong>Optional:</strong> Phone, Email · Max 200 per import.
                  {hardCap !== null && <><br /><strong>Remaining capacity:</strong> {hardCap - totalGuests} seat{hardCap - totalGuests !== 1 ? "s" : ""}.</>}
                </div>
                {!csvPreview.length ? (
                  <div className="gp-upload-zone" onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCsvFile(f) }}>
                    <input ref={fileInputRef} type="file" accept=".csv" style={{ display:"none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleCsvFile(f) }} />
                    <div style={{ fontSize:"1.75rem", marginBottom:".625rem", opacity:.5 }}>📄</div>
                    <div style={{ fontSize:".82rem", color:"var(--text-2)", marginBottom:".25rem" }}>Drop CSV here or click to browse</div>
                    <div style={{ fontSize:".7rem", color:"var(--text-3)" }}>.csv files only</div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize:".75rem", color:"var(--text-2)", marginBottom:".5rem" }}>
                      <strong style={{ color:"var(--gold)" }}>{csvPreview.length}</strong> guests ready{csvFile && <span style={{ color:"var(--text-3)", marginLeft:".5rem" }}>from {csvFile.name}</span>}
                    </div>
                    <div style={{ maxHeight:250, overflowY:"auto", border:"1px solid var(--border)", borderRadius:5 }}>
                      <table className="gp-preview-table">
                        <thead><tr><th>First Name</th><th>Last Name</th><th>Phone</th></tr></thead>
                        <tbody>
                          {csvPreview.slice(0,10).map((r,i) => <tr key={i}><td>{r.firstName}</td><td>{r.lastName}</td><td>{r.phone||"—"}</td></tr>)}
                          {csvPreview.length > 10 && <tr><td colSpan={3} style={{ color:"var(--text-3)", fontStyle:"italic" }}>+ {csvPreview.length - 10} more…</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <div className="gp-form-actions" style={{ marginTop:".875rem" }}>
                      <button className="gp-btn gp-btn-gold" onClick={handleCsvImport} disabled={importing}>{importing ? "Importing…" : `Import ${csvPreview.length} Guests`}</button>
                      <button className="gp-btn gp-btn-ghost" onClick={() => { setCsvPreview([]); setCsvFile(null) }}>Cancel</button>
                    </div>
                  </>
                )}
                {csvError && <div className="gp-form-error" style={{ marginTop:".75rem" }}>{csvError}</div>}
              </div>
            )}
            {importType === "sheets" && (
              <div className="gp-form-card" style={{ maxWidth:"100%" }}>
                <div className="gp-form-title">Google Sheets Sync</div>
                <div className="gp-info-box">
                  1. Open your sheet → <strong>Share → Anyone with link → Viewer</strong><br />
                  2. Paste the link below and click Sync. Re-sync anytime to pick up new rows.<br /><br />
                  <strong>Required:</strong> First Name, Last Name &nbsp;·&nbsp; <strong>Optional:</strong> Phone, Email
                </div>
                <div className="gp-field">
                  <label className="gp-label">Google Sheets Link</label>
                  <input className="gp-sheets-input" placeholder="https://docs.google.com/spreadsheets/d/…" value={sheetsUrl} onChange={e => setSheetsUrl(e.target.value)} />
                </div>
                {sheetsError && <div className="gp-form-error">{sheetsError}</div>}
                <div className="gp-form-actions">
                  <button className="gp-btn gp-btn-gold" onClick={handleSheetsSync} disabled={importing}>{importing ? "Syncing…" : "Sync Sheet"}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
