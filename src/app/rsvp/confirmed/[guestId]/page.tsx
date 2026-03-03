"use client"
// src/app/rsvp/confirmed/[guestId]/page.tsx
// Shows QR code after successful RSVP
// QR rendered client-side via qrcode library

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"

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
    meals:       { menuItem: { name: string; category: string } }[]
  }
  event: {
    id:             string
    name:           string
    eventDate:      string
    startTime:      string | null
    venueName:      string | null
    venueAddress:   string | null
    invitationCard: string | null
    brandColor:     string | null
    slug:           string
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

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/rsvp/confirmed/${guestId}`)
        if (!res.ok) { setError("Could not load your confirmation"); return }
        const d = await res.json()
        setData(d)
      } catch { setError("Failed to load") }
      finally { setLoading(false) }
    }
    load()
  }, [guestId])

  // Render QR code onto canvas once data loads
  useEffect(() => {
    if (!data || !canvasRef.current) return
    const renderQr = async () => {
      try {
        // Dynamically import qrcode to keep bundle lean
        const QRCode = (await import("qrcode")).default
        await QRCode.toCanvas(canvasRef.current, data.guest.qrCode, {
          width:  240,
          margin: 2,
          color:  { dark: "#0a0a0a", light: "#ffffff" },
        })
      } catch (e) {
        console.error("QR render error:", e)
      }
    }
    renderQr()
  }, [data])

  const handleSendWhatsApp = async () => {
    if (!data?.guest.phone) { setSendErr("No phone number on file to send via WhatsApp."); return }
    setSending("whatsapp"); setSendErr("")
    try {
      const res = await fetch("/api/rsvp/send-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId, channel: "whatsapp" }),
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId, channel: "email" }),
      })
      if (!res.ok) { const d = await res.json(); setSendErr(d.error ?? "Failed to send"); return }
      setSent("email")
    } catch { setSendErr("Failed to send") }
    finally { setSending(null) }
  }

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
  const gold = event.brandColor ?? "#b48c3c"
  const eventDate = new Date(event.eventDate).toLocaleDateString("en-NG", {
    weekday:"long", year:"numeric", month:"long", day:"numeric",
  })
  const isDeclined = guest.rsvpStatus === "DECLINED"

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#0a0a0a;color:#f0ece4;font-family:'DM Sans',sans-serif}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
      `}</style>

      <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", padding:"0 0 4rem" }}>

        {/* Cover */}
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
          <div style={{ fontSize:"0.78rem", color:"rgba(240,236,228,0.45)", marginBottom:"0.25rem" }}>📅 {eventDate}{event.startTime && ` · ${event.startTime}`}</div>
          {event.venueName && <div style={{ fontSize:"0.78rem", color:"rgba(240,236,228,0.45)", marginBottom:"1.25rem" }}>📍 {event.venueName}{event.venueAddress ? `, ${event.venueAddress}` : ""}</div>}

          {!isDeclined && (
            <>
              {/* Guest details */}
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

              {/* Meal selections */}
              {guest.meals?.length > 0 && (
                <div style={{ background:"#111", border:"1px solid rgba(180,140,60,0.15)", borderRadius:6, padding:"0.875rem", marginBottom:"1.25rem" }}>
                  <div style={{ fontSize:"0.58rem", fontWeight:500, letterSpacing:"0.15em", textTransform:"uppercase", color:gold, marginBottom:"0.625rem" }}>Your Meal Selections</div>
                  {guest.meals.map((m, i) => (
                    <div key={i} style={{ fontSize:"0.78rem", color:"rgba(240,236,228,0.7)", padding:"0.25rem 0", borderBottom:i < guest.meals.length - 1 ? "1px solid rgba(180,140,60,0.08)" : "none" }}>
                      {m.menuItem.name}
                    </div>
                  ))}
                </div>
              )}

              {/* QR Code */}
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

              {/* Send QR options */}
              <div style={{ background:"#111", border:"1px solid rgba(180,140,60,0.15)", borderRadius:8, padding:"1rem", marginBottom:"1rem" }}>
                <div style={{ fontSize:"0.65rem", fontWeight:500, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(240,236,228,0.4)", marginBottom:"0.875rem" }}>
                  Send QR to yourself
                </div>
                <div style={{ display:"flex", gap:"0.625rem", flexWrap:"wrap" }}>
                  <button
                    onClick={handleSendWhatsApp}
                    disabled={!!sending || sent === "whatsapp" || !guest.phone}
                    style={{
                      flex:1, minWidth:120, padding:"0.625rem 1rem",
                      background: sent === "whatsapp" ? "rgba(34,197,94,0.12)" : "rgba(37,211,102,0.1)",
                      border: `1px solid ${sent === "whatsapp" ? "rgba(34,197,94,0.5)" : "rgba(37,211,102,0.3)"}`,
                      color: sent === "whatsapp" ? "#22c55e" : "#25d366",
                      borderRadius:5, cursor: guest.phone ? "pointer" : "not-allowed",
                      fontFamily:"'DM Sans',sans-serif", fontSize:"0.78rem", fontWeight:500,
                      opacity: !guest.phone ? 0.4 : 1,
                      transition:"all 0.2s",
                    }}
                  >
                    {sent === "whatsapp" ? "✓ Sent!" : sending === "whatsapp" ? "Sending…" : "📲 WhatsApp"}
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={!!sending || sent === "email" || !guest.email}
                    style={{
                      flex:1, minWidth:120, padding:"0.625rem 1rem",
                      background: sent === "email" ? "rgba(34,197,94,0.12)" : "rgba(180,140,60,0.08)",
                      border: `1px solid ${sent === "email" ? "rgba(34,197,94,0.5)" : "rgba(180,140,60,0.25)"}`,
                      color: sent === "email" ? "#22c55e" : gold,
                      borderRadius:5, cursor: guest.email ? "pointer" : "not-allowed",
                      fontFamily:"'DM Sans',sans-serif", fontSize:"0.78rem", fontWeight:500,
                      opacity: !guest.email ? 0.4 : 1,
                      transition:"all 0.2s",
                    }}
                  >
                    {sent === "email" ? "✓ Sent!" : sending === "email" ? "Sending…" : "✉ Email"}
                  </button>
                </div>
                {!guest.phone && !guest.email && (
                  <p style={{ fontSize:"0.7rem", color:"rgba(240,236,228,0.3)", marginTop:"0.5rem" }}>Screenshot this page to save your QR code.</p>
                )}
                {sendErr && <p style={{ fontSize:"0.72rem", color:"#ef4444", marginTop:"0.5rem" }}>{sendErr}</p>}
              </div>
            </>
          )}

          <p style={{ fontSize:"0.65rem", color:"rgba(240,236,228,0.2)", textAlign:"center", marginTop:"2rem" }}>Powered by EventFlow</p>
        </div>
      </div>
    </>
  )
}
