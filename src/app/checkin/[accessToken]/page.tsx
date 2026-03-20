"use client"
// src/app/checkin/[accessToken]/page.tsx
// Usher gate scanner — mobile first
// Persistent check-in history with meal details
//
// CHANGE: Camera scan button now launches the device
// camera using html5-qrcode. Decodes QR in real time
// and fires the check-in API automatically on success.
// Physical QR scanner (keyboard inject) still works too.
//
// Install: npm install html5-qrcode

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"

interface UsherInfo {
  id:    string
  name:  string
  role:  "MAIN" | "FLOOR"
  event: {
    id:         string
    name:       string
    eventDate:  string
    venueName:  string | null
    brandColor: string | null
  }
}

interface CheckInResult {
  success: boolean
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
  error?: string
  code?:  string
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

// Unique DOM id for the html5-qrcode scanner element
const SCANNER_ELEMENT_ID = "ef-qr-scanner"

export default function CheckinPage() {
  const { accessToken } = useParams<{ accessToken: string }>()

  const [usher,   setUsher]   = useState<UsherInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [tab,     setTab]     = useState<Tab>("scan")

  // Manual / physical scanner input
  const [qrInput,  setQrInput]  = useState("")
  const [scanning, setScanning] = useState(false)
  const [lastResult, setLastResult] = useState<CheckInResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Camera scanner state
  const [cameraActive,  setCameraActive]  = useState(false)
  const [cameraError,   setCameraError]   = useState<string | null>(null)
  // Prevent double-scan while one is in flight
  const scanInFlight = useRef(false)
  // html5-qrcode instance ref
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html5QrRef = useRef<any>(null)

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

  // Auto-focus the manual input when on scan tab and camera is off
  useEffect(() => {
    if (tab === "scan" && !cameraActive && inputRef.current) {
      inputRef.current.focus()
    }
  }, [tab, lastResult, cameraActive])

  // ── Cleanup camera on unmount or tab switch ─────────────────
  useEffect(() => {
    return () => {
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Stop camera if user switches away from scan tab
    if (tab !== "scan") {
      stopCamera()
    }
  }, [tab])

  // ── Core check-in handler ────────────────────────────────────

  const handleScan = useCallback(async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed || !usher) return
    setScanning(true); setQrInput("")
    try {
      const res = await fetch("/api/checkin", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ qrCode: trimmed, accessToken, eventId: usher.event.id }),
      })
      const d: CheckInResult = await res.json()
      setLastResult(d)

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

  // ── Camera scanner ──────────────────────────────────────────

  const startCamera = async () => {
    setCameraError(null)
    setCameraActive(true)
    scanInFlight.current = false

    try {
      // Dynamically import to avoid SSR issues
      const { Html5Qrcode } = await import("html5-qrcode")

      // Small delay to let React render the scanner div first
      await new Promise(r => setTimeout(r, 120))

      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID)
      html5QrRef.current = scanner

      await scanner.start(
        // Use environment-facing camera (back camera on phones)
        { facingMode: "environment" },
        {
          fps:            10,   // Scans per second
          qrbox:          { width: 240, height: 240 },
          aspectRatio:    1.0,
          disableFlip:    false,
        },
        // Success callback — fires when QR is decoded
        async (decodedText: string) => {
          // Prevent duplicate scans while one is in flight
          if (scanInFlight.current) return
          scanInFlight.current = true

          // Pause scanning while we process
          try { await scanner.pause(true) } catch { /* ignore */ }

          await handleScan(decodedText)

          // Resume after 2s to allow usher to read the result
          setTimeout(async () => {
            scanInFlight.current = false
            try {
              if (html5QrRef.current) await html5QrRef.current.resume()
            } catch { /* scanner may have been stopped */ }
          }, 2000)
        },
        // Error callback — fires on every failed frame (normal, ignore)
        () => {},
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)

      // Common error: user denied camera permission
      if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("notallowed")) {
        setCameraError("Camera permission denied. Please allow camera access in your browser settings and try again.")
      } else if (msg.toLowerCase().includes("notfound") || msg.toLowerCase().includes("no camera")) {
        setCameraError("No camera found on this device.")
      } else {
        setCameraError(`Camera error: ${msg}`)
      }

      setCameraActive(false)
      html5QrRef.current = null
    }
  }

  const stopCamera = async () => {
    if (html5QrRef.current) {
      try {
        await html5QrRef.current.stop()
        html5QrRef.current.clear()
      } catch { /* already stopped */ }
      html5QrRef.current = null
    }
    setCameraActive(false)
    scanInFlight.current = false
  }

  // ── Physical QR scanner (keyboard inject) ───────────────────

  const handleQrKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && qrInput.trim()) {
      handleScan(qrInput)
    }
  }

  // ── Loading / error screens ──────────────────────────────────

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

        /* html5-qrcode overrides — dark theme */
        #${SCANNER_ELEMENT_ID} video { border-radius: 10px; }
        #${SCANNER_ELEMENT_ID} img   { display: none !important; }
        #${SCANNER_ELEMENT_ID} > div:last-child { display: none !important; }
      `}</style>

      <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", maxWidth:480, margin:"0 auto" }}>

        {/* ── Header ── */}
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

        {/* ── Tabs ── */}
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

            {/* ── Camera scanner area ── */}
            {cameraActive ? (
              <div style={{ position:"relative" }}>
                {/* html5-qrcode mounts the video feed here */}
                <div
                  id={SCANNER_ELEMENT_ID}
                  style={{
                    width:"100%", borderRadius:10,
                    overflow:"hidden",
                    background:"#111",
                    border:`1.5px solid ${scanning ? gold : "rgba(180,140,60,0.4)"}`,
                    minHeight: 280,
                  }}
                />

                {/* Scanning status overlay */}
                {scanning && (
                  <div style={{
                    position:"absolute", bottom:12, left:"50%", transform:"translateX(-50%)",
                    background:"rgba(10,10,10,0.85)", padding:"0.375rem 0.875rem",
                    borderRadius:99, fontSize:"0.72rem", color:gold,
                    display:"flex", alignItems:"center", gap:"0.5rem",
                    backdropFilter:"blur(4px)",
                  }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:gold, animation:"pulse 0.8s ease infinite" }} />
                    Processing…
                  </div>
                )}

                {/* Stop camera button */}
                <button
                  onClick={stopCamera}
                  style={{
                    marginTop:"0.75rem", width:"100%",
                    padding:"0.625rem", background:"transparent",
                    border:"1px solid rgba(239,68,68,0.3)",
                    color:"rgba(239,68,68,0.7)",
                    borderRadius:5, fontFamily:"'DM Sans',sans-serif",
                    fontSize:"0.78rem", cursor:"pointer",
                  }}
                >
                  Stop camera
                </button>
              </div>
            ) : (
              /* ── Camera launch button ── */
              <div>
                <button
                  onClick={startCamera}
                  style={{
                    width:"100%",
                    background:"#111",
                    border:`1.5px dashed ${scanning ? gold : "rgba(180,140,60,0.3)"}`,
                    borderRadius:10,
                    padding:"2rem 1.25rem",
                    textAlign:"center",
                    cursor:"pointer",
                    display:"flex",
                    flexDirection:"column",
                    alignItems:"center",
                    gap:"0.625rem",
                    transition:"border-color 0.2s",
                  }}
                >
                  <span style={{ fontSize:"2.75rem", lineHeight:1 }}>📷</span>
                  <span style={{ fontSize:"0.9rem", fontWeight:500, color:"#f0ece4" }}>
                    Tap to launch camera
                  </span>
                  <span style={{ fontSize:"0.72rem", color:"rgba(240,236,228,0.35)" }}>
                    Points camera at guest QR code to check them in
                  </span>
                </button>

                {/* Camera error */}
                {cameraError && (
                  <div style={{
                    marginTop:"0.75rem", padding:"0.75rem",
                    background:"rgba(239,68,68,0.08)",
                    border:"1px solid rgba(239,68,68,0.2)",
                    borderRadius:6, fontSize:"0.75rem", color:"#ef4444", lineHeight:1.5,
                  }}>
                    {cameraError}
                  </div>
                )}
              </div>
            )}

            {/* ── Manual / physical scanner fallback ── */}
            <div>
              <div style={{ fontSize:"0.58rem", fontWeight:500, letterSpacing:"0.12em", textTransform:"uppercase", color:"rgba(240,236,228,0.3)", marginBottom:"0.5rem" }}>
                Or enter code manually
              </div>
              <div style={{ display:"flex", gap:"0.5rem" }}>
                <input
                  ref={inputRef}
                  placeholder="Type or scan QR code…"
                  value={qrInput}
                  onChange={e => setQrInput(e.target.value)}
                  onKeyDown={handleQrKeyDown}
                  style={{
                    flex:1, padding:"0.625rem 0.875rem", background:"#1a1a1a",
                    border:"1px solid rgba(180,140,60,0.2)", color:"#f0ece4",
                    borderRadius:5, fontFamily:"'DM Sans',sans-serif",
                    fontSize:"0.8rem", outline:"none",
                  }}
                />
                <button
                  onClick={() => handleScan(qrInput)}
                  disabled={!qrInput.trim() || scanning}
                  style={{
                    padding:"0.625rem 1rem", background:gold, border:"none",
                    color:"#0a0a0a", borderRadius:5, fontWeight:500,
                    cursor:"pointer", fontSize:"0.78rem",
                    opacity: !qrInput.trim() ? 0.4 : 1,
                  }}
                >
                  Check in
                </button>
              </div>
            </div>

            {/* ── Result card ── */}
            {lastResult && (
              <div
                key={JSON.stringify(lastResult)}
                style={{
                  background:"#111",
                  border:`1.5px solid ${
                    lastResult.success && !resultGuest?.isFlagged
                      ? "rgba(34,197,94,0.35)"
                      : lastResult.success && resultGuest?.isFlagged
                      ? "rgba(239,68,68,0.35)"
                      : "rgba(239,68,68,0.25)"
                  }`,
                  borderRadius:10, padding:"1.25rem", animation:"slideUp 0.25s ease",
                }}
              >
                {lastResult.success && resultGuest ? (
                  <>
                    <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"1rem" }}>
                      <div style={{
                        width:42, height:42, borderRadius:"50%",
                        background:`${resultGuest.tier?.color ?? gold}22`,
                        border:`2px solid ${resultGuest.isFlagged ? "#ef4444" : resultGuest.tier?.color ?? gold}55`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:"0.85rem", fontWeight:600,
                        color:resultGuest.tier?.color ?? gold, flexShrink:0,
                      }}>
                        {resultGuest.firstName[0]}{resultGuest.lastName[0]}
                      </div>
                      <div>
                        <div style={{ fontSize:"1rem", fontWeight:500, color:"#f0ece4", display:"flex", alignItems:"center", gap:"0.5rem" }}>
                          {resultGuest.firstName} {resultGuest.lastName}
                          {resultGuest.isFlagged && (
                            <span style={{ fontSize:"0.6rem", padding:"0.15rem 0.4rem", borderRadius:99, background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.35)", color:"#ef4444" }}>
                              ⚠ FLAG
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize:"0.7rem", color:"rgba(240,236,228,0.4)", marginTop:"0.1rem" }}>
                          {resultGuest.isFlagged
                            ? resultGuest.flagReason ?? "Flagged entry"
                            : "✓ Check-in successful"}
                        </div>
                      </div>
                    </div>

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
                        {lastResult.code === "ALREADY_CHECKED_IN" ? "Already checked in"
                          : lastResult.code === "NOT_CONFIRMED"   ? "RSVP not confirmed"
                          : lastResult.code === "INVALID_QR"      ? "Invalid QR code"
                          : "Check-in failed"}
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
                      {entry.isFlagged && (
                        <span style={{ fontSize:"0.55rem", padding:"0.1rem 0.3rem", borderRadius:99, background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)", color:"#ef4444" }}>⚠</span>
                      )}
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
