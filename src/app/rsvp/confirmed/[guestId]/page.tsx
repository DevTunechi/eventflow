"use client"
// src/app/rsvp/confirmed/[guestId]/page.tsx
//
// Changes vs previous version:
//   - Venue address shown with Google Maps directions link
//   - Meal edit button — inline form, only shown if RSVP not closed
//   - Tribute form — guest can leave a message for the celebrant
//   - Drinks shown as multi-select (up to 4) in edit form
//   - All other categories remain single-select in edit form

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"

const MAX_DRINKS = 4

const MENU_CATEGORY_ORDER  = ["APPETIZER", "MAIN", "DRINK", "DESSERT", "SPECIAL"]
const MENU_CATEGORY_LABELS: Record<string, string> = {
  APPETIZER: "Starters",
  MAIN:      "Main Course",
  DRINK:     "Drinks",
  DESSERT:   "Dessert",
  SPECIAL:   "Chef's Special",
}

interface ConfirmationData {
  guest: {
    id:          string
    firstName:   string
    lastName:    string
    qrCode:      string
    rsvpStatus:  string
    phone:       string | null
    email:       string | null
    tableNumber: string | null
    tier:        { name: string; color: string | null } | null
    meals:       { menuItem: { id: string; name: string; category: string } }[]
  }
  event: {
    id:             string
    name:           string
    eventDate:      string
    startTime:      string | null
    endTime:        string | null
    venueName:      string | null
    venueAddress:   string | null
    venueLat:       number | null
    venueLng:       number | null
    venueMapUrl:    string | null
    invitationCard: string | null
    brandColor:     string | null
    slug:           string
    rsvpDeadline:   string | null
    menuItems:      { id: string; name: string; description: string | null; category: string }[]
  }
}

export default function ConfirmedPage() {
  const { guestId } = useParams<{ guestId: string }>()
  const canvasRef   = useRef<HTMLCanvasElement>(null)

  const [data,    setData]    = useState<ConfirmationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [sending, setSending] = useState<"whatsapp" | "email" | null>(null)
  const [sent,    setSent]    = useState<"whatsapp" | "email" | null>(null)
  const [sendErr, setSendErr] = useState("")

  // ── Meal edit state ──────────────────────────────────────────
  const [editingMeals,    setEditingMeals]    = useState(false)
  const [mealSelections,  setMealSelections]  = useState<Record<string, string>>({})
  const [drinkSelections, setDrinkSelections] = useState<Set<string>>(new Set())
  const [savingMeals,     setSavingMeals]     = useState(false)
  const [mealSaveError,   setMealSaveError]   = useState("")
  const [mealSaveSuccess, setMealSaveSuccess] = useState(false)

  // ── Tribute state ────────────────────────────────────────────
  const [tributeMessage,  setTributeMessage]  = useState("")
  const [submitTribute,   setSubmitTribute]   = useState(false)
  const [tributeError,    setTributeError]    = useState("")
  const [tributeDone,     setTributeDone]     = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/rsvp/confirmed/${guestId}`)
        if (!res.ok) { setError("Could not load your confirmation"); return }
        const d = await res.json()
        setData(d)

        // Pre-populate meal edit form from existing selections
        const singleSelections: Record<string, string> = {}
        const drinks = new Set<string>()
        d.guest.meals.forEach((m: { menuItem: { id: string; category: string } }) => {
          if (m.menuItem.category === "DRINK") {
            drinks.add(m.menuItem.id)
          } else {
            singleSelections[m.menuItem.category] = m.menuItem.id
          }
        })
        setMealSelections(singleSelections)
        setDrinkSelections(drinks)
      } catch { setError("Failed to load") }
      finally { setLoading(false) }
    }
    load()
  }, [guestId])

  // Render QR code onto canvas
  useEffect(() => {
    if (!data || !canvasRef.current) return
    const renderQr = async () => {
      try {
        const QRCode = (await import("qrcode")).default
        await QRCode.toCanvas(canvasRef.current, data.guest.qrCode, {
          width:  240,
          margin: 2,
          color:  { dark: "#0a0a0a", light: "#ffffff" },
        })
      } catch (e) { console.error("QR render error:", e) }
    }
    renderQr()
  }, [data])

  // ── Send QR ──────────────────────────────────────────────────

  const handleSendWhatsApp = async () => {
    if (!data?.guest.phone) { setSendErr("No phone number on file to send via WhatsApp."); return }
    setSending("whatsapp"); setSendErr("")
    try {
      const res = await fetch("/api/rsvp/send-qr", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ guestId, channel: "whatsapp" }),
      })
      if (!res.ok) { const d = await res.json(); setSendErr(d.error ?? "Failed to send"); return }
      setSent("whatsapp")
    } catch { setSendErr("Failed to send") }
    finally { setSending(null) }
  }

  const handleSendEmail = async () => {
    if (!data?.guest.email) { setSendErr("No email address on file."); return }
    setSending("email"); setSendErr("")
    try {
      const res = await fetch("/api/rsvp/send-qr", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ guestId, channel: "email" }),
      })
      if (!res.ok) { const d = await res.json(); setSendErr(d.error ?? "Failed to send"); return }
      setSent("email")
    } catch { setSendErr("Failed to send") }
    finally { setSending(null) }
  }

  // ── Meal edit ────────────────────────────────────────────────

  const toggleDrink = (itemId: string) => {
    setDrinkSelections(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) { next.delete(itemId) }
      else if (next.size < MAX_DRINKS) { next.add(itemId) }
      return next
    })
  }

  const handleSaveMeals = async () => {
    setSavingMeals(true); setMealSaveError("")
    try {
      const meals = [
        ...Object.values(mealSelections).map(menuItemId => ({ menuItemId, quantity: 1 })),
        ...Array.from(drinkSelections).map(menuItemId => ({ menuItemId, quantity: 1 })),
      ]
      const res = await fetch(`/api/rsvp/guest/${guestId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ meals }),
      })
      const d = await res.json()
      if (!res.ok) { setMealSaveError(d.error ?? "Failed to save"); return }

      // Update local data with new meals
      setData(prev => prev ? { ...prev, guest: { ...prev.guest, meals: d.meals } } : prev)
      setMealSaveSuccess(true)
      setEditingMeals(false)
      setTimeout(() => setMealSaveSuccess(false), 3000)
    } catch { setMealSaveError("Network error. Please try again.") }
    finally { setSavingMeals(false) }
  }

  // ── Tribute ──────────────────────────────────────────────────

  const handleTributeSubmit = async () => {
    if (!tributeMessage.trim()) { setTributeError("Please write a message."); return }
    setSubmitTribute(true); setTributeError("")
    try {
      const res = await fetch(`/api/rsvp/guest/${guestId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: tributeMessage }),
      })
      const d = await res.json()
      if (!res.ok) { setTributeError(d.error ?? "Failed to submit"); return }
      setTributeDone(true)
    } catch { setTributeError("Network error. Please try again.") }
    finally { setSubmitTribute(false) }
  }

  // ── Loading / error ──────────────────────────────────────────

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#0a0a0a" }}>
      <div style={{ width:24, height:24, border:"2px solid rgba(180,140,60,0.2)", borderTopColor:"#b48c3c", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error || !data) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#0a0a0a", padding:"2rem", textAlign:"center" }}>
      <h2 style={{ color:"#f0ece4", fontFamily:"Georgia,serif", fontWeight:300, marginBottom:"0.5rem" }}>Something went wrong</h2>
      <p style={{ color:"rgba(240,236,228,0.4)", fontSize:"0.875rem" }}>{error}</p>
    </div>
  )

  const { guest, event } = data
  const gold       = event.brandColor ?? "#b48c3c"
  const isDeclined = guest.rsvpStatus === "DECLINED"

  const eventDate = new Date(event.eventDate).toLocaleDateString("en-NG", {
    weekday:"long", year:"numeric", month:"long", day:"numeric",
  })

  // Meal edit allowed if RSVP deadline hasn't passed (or no deadline set)
  const canEditMeals = !isDeclined &&
    event.menuItems.length > 0 &&
    (!event.rsvpDeadline || new Date() < new Date(event.rsvpDeadline))

  // Build the maps link — prefer stored venueMapUrl, fall back to coords, then address search
  const mapsUrl = event.venueMapUrl
    ?? (event.venueLat && event.venueLng
        ? `https://www.google.com/maps/dir/?api=1&destination=${event.venueLat},${event.venueLng}`
        : event.venueAddress
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venueAddress)}`
        : null)

  const menuByCategory = MENU_CATEGORY_ORDER.reduce((acc, cat) => {
    const items = event.menuItems?.filter(m => m.category === cat) ?? []
    if (items.length) acc[cat] = items
    return acc
  }, {} as Record<string, typeof event.menuItems>)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#0a0a0a;color:#f0ece4;font-family:'DM Sans',sans-serif}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}

        /* Meal edit form */
        .meal-edit-wrap{background:#111;border:1px solid rgba(180,140,60,0.2);border-radius:8px;padding:1.125rem;margin-bottom:1.25rem;animation:slideDown 0.2s ease}
        .meal-cat{margin-bottom:1.125rem}
        .meal-cat-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem}
        .meal-cat-title{font-size:0.58rem;font-weight:500;letter-spacing:0.15em;text-transform:uppercase;color:rgba(180,140,60,0.8)}
        .meal-item{display:flex;align-items:center;gap:0.75rem;padding:0.65rem 0.75rem;border:1.5px solid rgba(180,140,60,0.15);border-radius:5px;margin-bottom:0.35rem;cursor:pointer;transition:all 0.15s}
        .meal-item:hover:not(.disabled){border-color:rgba(180,140,60,0.3);background:rgba(180,140,60,0.04)}
        .meal-item.selected{border-color:#b48c3c;background:rgba(180,140,60,0.08)}
        .meal-item.disabled{opacity:0.4;cursor:not-allowed}
        .meal-radio{width:15px;height:15px;border-radius:50%;border:2px solid rgba(180,140,60,0.4);flex-shrink:0;display:flex;align-items:center;justify-content:center}
        .meal-radio.selected{border-color:#b48c3c;background:#b48c3c}
        .meal-radio.selected::after{content:'';width:5px;height:5px;border-radius:50%;background:#0a0a0a}
        .meal-checkbox{width:15px;height:15px;border-radius:3px;border:2px solid rgba(180,140,60,0.4);flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.15s}
        .meal-checkbox.selected{border-color:#b48c3c;background:#b48c3c}
        .meal-checkbox.selected::after{content:'✓';font-size:9px;color:#0a0a0a;font-weight:700;line-height:1}
        .drink-counter{font-size:0.62rem;padding:0.15rem 0.5rem;border-radius:99px;border:1px solid rgba(180,140,60,0.3);color:rgba(180,140,60,0.7)}
        .drink-counter.at-max{border-color:rgba(180,140,60,0.6);color:#b48c3c}
      `}</style>

      <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", padding:"0 0 4rem" }}>

        {/* Invitation card hero */}
        {event.invitationCard && (
          <div style={{ width:"100%", maxWidth:560, aspectRatio:"16/6", position:"relative", overflow:"hidden" }}>
            <Image src={event.invitationCard} alt={event.name} fill style={{ objectFit:"cover" }} unoptimized />
            <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, transparent 40%, #0a0a0a)" }} />
          </div>
        )}

        <div style={{ width:"100%", maxWidth:560, padding:"0 1.25rem", animation:"fadeUp 0.4s ease" }}>

          {/* Status banner */}
          <div style={{
            marginTop: event.invitationCard ? "-2rem" : "2rem",
            padding:"1rem", borderRadius:8,
            background: isDeclined ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)",
            border: `1px solid ${isDeclined ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.25)"}`,
            marginBottom:"1.5rem",
          }}>
            <div style={{ fontSize:"1.25rem", marginBottom:"0.25rem" }}>{isDeclined ? "😔" : "🎉"}</div>
            <div style={{ fontSize:"1.1rem", fontFamily:"Georgia,serif", fontWeight:300, color:"#f0ece4", marginBottom:"0.25rem" }}>
              {isDeclined ? "We'll miss you" : `See you there, ${guest.firstName}!`}
            </div>
            <div style={{ fontSize:"0.78rem", color: isDeclined ? "rgba(239,68,68,0.7)" : "rgba(34,197,94,0.7)" }}>
              {isDeclined ? "Your response has been recorded." : "Your RSVP is confirmed."}
            </div>
          </div>

          {/* Event details */}
          <h1 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(1.375rem,5vw,2rem)", fontWeight:300, color:"#f0ece4", marginBottom:"0.375rem", lineHeight:1.2 }}>
            {event.name}
          </h1>
          <div style={{ fontSize:"0.78rem", color:"rgba(240,236,228,0.45)", marginBottom:"0.25rem" }}>
            📅 {eventDate}{event.startTime && ` · ${event.startTime}`}{event.endTime && ` – ${event.endTime}`}
          </div>

          {/* ── Venue with maps link ── */}
          {(event.venueName || event.venueAddress) && (
            <div style={{ marginBottom:"1.25rem" }}>
              <div style={{ fontSize:"0.78rem", color:"rgba(240,236,228,0.45)", marginBottom:"0.375rem" }}>
                📍 {event.venueName}{event.venueAddress ? `, ${event.venueAddress}` : ""}
              </div>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display:"inline-flex", alignItems:"center", gap:"0.375rem",
                    fontSize:"0.72rem", color:gold,
                    padding:"0.35rem 0.75rem",
                    border:`1px solid ${gold}44`,
                    borderRadius:99,
                    textDecoration:"none",
                    background:`${gold}0d`,
                    transition:"background 0.2s",
                  }}
                >
                  🗺 Get directions
                </a>
              )}
            </div>
          )}

          {!isDeclined && (
            <>
              {/* Guest tier + table badges */}
              {(guest.tier || guest.tableNumber) && (
                <div style={{ display:"flex", gap:"0.625rem", marginBottom:"1.25rem", flexWrap:"wrap" }}>
                  {guest.tier && (
                    <span style={{ fontSize:"0.65rem", padding:"0.25rem 0.625rem", borderRadius:99, border:`1px solid ${guest.tier.color ?? gold}55`, background:`${guest.tier.color ?? gold}15`, color:guest.tier.color ?? gold, fontWeight:500, letterSpacing:"0.05em" }}>
                      {guest.tier.name}
                    </span>
                  )}
                  {guest.tableNumber && (
                    <span style={{ fontSize:"0.65rem", padding:"0.25rem 0.625rem", borderRadius:99, border:"1px solid rgba(180,140,60,0.3)", color:gold }}>
                      Table {guest.tableNumber}
                    </span>
                  )}
                </div>
              )}

              {/* ── Meal selections ── */}
              {guest.meals?.length > 0 && !editingMeals && (
                <div style={{ background:"#111", border:"1px solid rgba(180,140,60,0.15)", borderRadius:6, padding:"0.875rem", marginBottom:"1.25rem" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"0.625rem", gap:"0.5rem" }}>
                    <div style={{ fontSize:"0.58rem", fontWeight:500, letterSpacing:"0.15em", textTransform:"uppercase", color:gold }}>
                      Your Meal Selections
                    </div>
                    {canEditMeals && (
                      <button
                        onClick={() => { setEditingMeals(true); setMealSaveError("") }}
                        style={{ fontSize:"0.68rem", color:gold, background:"transparent", border:`1px solid ${gold}44`, borderRadius:99, padding:"0.2rem 0.625rem", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {guest.meals.map((m, i) => (
                    <div key={i} style={{ fontSize:"0.78rem", color:"rgba(240,236,228,0.7)", padding:"0.25rem 0", borderBottom:i < guest.meals.length - 1 ? "1px solid rgba(180,140,60,0.08)" : "none" }}>
                      {m.menuItem.name}
                      <span style={{ fontSize:"0.65rem", color:"rgba(240,236,228,0.3)", marginLeft:"0.5rem" }}>
                        {MENU_CATEGORY_LABELS[m.menuItem.category] ?? m.menuItem.category}
                      </span>
                    </div>
                  ))}
                  {mealSaveSuccess && (
                    <div style={{ fontSize:"0.72rem", color:"#22c55e", marginTop:"0.5rem" }}>✓ Meal selections updated</div>
                  )}
                </div>
              )}

              {/* No meals yet — show edit button if allowed */}
              {guest.meals?.length === 0 && canEditMeals && !editingMeals && (
                <div style={{ marginBottom:"1.25rem" }}>
                  <button
                    onClick={() => { setEditingMeals(true); setMealSaveError("") }}
                    style={{ width:"100%", padding:"0.75rem", background:"rgba(180,140,60,0.06)", border:`1px dashed ${gold}44`, borderRadius:6, color:gold, fontFamily:"'DM Sans',sans-serif", fontSize:"0.78rem", cursor:"pointer" }}
                  >
                    + Select your meals
                  </button>
                </div>
              )}

              {/* ── Meal edit form (inline) ── */}
              {editingMeals && (
                <div className="meal-edit-wrap">
                  <div style={{ fontSize:"0.58rem", fontWeight:500, letterSpacing:"0.15em", textTransform:"uppercase", color:gold, marginBottom:"1rem" }}>
                    Edit meal selections
                  </div>

                  {Object.entries(menuByCategory).map(([cat, items]) => {
                    const isDrink       = cat === "DRINK"
                    const selectedCount = drinkSelections.size
                    const atMax         = selectedCount >= MAX_DRINKS

                    return (
                      <div className="meal-cat" key={cat}>
                        <div className="meal-cat-header">
                          <div className="meal-cat-title">{MENU_CATEGORY_LABELS[cat] ?? cat}</div>
                          {isDrink && (
                            <div className={`drink-counter${atMax ? " at-max" : ""}`}>
                              {selectedCount} / {MAX_DRINKS}
                            </div>
                          )}
                        </div>

                        {items.map(item => {
                          const selected   = isDrink
                            ? drinkSelections.has(item.id)
                            : mealSelections[cat] === item.id
                          const isDisabled = isDrink && !selected && atMax

                          return (
                            <div
                              key={item.id}
                              className={`meal-item${selected ? " selected" : ""}${isDisabled ? " disabled" : ""}`}
                              onClick={() => {
                                if (isDisabled) return
                                if (isDrink) {
                                  toggleDrink(item.id)
                                } else {
                                  setMealSelections(prev => ({ ...prev, [cat]: item.id }))
                                }
                              }}
                            >
                              <div className={isDrink ? `meal-checkbox${selected ? " selected" : ""}` : `meal-radio${selected ? " selected" : ""}`} />
                              <div>
                                <div style={{ fontSize:"0.8rem", fontWeight:500, color: isDisabled ? "rgba(240,236,228,0.4)" : "#f0ece4" }}>
                                  {item.name}
                                </div>
                                {item.description && (
                                  <div style={{ fontSize:"0.7rem", color:"rgba(240,236,228,0.35)", marginTop:"0.1rem" }}>
                                    {item.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}

                  {mealSaveError && (
                    <div style={{ fontSize:"0.72rem", color:"#ef4444", marginBottom:"0.75rem", padding:"0.5rem 0.75rem", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:4 }}>
                      {mealSaveError}
                    </div>
                  )}

                  <div style={{ display:"flex", gap:"0.5rem" }}>
                    <button
                      onClick={handleSaveMeals}
                      disabled={savingMeals}
                      style={{ flex:1, padding:"0.7rem", background:gold, border:"none", color:"#0a0a0a", borderRadius:5, fontFamily:"'DM Sans',sans-serif", fontSize:"0.78rem", fontWeight:500, cursor:"pointer", opacity:savingMeals?0.5:1 }}
                    >
                      {savingMeals ? "Saving…" : "Save selections"}
                    </button>
                    <button
                      onClick={() => { setEditingMeals(false); setMealSaveError("") }}
                      style={{ padding:"0.7rem 1rem", background:"transparent", border:"1px solid rgba(180,140,60,0.2)", color:"rgba(240,236,228,0.5)", borderRadius:5, fontFamily:"'DM Sans',sans-serif", fontSize:"0.78rem", cursor:"pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* ── QR Code ── */}
              <div style={{ background:"#111", border:`1px solid rgba(180,140,60,0.2)`, borderRadius:8, padding:"1.5rem", textAlign:"center", marginBottom:"1.5rem" }}>
                <div style={{ fontSize:"0.58rem", fontWeight:500, letterSpacing:"0.2em", textTransform:"uppercase", color:gold, marginBottom:"1rem" }}>
                  Your Entry QR Code
                </div>
                <div style={{ display:"inline-block", padding:"12px", background:"#ffffff", borderRadius:6, marginBottom:"0.875rem" }}>
                  <canvas ref={canvasRef} style={{ display:"block" }} />
                </div>
                <p style={{ fontSize:"0.72rem", color:"rgba(240,236,228,0.35)", lineHeight:1.6 }}>
                  Present this QR code at the gate on arrival.<br />
                  <strong style={{ color:"rgba(240,236,228,0.5)" }}>Do not share this code with anyone.</strong>
                </p>
              </div>

              {/* ── Send QR ── */}
              <div style={{ background:"#111", border:"1px solid rgba(180,140,60,0.15)", borderRadius:8, padding:"1rem", marginBottom:"1.25rem" }}>
                <div style={{ fontSize:"0.65rem", fontWeight:500, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(240,236,228,0.4)", marginBottom:"0.875rem" }}>
                  Send QR to yourself
                </div>
                <div style={{ display:"flex", gap:"0.625rem", flexWrap:"wrap" }}>
                  <button
                    onClick={handleSendWhatsApp}
                    disabled={!!sending || sent === "whatsapp" || !guest.phone}
                    style={{ flex:1, minWidth:120, padding:"0.625rem 1rem", background:sent==="whatsapp"?"rgba(34,197,94,0.12)":"rgba(37,211,102,0.1)", border:`1px solid ${sent==="whatsapp"?"rgba(34,197,94,0.5)":"rgba(37,211,102,0.3)"}`, color:sent==="whatsapp"?"#22c55e":"#25d366", borderRadius:5, cursor:guest.phone?"pointer":"not-allowed", fontFamily:"'DM Sans',sans-serif", fontSize:"0.78rem", fontWeight:500, opacity:!guest.phone?0.4:1, transition:"all 0.2s" }}
                  >
                    {sent==="whatsapp" ? "✓ Sent!" : sending==="whatsapp" ? "Sending…" : "📲 WhatsApp"}
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={!!sending || sent === "email" || !guest.email}
                    style={{ flex:1, minWidth:120, padding:"0.625rem 1rem", background:sent==="email"?"rgba(34,197,94,0.12)":`rgba(180,140,60,0.08)`, border:`1px solid ${sent==="email"?"rgba(34,197,94,0.5)":`rgba(180,140,60,0.25)`}`, color:sent==="email"?"#22c55e":gold, borderRadius:5, cursor:guest.email?"pointer":"not-allowed", fontFamily:"'DM Sans',sans-serif", fontSize:"0.78rem", fontWeight:500, opacity:!guest.email?0.4:1, transition:"all 0.2s" }}
                  >
                    {sent==="email" ? "✓ Sent!" : sending==="email" ? "Sending…" : "✉ Email"}
                  </button>
                </div>
                {!guest.phone && !guest.email && (
                  <p style={{ fontSize:"0.7rem", color:"rgba(240,236,228,0.3)", marginTop:"0.5rem" }}>Screenshot this page to save your QR code.</p>
                )}
                {sendErr && <p style={{ fontSize:"0.72rem", color:"#ef4444", marginTop:"0.5rem" }}>{sendErr}</p>}
              </div>

              {/* ── Tribute form ── */}
              <div style={{ background:"#111", border:"1px solid rgba(180,140,60,0.15)", borderRadius:8, padding:"1rem", marginBottom:"1.25rem" }}>
                <div style={{ fontSize:"0.58rem", fontWeight:500, letterSpacing:"0.2em", textTransform:"uppercase", color:gold, marginBottom:"0.375rem" }}>
                  Leave a message
                </div>
                <p style={{ fontSize:"0.72rem", color:"rgba(240,236,228,0.35)", marginBottom:"0.875rem", lineHeight:1.6 }}>
                  Send a personal message or tribute to the celebrant. They'll see it on their day.
                </p>

                {tributeDone ? (
                  <div style={{ padding:"0.875rem", background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.2)", borderRadius:5, fontSize:"0.78rem", color:"#22c55e" }}>
                    ✓ Your message has been sent.
                    <button
                      onClick={() => setTributeDone(false)}
                      style={{ marginLeft:"0.75rem", fontSize:"0.68rem", color:"rgba(34,197,94,0.6)", background:"transparent", border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  <>
                    <textarea
                      value={tributeMessage}
                      onChange={e => setTributeMessage(e.target.value)}
                      maxLength={1000}
                      placeholder={`Write a message for the celebrant…`}
                      style={{ width:"100%", padding:"0.65rem 0.875rem", background:"#1a1a1a", border:"1px solid rgba(180,140,60,0.2)", color:"#f0ece4", fontFamily:"'DM Sans',sans-serif", fontSize:"0.82rem", outline:"none", borderRadius:5, resize:"vertical", minHeight:90, lineHeight:1.6, marginBottom:"0.625rem" }}
                    />
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.625rem" }}>
                      <span style={{ fontSize:"0.65rem", color:"rgba(240,236,228,0.25)" }}>{tributeMessage.length}/1000</span>
                    </div>
                    {tributeError && (
                      <p style={{ fontSize:"0.72rem", color:"#ef4444", marginBottom:"0.5rem" }}>{tributeError}</p>
                    )}
                    <button
                      onClick={handleTributeSubmit}
                      disabled={submitTribute || !tributeMessage.trim()}
                      style={{ width:"100%", padding:"0.75rem", background:gold, border:"none", color:"#0a0a0a", borderRadius:5, fontFamily:"'DM Sans',sans-serif", fontSize:"0.78rem", fontWeight:500, cursor:"pointer", opacity:!tributeMessage.trim()?0.4:1 }}
                    >
                      {submitTribute ? "Sending…" : "Send message"}
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          <p style={{ fontSize:"0.65rem", color:"rgba(240,236,228,0.2)", textAlign:"center", marginTop:"2rem" }}>Powered by EventFlow</p>
        </div>
      </div>
    </>
  )
}
