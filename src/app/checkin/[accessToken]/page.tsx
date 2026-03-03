"use client"
// src/app/checkin/[accessToken]/page.tsx
// Usher gate scanner — mobile first
// Persistent check-in history with meal details

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"

interface UsherInfo {
  id:    string
  name:  string
  role:  "MAIN" | "FLOOR"
  event: {
    id:   string
    name: string
    eventDate: string
    venueName: string | null
    brandColor: string | null
  }
}

interface CheckInResult {
  success:    boolean
  guest?: {
    id:          string
    firstName:   string
    lastName:    string
    phone:       string | null
    rsvpStatus:  string
    tableNumber: string | null
    tier:        { name: string; color: string | null } | null
    meals:       { menuItem: { name: string; category: string } }[]
    isFlagged:   boolean
    flagReason:  string | null
    checkedIn:   boolean
    checkedInAt: string | null
  }
  error?:  string
  code?:   string
}

interface HistoryEntry {
  guestId:     string
  firstName:   string
  lastName:    string
  tableNumber: string | null
  tier:        { name: string; color: string | null } | null
  meals:       { menuItem: { name: string; category: string } }[]
  isFlagged:   boolean
  checkedInAt: string
}

type Tab = "scan" | "history"

const CATEGORY_LABELS: Record<string, string> = {
  APPETIZER:"Starter", MAIN:"Main", DRINK:"Drink", DESSERT:"Dessert", SPECIAL:"Special",
}

export default function CheckinPage() {
  const { accessToken } = useParams<{ accessToken: string }>()

  const [usher,   setUsher]   = useState<UsherInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [tab,     setTab]     = useState<Tab>("scan")

  // Scanner state
  const [qrInput,    setQrInput]    = useState("")
  const [scanning,   setScanning]   = useState(false)
  const [lastResult, setLastResult] = useState<CheckInResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // History — persistent in memory (survives tab switch, not page reload)
  const [history, setHistory] = useState<HistoryEntry[]>([])

  const gold = usher?.event.brandColor ?? "#b48c3c"

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/checkin/usher?token=${accessToken}`)
        if (!res.ok) { const d = await res.json(); setError(d.error ?? "Invalid access"); return }
        const d = await res.json()
        setUsher(d.usher)
      } catch { setError("Failed to load") }
      finally { setLoading(false) }
    }
    load()
  }, [accessToken])

  // Auto-focus the QR input when on scan tab
  useEffect(() => {
    if (tab === "scan" && inputRef.current) {
      inputRef.current.focus()
    }
  }, [tab, lastResult])

  const handleScan = useCallback(async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed || !usher) return
    setScanning(true); setQrInput("")
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCode: trimmed, accessToken, eventId: usher.event.id }),
      })
      const d: CheckInResult = await res.json()
      setLastResult(d)

      // Add to persistent history if successful check-in
      if (d.success && d.guest) {
        setHistory(prev => [{
          guestId:     d.guest!.id,
          firstName:   d.guest!.firstName,
          lastName:    d.guest!.lastName,
          tableNumber: d.guest!.tableNumber,
          tier:        d.guest!.tier,
          meals:       d.guest!.meals,
          isFlagged:   d.guest!.isFlagged,
          checkedInAt: new Date().toISOString(),
        }, ...prev])
      }
    } catch {
      setLastResult({ success: false, error: "Scan failed — check connection" })
    } finally {
      setScanning(false)
    }
  }, [accessToken, usher])

  // Handle QR input — fires when QR scanner keyboard-injects a string + Enter
  const handleQrKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && qrInput.trim()) {
      handleScan(qrInput)
    }
  }

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#0a0a0a" }}>
      <div style={{ width:24, height:24, border:"2px solid rgba(180,140,60,0.2)", borderTopColor:"#b48c3c", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error || !usher) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#0a0a0a", padding:"2rem", textAlign:"center" }}>
      <div style={{ fontSize:"2rem", marginBottom:"1rem" }}>🚫</div>
      <h2 style={{ color:"#f0ece4", fontFamily:"Georgia,serif", fontWeight:300, marginBottom:"0.5rem" }}>Access Denied</h2>
      <p style={{ color:"rgba(240,236,228,0.4)", fontSize:"0.875rem" }}>{error ?? "Invalid usher link"}</p>
    </div>
  )

  const resultGuest = lastResult?.guest

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#0a0a0a;color:#f0ece4;font-family:'DM Sans',sans-serif}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
      `}</style>

      <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", maxWidth:480, margin:"0 auto" }}>

        {/* Header */}
        <div style={{ padding:"1rem 1.25rem 0.75rem", borderBottom:"1px solid rgba(180,140,60,0.12)", background:"#111" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:"0.58rem", fontWeight:500, letterSpacing:"0.15em", textTransform:"uppercase", color:gold, marginBottom:"0.2rem" }}>
                {usher.role === "MAIN" ? "Gate Scanner" : "Floor Usher"}
              </div>
              <div style={{ fontSize:"0.95rem", fontWeight:500, color:"#f0ece4" }}>{usher.event.name}</div>
              <div style={{ fontSize:"0.7rem", color:"rgba(240,236,228,0.4)", marginTop:"0.1rem" }}>{usher.name}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:"1.25rem", fontFamily:"Georgia,serif", fontWeight:300, color:gold }}>{history.length}</div>
              <div style={{ fontSize:"0.55rem", color:"rgba(240,236,228,0.35)", letterSpacing:"0.08em", textTransform:"uppercase" }}>checked in</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:"1px solid rgba(180,140,60,0.12)", background:"#111" }}>
          {(["scan","history"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex:1, padding:"0.75rem", background:"transparent", border:"none",
              borderBottom:`2px solid ${tab === t ? gold : "transparent"}`,
              color: tab === t ? gold : "rgba(240,236,228,0.4)",
              fontFamily:"'DM Sans',sans-serif", fontSize:"0.78rem", fontWeight:500,
              cursor:"pointer", letterSpacing:"0.04em", textTransform:"capitalize",
              transition:"all 0.2s",
            }}>
              {t === "history" ? `History (${history.length})` : "Scan"}
            </button>
          ))}
        </div>

        {/* ══ SCAN TAB ══ */}
        {tab === "scan" && (
          <div style={{ flex:1, padding:"1.25rem", display:"flex", flexDirection:"column", gap:"1rem" }}>

            {/* Hidden QR input — focused automatically */}
            {/* Physical QR scanners act as keyboard — inject text + Enter */}
            <div style={{ background:"#111", border:`1.5px dashed ${scanning ? gold : "rgba(180,140,60,0.25)"}`, borderRadius:10, padding:"1.75rem 1.25rem", textAlign:"center", cursor:"pointer" }}
              onClick={() => inputRef.current?.focus()}>
              <div style={{ fontSize:"2.5rem", marginBottom:"0.75rem", animation: scanning ? "pulse 0.8s ease infinite" : "none" }}>
                {scanning ? "⏳" : "📷"}
              </div>
              <div style={{ fontSize:"0.875rem", color:"rgba(240,236,228,0.6)", marginBottom:"0.5rem", fontWeight:500 }}>
                {scanning ? "Processing…" : "Ready to scan"}
              </div>
              <div style={{ fontSize:"0.72rem", color:"rgba(240,236,228,0.3)" }}>
                {scanning ? "" : "Tap here then scan QR code"}
              </div>
              <input
                ref={inputRef}
                value={qrInput}
                onChange={e => setQrInput(e.target.value)}
                onKeyDown={handleQrKeyDown}
                style={{ position:"absolute", opacity:0, width:1, height:1, pointerEvents:"none" }}
                autoComplete="off"
                autoCorrect="off"
              />
            </div>

            {/* Manual entry fallback */}
            <div style={{ display:"flex", gap:"0.5rem" }}>
              <input
                placeholder="Or type QR code manually…"
                value={qrInput}
                onChange={e => setQrInput(e.target.value)}
                onKeyDown={handleQrKeyDown}
                style={{
                  flex:1, padding:"0.625rem 0.875rem", background:"#1a1a1a",
                  border:"1px solid rgba(180,140,60,0.2)", color:"#f0ece4",
                  borderRadius:5, fontFamily:"'DM Sans',sans-serif", fontSize:"0.8rem", outline:"none",
                }}
              />
              <button onClick={() => handleScan(qrInput)} disabled={!qrInput.trim() || scanning}
                style={{ padding:"0.625rem 1rem", background:gold, border:"none", color:"#0a0a0a", borderRadius:5, fontWeight:500, cursor:"pointer", fontSize:"0.78rem", opacity: !qrInput.trim() ? 0.4 : 1 }}>
                Check in
              </button>
            </div>

            {/* Result card */}
            {lastResult && (
              <div key={Date.now()} style={{
                background:"#111", border:`1.5px solid ${lastResult.success && !resultGuest?.isFlagged ? "rgba(34,197,94,0.35)" : lastResult.success && resultGuest?.isFlagged ? "rgba(239,68,68,0.35)" : "rgba(239,68,68,0.25)"}`,
                borderRadius:10, padding:"1.25rem", animation:"slideUp 0.25s ease",
              }}>
                {lastResult.success && resultGuest ? (
                  <>
                    <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"1rem" }}>
                      <div style={{
                        width:42, height:42, borderRadius:"50%",
                        background:`${resultGuest.tier?.color ?? gold}22`,
                        border:`2px solid ${resultGuest.isFlagged ? "#ef4444" : resultGuest.tier?.color ?? gold}55`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:"0.85rem", fontWeight:600, color:resultGuest.tier?.color ?? gold, flexShrink:0,
                      }}>
                        {resultGuest.firstName[0]}{resultGuest.lastName[0]}
                      </div>
                      <div>
                        <div style={{ fontSize:"1rem", fontWeight:500, color:"#f0ece4", display:"flex", alignItems:"center", gap:"0.5rem" }}>
                          {resultGuest.firstName} {resultGuest.lastName}
                          {resultGuest.isFlagged && <span style={{ fontSize:"0.6rem", padding:"0.15rem 0.4rem", borderRadius:99, background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.35)", color:"#ef4444" }}>⚠ FLAG</span>}
                        </div>
                        <div style={{ fontSize:"0.7rem", color:"rgba(240,236,228,0.4)", marginTop:"0.1rem" }}>
                          {resultGuest.isFlagged ? resultGuest.flagReason ?? "Flagged entry" : "✓ Check-in successful"}
                        </div>
                      </div>
                    </div>

                    {/* Guest details */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem", marginBottom: resultGuest.meals?.length ? "0.875rem" : 0 }}>
                      {resultGuest.tier && (
                        <div style={{ padding:"0.5rem 0.625rem", background:"rgba(180,140,60,0.06)", borderRadius:5 }}>
                          <div style={{ fontSize:"0.55rem", color:"rgba(240,236,228,0.35)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"0.15rem" }}>Tier</div>
                          <div style={{ fontSize:"0.78rem", color:resultGuest.tier.color ?? gold, fontWeight:500 }}>{resultGuest.tier.name}</div>
                        </div>
                      )}
                      {resultGuest.tableNumber && (
                        <div style={{ padding:"0.5rem 0.625rem", background:"rgba(180,140,60,0.06)", borderRadius:5 }}>
                          <div style={{ fontSize:"0.55rem", color:"rgba(240,236,228,0.35)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"0.15rem" }}>Table</div>
                          <div style={{ fontSize:"0.78rem", color:"#f0ece4", fontWeight:500 }}>Table {resultGuest.tableNumber}</div>
                        </div>
                      )}
                    </div>

                    {/* Meal selections */}
                    {resultGuest.meals?.length > 0 && (
                      <div style={{ background:"rgba(180,140,60,0.05)", borderRadius:6, padding:"0.625rem 0.75rem" }}>
                        <div style={{ fontSize:"0.55rem", color:"rgba(240,236,228,0.35)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"0.375rem" }}>Meal Selections</div>
                        {resultGuest.meals.map((m, i) => (
                          <div key={i} style={{ fontSize:"0.75rem", color:"rgba(240,236,228,0.65)", padding:"0.15rem 0", display:"flex", alignItems:"center", gap:"0.375rem" }}>
                            <span style={{ fontSize:"0.6rem", color:"rgba(180,140,60,0.6)" }}>{CATEGORY_LABELS[m.menuItem.category] ?? m.menuItem.category}</span>
                            <span>{m.menuItem.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
                    <div style={{ fontSize:"1.5rem" }}>❌</div>
                    <div>
                      <div style={{ fontSize:"0.875rem", fontWeight:500, color:"#ef4444", marginBottom:"0.15rem" }}>
                        {lastResult.code === "ALREADY_CHECKED_IN" ? "Already checked in" :
                         lastResult.code === "NOT_CONFIRMED"      ? "RSVP not confirmed" :
                         lastResult.code === "INVALID_QR"         ? "Invalid QR code" : "Check-in failed"}
                      </div>
                      <div style={{ fontSize:"0.72rem", color:"rgba(240,236,228,0.4)" }}>{lastResult.error}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ HISTORY TAB ══ */}
        {tab === "history" && (
          <div style={{ flex:1, overflowY:"auto" }}>
            {history.length === 0 ? (
              <div style={{ padding:"3rem 1.5rem", textAlign:"center" }}>
                <div style={{ fontSize:"2rem", marginBottom:"0.875rem", opacity:0.3 }}>📋</div>
                <div style={{ fontSize:"0.875rem", color:"rgba(240,236,228,0.4)" }}>No check-ins yet</div>
                <div style={{ fontSize:"0.75rem", color:"rgba(240,236,228,0.25)", marginTop:"0.375rem" }}>Checked-in guests will appear here</div>
              </div>
            ) : (
              history.map((entry, i) => (
                <div key={entry.guestId + i} style={{
                  padding:"0.875rem 1.25rem", borderBottom:"1px solid rgba(180,140,60,0.08)",
                  display:"flex", alignItems:"flex-start", gap:"0.75rem",
                }}>
                  <div style={{
                    width:36, height:36, borderRadius:"50%",
                    background:`${entry.tier?.color ?? gold}18`,
                    border:`1.5px solid ${entry.isFlagged ? "#ef4444" : entry.tier?.color ?? gold}44`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:"0.7rem", fontWeight:600, color:entry.tier?.color ?? gold, flexShrink:0,
                  }}>
                    {entry.firstName[0]}{entry.lastName[0]}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"0.375rem", marginBottom:"0.15rem" }}>
                      <span style={{ fontSize:"0.825rem", fontWeight:500, color:"#f0ece4" }}>{entry.firstName} {entry.lastName}</span>
                      {entry.isFlagged && <span style={{ fontSize:"0.55rem", padding:"0.1rem 0.3rem", borderRadius:99, background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)", color:"#ef4444" }}>⚠</span>}
                    </div>
                    <div style={{ fontSize:"0.68rem", color:"rgba(240,236,228,0.35)", marginBottom:"0.25rem" }}>
                      {entry.tier?.name ?? "No tier"}{entry.tableNumber ? ` · Table ${entry.tableNumber}` : ""}
                      {" · "}{new Date(entry.checkedInAt).toLocaleTimeString("en-NG", { hour:"2-digit", minute:"2-digit" })}
                    </div>
                    {entry.meals?.length > 0 && (
                      <div style={{ display:"flex", gap:"0.25rem", flexWrap:"wrap" }}>
                        {entry.meals.map((m, j) => (
                          <span key={j} style={{ fontSize:"0.6rem", padding:"0.1rem 0.4rem", borderRadius:99, background:"rgba(180,140,60,0.08)", border:"1px solid rgba(180,140,60,0.15)", color:"rgba(240,236,228,0.5)" }}>
                            {m.menuItem.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  )
}
