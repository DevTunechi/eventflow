"use client"

// ─────────────────────────────────────────────
// src/app/(dashboard)/events/[id]/guests/page.tsx
// ─────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import WhatsAppSetupModal from "@/components/WhatsAppSetupModal"

// ── Types ──────────────────────────────────────

interface GuestTier {
  id:    string
  name:  string
  color: string | null
}

interface Guest {
  id:           string
  firstName:    string
  lastName:     string
  phone:        string | null
  email:        string | null
  rsvpStatus:   RSVPStatus
  rsvpAt:       string | null
  checkedIn:    boolean
  checkedInAt:  string | null
  inviteSentAt: string | null
  isFlagged:    boolean
  tier:         GuestTier | null
  tableNumber:  string | null
  createdAt:    string
}

interface EventSummary {
  id:          string
  name:        string
  inviteModel: "OPEN" | "CLOSED"
  status:      string
  guestTiers:  GuestTier[]
  slug:        string
  _count:      { guests: number }
}

type RSVPStatus = "PENDING" | "CONFIRMED" | "DECLINED" | "WAITLISTED" | "NO_SHOW"
type ActiveTab  = "list" | "add" | "import"
type ImportType = "csv" | "sheets"

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

const initials = (first: string, last: string) =>
  `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase()

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—"

const fmtTime = (d: string | null) =>
  d ? new Date(d).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" }) : ""

export default function GuestsPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()

  const [event,        setEvent]        = useState<EventSummary | null>(null)
  const [guests,       setGuests]       = useState<Guest[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)

  const [activeTab,    setActiveTab]    = useState<ActiveTab>("list")
  const [search,       setSearch]       = useState("")
  const [filterStatus, setFilterStatus] = useState<RSVPStatus | "ALL">("ALL")
  const [filterTier,   setFilterTier]   = useState<string>("ALL")

  const [addForm,    setAddForm]    = useState({ firstName: "", lastName: "", phone: "", tierId: "" })
  const [adding,     setAdding]     = useState(false)
  const [addError,   setAddError]   = useState("")
  const [addSuccess, setAddSuccess] = useState(false)

  const [importType,    setImportType]    = useState<ImportType>("csv")
  const [csvFile,       setCsvFile]       = useState<File | null>(null)
  const [csvPreview,    setCsvPreview]    = useState<{ firstName: string; lastName: string; phone: string }[]>([])
  const [csvError,      setCsvError]      = useState("")
  const [sheetsUrl,     setSheetsUrl]     = useState("")
  const [sheetsError,   setSheetsError]   = useState("")
  const [importing,     setImporting]     = useState(false)
  const [importSuccess, setImportSuccess] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [sending,    setSending]    = useState(false)
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // WhatsApp
  const [waConnected,   setWaConnected]   = useState<boolean | null>(null) // null = not checked yet
  const [showWAModal,   setShowWAModal]   = useState(false)

  // ── Load event + guests ───────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const hdrs = getAuthHeaders()
      const [evRes, gRes, waRes] = await Promise.all([
        fetch(`/api/events/${id}`,        { headers: hdrs }),
        fetch(`/api/events/${id}/guests`, { headers: hdrs }),
        fetch(`/api/whatsapp/status`,     { headers: hdrs }),
      ])
      if (!evRes.ok) throw new Error("Failed to load event")
      const evData = await evRes.json()
      setEvent({ ...evData.event, guestTiers: evData.event.guestTiers ?? [] })
      if (gRes.ok) {
        const gData = await gRes.json()
        setGuests(Array.isArray(gData) ? gData : [])
      }
      if (waRes.ok) {
        const waData = await waRes.json()
        setWaConnected(waData.connected ?? false)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // ── Filtered guests ───────────────────────────

  const filtered = guests.filter(g => {
    const name = `${g.firstName} ${g.lastName}`.toLowerCase()
    const matchSearch = !search || name.includes(search.toLowerCase()) || (g.phone ?? "").includes(search)
    const matchStatus = filterStatus === "ALL" || g.rsvpStatus === filterStatus
    const matchTier   = filterTier   === "ALL" || g.tier?.id === filterTier
    return matchSearch && matchStatus && matchTier
  })

  const stats = {
    total:     guests.length,
    confirmed: guests.filter(g => g.rsvpStatus === "CONFIRMED").length,
    pending:   guests.filter(g => g.rsvpStatus === "PENDING").length,
    checkedIn: guests.filter(g => g.checkedIn).length,
    notSent:   guests.filter(g => !g.inviteSentAt).length,
  }

  // ── Add guest ─────────────────────────────────

  const handleAdd = async () => {
    if (!addForm.firstName.trim() || !addForm.lastName.trim()) {
      setAddError("First name and last name are required.")
      return
    }
    setAdding(true)
    setAddError("")
    try {
      const res = await fetch(`/api/events/${id}/guests`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify({
          firstName: addForm.firstName.trim(),
          lastName:  addForm.lastName.trim(),
          phone:     addForm.phone.trim() || null,
          tierId:    addForm.tierId || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed") }
      const { guest: newGuest } = await res.json()
      setGuests(prev => [newGuest, ...prev])
      setAddForm({ firstName: "", lastName: "", phone: "", tierId: "" })
      setAddSuccess(true)
      setTimeout(() => setAddSuccess(false), 3000)
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Failed to add guest")
    } finally {
      setAdding(false)
    }
  }

  // ── CSV ───────────────────────────────────────

  const handleCsvFile = (file: File) => {
    setCsvError("")
    setCsvPreview([])
    if (!file.name.endsWith(".csv")) { setCsvError("Please upload a .csv file."); return }
    const reader = new FileReader()
    reader.onload = (e) => {
      const text  = e.target?.result as string
      const lines = text.trim().split(/\r?\n/)
      if (lines.length < 2) { setCsvError("CSV appears to be empty."); return }
      const header = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ""))
      const fnIdx  = header.findIndex(h => h.includes("first") || h === "firstname" || h === "fname")
      const lnIdx  = header.findIndex(h => h.includes("last")  || h === "lastname"  || h === "lname")
      const phIdx  = header.findIndex(h => h.includes("phone") || h === "mobile"    || h === "tel")
      if (fnIdx === -1 || lnIdx === -1) { setCsvError("CSV must have columns for First Name and Last Name."); return }
      const rows = lines.slice(1).map(line => {
        const cols = line.split(",")
        return { firstName: (cols[fnIdx] ?? "").trim(), lastName: (cols[lnIdx] ?? "").trim(), phone: phIdx !== -1 ? (cols[phIdx] ?? "").trim() : "" }
      }).filter(r => r.firstName || r.lastName)
      if (!rows.length) { setCsvError("No valid rows found in CSV."); return }
      setCsvPreview(rows.slice(0, 200))
      setCsvFile(file)
    }
    reader.readAsText(file)
  }

  const handleCsvImport = async () => {
    if (!csvPreview.length) return
    setImporting(true)
    try {
      const res = await fetch(`/api/events/${id}/guests/import`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify({ guests: csvPreview, source: "csv" }),
      })
      if (!res.ok) throw new Error("Import failed")
      const d = await res.json()
      setImportSuccess(d.imported ?? csvPreview.length)
      setCsvPreview([]); setCsvFile(null)
      await load()
    } catch (e: unknown) {
      setCsvError(e instanceof Error ? e.message : "Import failed")
    } finally {
      setImporting(false)
    }
  }

  // ── Google Sheets ─────────────────────────────

  const handleSheetsSync = async () => {
    if (!sheetsUrl.trim()) { setSheetsError("Paste your Google Sheets link."); return }
    if (!sheetsUrl.includes("docs.google.com/spreadsheets")) { setSheetsError("That doesn't look like a Google Sheets link."); return }
    setImporting(true)
    setSheetsError("")
    try {
      const res = await fetch(`/api/events/${id}/guests/sync-sheets`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify({ sheetsUrl }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Sync failed") }
      const d = await res.json()
      setImportSuccess(d.imported ?? 0)
      await load()
    } catch (e: unknown) {
      setSheetsError(e instanceof Error ? e.message : "Sync failed")
    } finally {
      setImporting(false)
    }
  }

  // ── Send invites ──────────────────────────────
  // If WhatsApp not connected → show setup modal
  // If connected → confirm + send

  const handleSendInvites = async () => {
    const unsent = guests.filter(g => !g.inviteSentAt)
    if (!unsent.length) return

    // Check WA connection — if not connected, open setup modal
    if (!waConnected) {
      setShowWAModal(true)
      return
    }

    if (!confirm(`Send WhatsApp invites to ${unsent.length} guest${unsent.length > 1 ? "s" : ""}?`)) return
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch(`/api/events/${id}/guests/send-invites`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify({ guestIds: unsent.map(g => g.id) }),
      })
      const d = await res.json()
      setSendResult({ sent: d.sent ?? 0, failed: d.failed ?? 0 })
      await load()
    } catch {
      setSendResult({ sent: 0, failed: unsent.length })
    } finally {
      setSending(false)
    }
  }

  // ── Delete guest ──────────────────────────────

  const handleDelete = async (guestId: string, name: string) => {
    if (!confirm(`Remove ${name} from the guest list?`)) return
    setDeletingId(guestId)
    try {
      await fetch(`/api/events/${id}/guests/${guestId}`, { method: "DELETE", headers: getAuthHeaders() })
      setGuests(prev => prev.filter(g => g.id !== guestId))
    } finally {
      setDeletingId(null)
    }
  }

  // ── Export CSV ────────────────────────────────

  const handleExport = () => {
    const rows = [
      ["First Name", "Last Name", "Phone", "Email", "Tier", "RSVP Status", "Checked In", "Table", "Invite Sent"],
      ...guests.map(g => [g.firstName, g.lastName, g.phone ?? "", g.email ?? "", g.tier?.name ?? "", g.rsvpStatus, g.checkedIn ? "Yes" : "No", g.tableNumber ?? "", g.inviteSentAt ? fmtDate(g.inviteSentAt) : "No"])
    ]
    const csv  = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href = url; a.download = `${event?.name ?? "guests"}-guest-list.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Loading / error ───────────────────────────

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
        .gp { max-width: 1000px; margin: 0 auto; padding: 0 0 4rem; animation: gpIn 0.3s ease; }
        @keyframes gpIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:none; } }
        .gp-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:2rem; flex-wrap:wrap; gap:0.75rem; }
        .gp-back { font-size:0.78rem; color:var(--text-3); text-decoration:none; display:flex; align-items:center; gap:0.35rem; transition:color 0.2s; }
        .gp-back:hover { color:var(--gold); }
        .gp-top-right { display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center; }
        .gp-heading { margin-bottom:1.75rem; }
        .gp-title { font-family:'Cormorant Garamond',serif; font-size:clamp(1.5rem,3vw,2.25rem); font-weight:300; color:var(--text); letter-spacing:-0.01em; margin-bottom:0.25rem; }
        .gp-sub { font-size:0.78rem; color:var(--text-3); display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; }
        .gp-model-badge { font-size:0.6rem; font-weight:500; letter-spacing:0.08em; text-transform:uppercase; padding:0.2rem 0.6rem; border-radius:99px; border:1px solid; }
        .gp-stats { display:grid; grid-template-columns:repeat(5,1fr); gap:0.625rem; margin-bottom:1.75rem; }
        @media(max-width:640px) { .gp-stats { grid-template-columns:repeat(3,1fr); } }
        .gp-stat { background:var(--bg-2); border:1px solid var(--border); padding:0.875rem; text-align:center; }
        .gp-stat-num { font-family:'Cormorant Garamond',serif; font-size:1.75rem; font-weight:300; color:var(--gold); line-height:1; margin-bottom:0.2rem; }
        .gp-stat-label { font-size:0.58rem; color:var(--text-3); letter-spacing:0.1em; text-transform:uppercase; }
        .gp-tabs { display:flex; gap:0; border-bottom:1px solid var(--border); margin-bottom:1.75rem; }
        .gp-tab { padding:0.625rem 1.25rem; font-size:0.78rem; color:var(--text-3); cursor:pointer; border-bottom:2px solid transparent; transition:all 0.2s; font-family:'DM Sans',sans-serif; background:transparent; border-top:none; border-left:none; border-right:none; letter-spacing:0.03em; }
        .gp-tab:hover { color:var(--text-2); }
        .gp-tab.active { color:var(--gold); border-bottom-color:var(--gold); }
        .gp-btn { padding:0.5rem 1rem; font-family:'DM Sans',sans-serif; font-size:0.775rem; cursor:pointer; border:none; transition:all 0.2s; display:inline-flex; align-items:center; gap:0.4rem; letter-spacing:0.03em; text-decoration:none; }
        .gp-btn-gold { background:var(--gold); color:#0a0a0a; font-weight:500; border-radius:5px; }
        .gp-btn-gold:hover:not(:disabled) { background:#c9a050; }
        .gp-btn-gold:disabled { opacity:0.45; cursor:not-allowed; }
        .gp-btn-ghost { background:transparent; border:1px solid var(--border); color:var(--text-2); border-radius:5px; }
        .gp-btn-ghost:hover { border-color:var(--border-hover); color:var(--text); }
        .gp-btn-danger { background:transparent; border:1px solid rgba(239,68,68,0.2); color:rgba(239,68,68,0.6); border-radius:5px; padding:0.35rem 0.7rem; font-size:0.72rem; }
        .gp-btn-danger:hover:not(:disabled) { border-color:#ef4444; color:#ef4444; }
        .gp-btn-danger:disabled { opacity:0.3; cursor:not-allowed; }
        .gp-btn-send { background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.3); color:#22c55e; border-radius:5px; }
        .gp-btn-send:hover:not(:disabled) { background:rgba(34,197,94,0.18); }
        .gp-btn-send:disabled { opacity:0.4; cursor:not-allowed; }
        .gp-filters { display:flex; gap:0.625rem; margin-bottom:1.25rem; flex-wrap:wrap; align-items:center; }
        .gp-search { flex:1; min-width:200px; padding:0.575rem 0.875rem; background:var(--bg-2); border:1px solid var(--border); color:var(--text); font-family:'DM Sans',sans-serif; font-size:0.825rem; outline:none; border-radius:5px; }
        .gp-search:focus { border-color:var(--gold); }
        .gp-select { padding:0.575rem 0.875rem; background:var(--bg-2); border:1px solid var(--border); color:var(--text-2); font-family:'DM Sans',sans-serif; font-size:0.78rem; outline:none; border-radius:5px; cursor:pointer; }
        .gp-select:focus { border-color:var(--gold); }
        .gp-table-wrap { background:var(--bg-2); border:1px solid var(--border); overflow:hidden; }
        .gp-table { width:100%; border-collapse:collapse; }
        .gp-th { font-size:0.6rem; font-weight:500; letter-spacing:0.12em; text-transform:uppercase; color:var(--text-3); padding:0.75rem 1rem; text-align:left; border-bottom:1px solid var(--border); white-space:nowrap; background:var(--bg-2); }
        .gp-tr { border-bottom:1px solid var(--border); transition:background 0.15s; }
        .gp-tr:last-child { border-bottom:none; }
        .gp-tr:hover { background:rgba(180,140,60,0.03); }
        .gp-td { padding:0.75rem 1rem; font-size:0.8rem; color:var(--text-2); vertical-align:middle; }
        .gp-avatar { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.65rem; font-weight:600; flex-shrink:0; color:#0a0a0a; }
        .gp-status { font-size:0.62rem; font-weight:500; letter-spacing:0.06em; text-transform:uppercase; padding:0.2rem 0.55rem; border-radius:99px; white-space:nowrap; border:1px solid transparent; }
        .gp-tier { font-size:0.62rem; font-weight:500; letter-spacing:0.04em; padding:0.18rem 0.55rem; border-radius:99px; white-space:nowrap; border:1px solid; display:inline-flex; align-items:center; gap:0.3rem; }
        .gp-tier-dot { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
        .gp-checkin { display:flex; align-items:center; gap:0.4rem; font-size:0.75rem; }
        .gp-checkin-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        .gp-empty { padding:4rem 2rem; text-align:center; }
        .gp-empty-icon { font-size:2.5rem; margin-bottom:1rem; opacity:0.4; }
        .gp-empty-title { font-size:0.925rem; color:var(--text-2); margin-bottom:0.5rem; }
        .gp-empty-sub { font-size:0.78rem; color:var(--text-3); line-height:1.6; }
        .gp-banner { padding:0.875rem 1.125rem; margin-bottom:1.25rem; font-size:0.8rem; border-radius:5px; display:flex; align-items:center; gap:0.5rem; }
        .gp-banner-ok   { background:rgba(34,197,94,0.08);  border:1px solid rgba(34,197,94,0.25);  color:#22c55e; }
        .gp-banner-err  { background:rgba(239,68,68,0.08);  border:1px solid rgba(239,68,68,0.25);  color:#ef4444; }
        .gp-banner-info { background:rgba(180,140,60,0.08); border:1px solid rgba(180,140,60,0.25); color:#b48c3c; }
        .gp-form-card { background:var(--bg-2); border:1px solid var(--border); padding:1.5rem; max-width:560px; }
        .gp-form-title { font-size:0.6rem; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--gold); margin-bottom:1.25rem; }
        .gp-field { margin-bottom:1.125rem; }
        .gp-label { display:block; font-size:0.72rem; font-weight:500; color:var(--text-2); letter-spacing:0.03em; margin-bottom:0.4rem; }
        .gp-req { color:var(--gold); margin-left:2px; }
        .gp-input, .gp-sel { width:100%; padding:0.6rem 0.875rem; background:var(--bg-3); border:1px solid var(--border); border-radius:5px; color:var(--text); font-family:'DM Sans',sans-serif; font-size:0.825rem; outline:none; box-sizing:border-box; transition:border-color 0.15s; }
        .gp-input:focus, .gp-sel:focus { border-color:var(--gold); }
        .gp-sel option { background:var(--bg-2); }
        .gp-row2 { display:grid; grid-template-columns:1fr 1fr; gap:0.875rem; }
        @media(max-width:480px) { .gp-row2 { grid-template-columns:1fr; } }
        .gp-hint { font-size:0.68rem; color:var(--text-3); margin-top:0.3rem; }
        .gp-form-actions { display:flex; gap:0.625rem; margin-top:1.5rem; }
        .gp-form-error { font-size:0.75rem; color:#ef4444; margin-top:0.75rem; padding:0.6rem 0.875rem; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); border-radius:4px; }
        .gp-import-tabs { display:flex; gap:0.5rem; margin-bottom:1.5rem; }
        .gp-itab { padding:0.5rem 1.125rem; font-family:'DM Sans',sans-serif; font-size:0.78rem; cursor:pointer; border-radius:5px; border:1px solid var(--border); color:var(--text-3); background:transparent; transition:all 0.2s; }
        .gp-itab.on { background:var(--gold-dim); border-color:rgba(180,140,60,0.35); color:var(--gold); }
        .gp-upload-zone { border:1.5px dashed var(--border); border-radius:7px; padding:2rem; text-align:center; cursor:pointer; transition:all 0.2s; background:var(--bg-3); }
        .gp-upload-zone:hover { border-color:var(--gold); background:rgba(180,140,60,0.04); }
        .gp-upload-zone.drag { border-color:var(--gold); background:rgba(180,140,60,0.08); }
        .gp-preview-table { width:100%; border-collapse:collapse; margin-top:1rem; font-size:0.78rem; }
        .gp-preview-table th { font-size:0.6rem; letter-spacing:0.1em; text-transform:uppercase; color:var(--text-3); padding:0.5rem 0.75rem; text-align:left; border-bottom:1px solid var(--border); }
        .gp-preview-table td { padding:0.45rem 0.75rem; color:var(--text-2); border-bottom:1px solid var(--border); }
        .gp-preview-table tr:last-child td { border-bottom:none; }
        .gp-sheets-input { width:100%; padding:0.6rem 0.875rem; background:var(--bg-3); border:1px solid var(--border); border-radius:5px; color:var(--text); font-family:'DM Sans',sans-serif; font-size:0.825rem; outline:none; box-sizing:border-box; margin-bottom:0.875rem; }
        .gp-sheets-input:focus { border-color:var(--gold); }
        .gp-info-box { padding:0.875rem 1rem; background:var(--bg-3); border:1px solid var(--border); border-radius:5px; font-size:0.78rem; color:var(--text-3); line-height:1.6; margin-bottom:1rem; }
        .gp-info-box strong { color:var(--text-2); }
        .gp-invite-bar { background:rgba(180,140,60,0.06); border:1px solid rgba(180,140,60,0.2); padding:1rem 1.25rem; margin-bottom:1.5rem; display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
        .gp-invite-bar-text { font-size:0.8rem; color:rgba(180,140,60,0.85); line-height:1.5; }
        .gp-invite-bar-text strong { display:block; color:#b48c3c; font-weight:500; margin-bottom:0.1rem; }
        .gp-flag { font-size:0.62rem; font-weight:500; padding:0.15rem 0.45rem; border-radius:99px; background:rgba(239,68,68,0.12); color:#ef4444; border:1px solid rgba(239,68,68,0.25); }
        .gp-count { font-size:0.72rem; color:var(--text-3); margin-bottom:0.875rem; }
        /* WhatsApp not connected nudge */
        .gp-wa-nudge { background:rgba(37,211,102,0.05); border:1px solid rgba(37,211,102,0.2); padding:0.875rem 1.25rem; margin-bottom:1.5rem; display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; border-radius:5px; }
        .gp-wa-nudge-text { font-size:0.78rem; color:rgba(37,211,102,0.85); line-height:1.5; }
        .gp-wa-nudge-text strong { display:block; color:#25d366; font-weight:500; margin-bottom:0.1rem; }
        .gp-wa-nudge-btn { padding:0.45rem 0.875rem; background:#25d366; color:#fff; font-family:'DM Sans',sans-serif; font-size:0.75rem; font-weight:500; border:none; border-radius:5px; cursor:pointer; white-space:nowrap; transition:background 0.2s; }
        .gp-wa-nudge-btn:hover { background:#1db954; }
      `}</style>

      <div className="gp">

        {/* Topbar */}
        <div className="gp-top">
          <Link href={`/events/${id}`} className="gp-back">← {event.name}</Link>
          <div className="gp-top-right">
            {guests.length > 0 && (
              <button className="gp-btn gp-btn-ghost" onClick={handleExport}>↓ Export</button>
            )}
            {event.inviteModel === "CLOSED" && stats.notSent > 0 && (
              <button className="gp-btn gp-btn-send" onClick={handleSendInvites} disabled={sending}>
                {sending ? "Sending…" : `📲 Send Invites (${stats.notSent})`}
              </button>
            )}
            <button className="gp-btn gp-btn-gold" onClick={() => setActiveTab("add")}>+ Add Guest</button>
          </div>
        </div>

        {/* Heading */}
        <div className="gp-heading">
          <h1 className="gp-title">Guests</h1>
          <div className="gp-sub">
            <span>{event.name}</span>
            <span style={{ color: "var(--border)" }}>·</span>
            <span className="gp-model-badge" style={{
              color:       event.inviteModel === "OPEN" ? "#22c55e" : "#b48c3c",
              borderColor: event.inviteModel === "OPEN" ? "rgba(34,197,94,0.3)" : "rgba(180,140,60,0.3)",
              background:  event.inviteModel === "OPEN" ? "rgba(34,197,94,0.08)" : "rgba(180,140,60,0.08)",
            }}>
              {event.inviteModel === "OPEN" ? "🌐 Open Invite" : "🔒 Closed Invite"}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="gp-stats">
          {[
            { num: stats.total,     label: "Total"      },
            { num: stats.confirmed, label: "Confirmed"  },
            { num: stats.pending,   label: "Pending"    },
            { num: stats.checkedIn, label: "Checked In" },
            { num: stats.notSent,   label: "Not Sent"   },
          ].map(s => (
            <div className="gp-stat" key={s.label}>
              <div className="gp-stat-num">{s.num}</div>
              <div className="gp-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* WhatsApp not connected nudge — show when there are guests but WA not set up */}
        {waConnected === false && guests.length > 0 && activeTab === "list" && (
          <div className="gp-wa-nudge">
            <div className="gp-wa-nudge-text">
              <strong>📲 Connect WhatsApp to send invites</strong>
              You have guests ready — connect your WhatsApp Business number to send them invites.
            </div>
            <button className="gp-wa-nudge-btn" onClick={() => setShowWAModal(true)}>
              Connect now →
            </button>
          </div>
        )}

        {/* Unsent invites banner */}
        {event.inviteModel === "CLOSED" && stats.notSent > 0 && activeTab === "list" && waConnected && (
          <div className="gp-invite-bar">
            <div className="gp-invite-bar-text">
              <strong>{stats.notSent} guest{stats.notSent > 1 ? "s" : ""} haven&apos;t received their invite yet</strong>
              Review the list then send all pending invites at once via WhatsApp.
            </div>
            <button className="gp-btn gp-btn-send" onClick={handleSendInvites} disabled={sending}>
              {sending ? "Sending…" : "Send Invites"}
            </button>
          </div>
        )}

        {/* Banners */}
        {sendResult && (
          <div className={`gp-banner ${sendResult.failed === 0 ? "gp-banner-ok" : "gp-banner-err"}`}>
            {sendResult.failed === 0
              ? `✓ ${sendResult.sent} invite${sendResult.sent > 1 ? "s" : ""} sent successfully`
              : `⚠ ${sendResult.sent} sent · ${sendResult.failed} failed — check WhatsApp setup`
            }
          </div>
        )}
        {addSuccess    && <div className="gp-banner gp-banner-ok">✓ Guest added successfully</div>}
        {importSuccess > 0 && <div className="gp-banner gp-banner-ok">✓ {importSuccess} guest{importSuccess > 1 ? "s" : ""} imported successfully</div>}

        {/* Tabs */}
        <div className="gp-tabs">
          {[
            { key: "list",   label: `Guest List (${guests.length})` },
            { key: "add",    label: "Add Manually" },
            { key: "import", label: "Import"       },
          ].map(t => (
            <button key={t.key} className={`gp-tab${activeTab === t.key ? " active" : ""}`} onClick={() => setActiveTab(t.key as ActiveTab)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══ GUEST LIST ══ */}
        {activeTab === "list" && (
          <>
            <div className="gp-filters">
              <input className="gp-search" placeholder="Search by name or phone…" value={search} onChange={e => setSearch(e.target.value)} />
              <select className="gp-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value as RSVPStatus | "ALL")}>
                <option value="ALL">All Statuses</option>
                {Object.entries(RSVP_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              {event.guestTiers.length > 0 && (
                <select className="gp-select" value={filterTier} onChange={e => setFilterTier(e.target.value)}>
                  <option value="ALL">All Tiers</option>
                  {event.guestTiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </div>

            {filtered.length > 0 && (
              <div className="gp-count">{filtered.length} guest{filtered.length > 1 ? "s" : ""}{search || filterStatus !== "ALL" || filterTier !== "ALL" ? " matching filters" : ""}</div>
            )}

            <div className="gp-table-wrap">
              {filtered.length === 0 ? (
                <div className="gp-empty">
                  <div className="gp-empty-icon">👥</div>
                  <div className="gp-empty-title">{guests.length === 0 ? "No guests yet" : "No guests match your filters"}</div>
                  <div className="gp-empty-sub">
                    {guests.length === 0
                      ? event.inviteModel === "CLOSED"
                        ? "Add guests manually, upload a CSV, or sync a Google Sheet to get started."
                        : "Share the RSVP link with guests. They will appear here when they register."
                      : "Try adjusting your search or filters."
                    }
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="gp-table">
                    <thead>
                      <tr>
                        <th className="gp-th">Guest</th>
                        <th className="gp-th">Tier</th>
                        <th className="gp-th">RSVP</th>
                        <th className="gp-th">Check-in</th>
                        <th className="gp-th">Invite Sent</th>
                        <th className="gp-th">Table</th>
                        <th className="gp-th"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(g => {
                        const rsvp     = RSVP_CONFIG[g.rsvpStatus]
                        const color    = g.tier?.color ?? "#b48c3c"
                        const fullName = `${g.firstName} ${g.lastName}`
                        return (
                          <tr className="gp-tr" key={g.id}>
                            <td className="gp-td">
                              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                <div className="gp-avatar" style={{ background: color + "33", border: `1.5px solid ${color}55`, color }}>
                                  {initials(g.firstName, g.lastName)}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 500, color: "var(--text)", fontSize: "0.825rem" }}>{fullName}</div>
                                  <div style={{ fontSize: "0.68rem", color: "var(--text-3)" }}>{g.phone ?? g.email ?? "—"}</div>
                                </div>
                                {g.isFlagged && <span className="gp-flag">⚠ Flagged</span>}
                              </div>
                            </td>
                            <td className="gp-td">
                              {g.tier
                                ? <span className="gp-tier" style={{ color, borderColor: color + "55", background: color + "18" }}><span className="gp-tier-dot" style={{ background: color }} />{g.tier.name}</span>
                                : <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>—</span>
                              }
                            </td>
                            <td className="gp-td">
                              <span className="gp-status" style={{ color: rsvp.color, background: rsvp.bg, borderColor: rsvp.color + "44" }}>{rsvp.label}</span>
                              {g.rsvpAt && <div style={{ fontSize: "0.65rem", color: "var(--text-3)", marginTop: "0.2rem" }}>{fmtDate(g.rsvpAt)}</div>}
                            </td>
                            <td className="gp-td">
                              <div className="gp-checkin">
                                <div className="gp-checkin-dot" style={{ background: g.checkedIn ? "#22c55e" : "var(--border)" }} />
                                <span style={{ color: g.checkedIn ? "#22c55e" : "var(--text-3)", fontSize: "0.75rem" }}>
                                  {g.checkedIn ? `In · ${fmtTime(g.checkedInAt)}` : "Not yet"}
                                </span>
                              </div>
                            </td>
                            <td className="gp-td">
                              {g.inviteSentAt
                                ? <span style={{ fontSize: "0.72rem", color: "#22c55e" }}>✓ {fmtDate(g.inviteSentAt)}</span>
                                : <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>Not sent</span>
                              }
                            </td>
                            <td className="gp-td">
                              <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>{g.tableNumber ?? "—"}</span>
                            </td>
                            <td className="gp-td">
                              <button className="gp-btn gp-btn-danger" onClick={() => handleDelete(g.id, fullName)} disabled={deletingId === g.id}>
                                {deletingId === g.id ? "…" : "Remove"}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══ ADD MANUALLY ══ */}
        {activeTab === "add" && (
          <div className="gp-form-card">
            <div className="gp-form-title">Add Guest Manually</div>
            <div className="gp-row2">
              <div className="gp-field">
                <label className="gp-label">First Name <span className="gp-req">*</span></label>
                <input className="gp-input" placeholder="e.g. Tunde" value={addForm.firstName} onChange={e => setAddForm(p => ({ ...p, firstName: e.target.value }))} />
              </div>
              <div className="gp-field">
                <label className="gp-label">Last Name <span className="gp-req">*</span></label>
                <input className="gp-input" placeholder="e.g. Adeyemi" value={addForm.lastName} onChange={e => setAddForm(p => ({ ...p, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="gp-field">
              <label className="gp-label">Phone Number</label>
              <input className="gp-input" placeholder="e.g. 08012345678" value={addForm.phone} onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))} />
              <span className="gp-hint">Required to send a WhatsApp invite.</span>
            </div>
            {event.guestTiers.length > 0 && (
              <div className="gp-field">
                <label className="gp-label">Guest Tier</label>
                <select className="gp-sel" value={addForm.tierId} onChange={e => setAddForm(p => ({ ...p, tierId: e.target.value }))}>
                  <option value="">No tier assigned</option>
                  {event.guestTiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            {addError && <div className="gp-form-error">{addError}</div>}
            <div className="gp-form-actions">
              <button className="gp-btn gp-btn-gold" onClick={handleAdd} disabled={adding}>{adding ? "Adding…" : "Add Guest"}</button>
              <button className="gp-btn gp-btn-ghost" onClick={() => setActiveTab("list")}>Cancel</button>
            </div>
          </div>
        )}

        {/* ══ IMPORT ══ */}
        {activeTab === "import" && (
          <div>
            <div className="gp-import-tabs">
              <button className={`gp-itab${importType === "csv" ? " on" : ""}`} onClick={() => setImportType("csv")}>📄 CSV Upload</button>
              <button className={`gp-itab${importType === "sheets" ? " on" : ""}`} onClick={() => setImportType("sheets")}>📊 Google Sheets Sync</button>
            </div>

            {importType === "csv" && (
              <div className="gp-form-card" style={{ maxWidth: "100%" }}>
                <div className="gp-form-title">Import from CSV</div>
                <div className="gp-info-box">
                  <strong>Required columns:</strong> First Name, Last Name<br />
                  <strong>Optional column:</strong> Phone<br />
                  Column headers are flexible — the system auto-detects them.<br />
                  Maximum 200 guests per import.
                </div>
                {!csvPreview.length ? (
                  <div className="gp-upload-zone" onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("drag") }}
                    onDragLeave={e => e.currentTarget.classList.remove("drag")}
                    onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove("drag"); const f = e.dataTransfer.files[0]; if (f) handleCsvFile(f) }}>
                    <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleCsvFile(f) }} />
                    <div style={{ fontSize: "2rem", marginBottom: "0.75rem", opacity: 0.5 }}>📄</div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-2)", marginBottom: "0.3rem" }}>Drop your CSV file here, or click to browse</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>.csv files only</div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-2)", marginBottom: "0.5rem" }}>
                      <strong style={{ color: "var(--gold)" }}>{csvPreview.length}</strong> guests ready to import
                      {csvFile && <span style={{ color: "var(--text-3)", marginLeft: "0.5rem" }}>from {csvFile.name}</span>}
                    </div>
                    <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "5px" }}>
                      <table className="gp-preview-table">
                        <thead><tr><th>First Name</th><th>Last Name</th><th>Phone</th></tr></thead>
                        <tbody>
                          {csvPreview.slice(0, 10).map((r, i) => <tr key={i}><td>{r.firstName}</td><td>{r.lastName}</td><td>{r.phone || "—"}</td></tr>)}
                          {csvPreview.length > 10 && <tr><td colSpan={3} style={{ color: "var(--text-3)", fontStyle: "italic" }}>+ {csvPreview.length - 10} more rows…</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <div className="gp-form-actions" style={{ marginTop: "1rem" }}>
                      <button className="gp-btn gp-btn-gold" onClick={handleCsvImport} disabled={importing}>{importing ? "Importing…" : `Import ${csvPreview.length} Guests`}</button>
                      <button className="gp-btn gp-btn-ghost" onClick={() => { setCsvPreview([]); setCsvFile(null) }}>Cancel</button>
                    </div>
                  </>
                )}
                {csvError && <div className="gp-form-error" style={{ marginTop: "0.875rem" }}>{csvError}</div>}
              </div>
            )}

            {importType === "sheets" && (
              <div className="gp-form-card" style={{ maxWidth: "100%" }}>
                <div className="gp-form-title">Google Sheets Live Sync</div>
                <div className="gp-info-box">
                  <strong>How it works:</strong><br />
                  1. Open your Google Sheet and click <strong>Share → Anyone with the link → Viewer</strong><br />
                  2. Copy the link and paste it below.<br />
                  3. The system pulls in all names automatically.<br />
                  4. Re-sync at any time to pick up new additions.<br /><br />
                  <strong>Required columns:</strong> First Name, Last Name &nbsp;·&nbsp; <strong>Optional:</strong> Phone
                </div>
                <div className="gp-field">
                  <label className="gp-label">Google Sheets Link</label>
                  <input className="gp-sheets-input" placeholder="https://docs.google.com/spreadsheets/d/…" value={sheetsUrl} onChange={e => setSheetsUrl(e.target.value)} />
                </div>
                {sheetsError && <div className="gp-form-error">{sheetsError}</div>}
                <div className="gp-form-actions">
                  <button className="gp-btn gp-btn-gold" onClick={handleSheetsSync} disabled={importing}>{importing ? "Syncing…" : "Sync Sheet"}</button>
                </div>
                <div style={{ marginTop: "1.25rem", padding: "0.875rem 1rem", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: "5px" }}>
                  <div style={{ fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gold)", marginBottom: "0.5rem" }}>Auto-sync</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-3)", lineHeight: 1.6 }}>
                    Once synced, EventFlow checks your sheet every 30 minutes and adds any new rows automatically. Guests already imported are not duplicated.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* WhatsApp Setup Modal */}
      {showWAModal && (
        <WhatsAppSetupModal
          onConnected={() => {
            setWaConnected(true)
            setShowWAModal(false)
          }}
          onClose={() => setShowWAModal(false)}
        />
      )}
    </>
  )
}
