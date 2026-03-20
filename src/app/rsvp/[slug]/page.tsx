"use client"
// src/app/rsvp/[slug]/page.tsx
// Public RSVP page — open invite model
// Also handles closed model via ?invite=[token] query param
//
// CHANGE: Drinks category now uses multi-select checkboxes
// with a max of 4 selections. All other categories remain
// single-select radio buttons.

import { useState, useEffect } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"

interface EventData {
  id:             string
  name:           string
  slug:           string
  description:    string | null
  eventDate:      string
  startTime:      string | null
  venueName:      string | null
  venueAddress:   string | null
  invitationCard: string | null
  brandColor:     string | null
  inviteModel:    "OPEN" | "CLOSED"
  requireOtp:     boolean
  rsvpDeadline:   string | null
  status:         string
  guestTiers:     { id: string; name: string; menuAccess: string }[]
  menuItems:      { id: string; name: string; description: string | null; category: string }[]
}

interface PrefilledGuest {
  id:        string
  firstName: string
  lastName:  string
  phone:     string | null
  tierId:    string | null
  tierName:  string | null
}

type Step = "form" | "otp" | "meals" | "done"

const MENU_CATEGORY_ORDER  = ["APPETIZER", "MAIN", "DRINK", "DESSERT", "SPECIAL"]
const MENU_CATEGORY_LABELS: Record<string, string> = {
  APPETIZER: "Starters",
  MAIN:      "Main Course",
  DRINK:     "Drinks",
  DESSERT:   "Dessert",
  SPECIAL:   "Chef's Special",
}

// Max drinks a guest can select
const MAX_DRINKS = 4

export default function RSVPPage() {
  const params       = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const inviteToken  = searchParams.get("invite")

  const [event,     setEvent]     = useState<EventData | null>(null)
  const [prefilled, setPrefilled] = useState<PrefilledGuest | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const [step,    setStep]    = useState<Step>("form")
  const [guestId, setGuestId] = useState<string | null>(null)

  // Form fields
  const [firstName, setFirstName] = useState("")
  const [lastName,  setLastName]  = useState("")
  const [phone,     setPhone]     = useState("")
  const [email,     setEmail]     = useState("")
  const [tierId,    setTierId]    = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [rsvp,      setRsvp]      = useState<"CONFIRMED" | "DECLINED">("CONFIRMED")

  // OTP
  const [otp,          setOtp]          = useState("")
  const [otpError,     setOtpError]     = useState("")
  const [otpSending,   setOtpSending]   = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)

  // ── Meal selections ──────────────────────────────────────────
  // Single-select: category → menuItemId  (all non-drink categories)
  // Multi-select:  Set of menuItemIds     (drinks only, max 4)
  const [mealSelections,  setMealSelections]  = useState<Record<string, string>>({})
  const [drinkSelections, setDrinkSelections] = useState<Set<string>>(new Set())

  const [submitting, setSubmitting] = useState(false)
  const [formError,  setFormError]  = useState("")

  // Load event + prefilled guest data
  useEffect(() => {
    const load = async () => {
      try {
        const url = inviteToken
          ? `/api/rsvp?slug=${params.slug}&invite=${inviteToken}`
          : `/api/rsvp?slug=${params.slug}`
        const res = await fetch(url)
        if (!res.ok) {
          const d = await res.json()
          setError(d.error ?? "Event not found")
          return
        }
        const d = await res.json()
        setEvent(d.event)
        if (d.guest) {
          setPrefilled(d.guest)
          setFirstName(d.guest.firstName)
          setLastName(d.guest.lastName)
          setPhone(d.guest.phone ?? "")
          setTierId(d.guest.tierId ?? "")
        }
      } catch {
        setError("Failed to load event")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.slug, inviteToken])

  const gold = event?.brandColor ?? "#b48c3c"

  const guestTierData = event?.guestTiers.find(t => t.id === tierId)
  const needsMeals    = guestTierData?.menuAccess === "PRE_EVENT" && event?.menuItems && event.menuItems.length > 0

  // ── Drink toggle handler ─────────────────────────────────────
  const toggleDrink = (itemId: string) => {
    setDrinkSelections(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        // Always allow deselect
        next.delete(itemId)
      } else if (next.size < MAX_DRINKS) {
        // Only allow select if under max
        next.add(itemId)
      }
      return next
    })
  }

  // ── Form submission ──────────────────────────────────────────

  const handleSubmitForm = async () => {
    if (!firstName.trim() || !lastName.trim()) { setFormError("First and last name are required."); return }
    if (!phone.trim()) { setFormError("Phone number is required."); return }
    if (rsvp === "DECLINED") {
      await submitRsvp({ skipMeals: true })
      return
    }
    if (event?.requireOtp) {
      await sendOtp()
    } else if (needsMeals) {
      setStep("meals")
    } else {
      await submitRsvp({ skipMeals: true })
    }
  }

  const sendOtp = async () => {
    setOtpSending(true); setOtpError("")
    try {
      const res = await fetch("/api/rsvp/otp", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone }),
      })
      if (!res.ok) { const d = await res.json(); setOtpError(d.error ?? "Failed to send OTP"); return }
      setStep("otp")
    } catch { setOtpError("Failed to send OTP") }
    finally { setOtpSending(false) }
  }

  const verifyOtp = async () => {
    if (!otp.trim()) { setOtpError("Enter the OTP sent to your phone."); return }
    setOtpVerifying(true); setOtpError("")
    try {
      const res = await fetch("/api/rsvp/otp/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone, otp }),
      })
      if (!res.ok) { const d = await res.json(); setOtpError(d.error ?? "Invalid OTP"); return }
      if (needsMeals) { setStep("meals") } else { await submitRsvp({ skipMeals: true, otpVerified: true }) }
    } catch { setOtpError("Verification failed") }
    finally { setOtpVerifying(false) }
  }

  const submitRsvp = async ({ skipMeals = false, otpVerified = false } = {}) => {
    setSubmitting(true); setFormError("")
    try {
      // Combine single-select meals + multi-select drinks into one array
      const meals = skipMeals ? [] : [
        // One entry per non-drink category selection
        ...Object.values(mealSelections).map(menuItemId => ({ menuItemId, quantity: 1 })),
        // One entry per drink selected
        ...Array.from(drinkSelections).map(menuItemId => ({ menuItemId, quantity: 1 })),
      ]

      const res = await fetch("/api/rsvp", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          slug:        params.slug,
          inviteToken: inviteToken ?? undefined,
          firstName:   firstName.trim(),
          lastName:    lastName.trim(),
          phone:       phone.trim(),
          email:       email.trim() || undefined,
          tierId:      tierId || undefined,
          rsvpStatus:  rsvp,
          isPrivate,
          otpVerified,
          meals,
          guestId:     prefilled?.id ?? undefined,
        }),
      })
      if (!res.ok) { const d = await res.json(); setFormError(d.error ?? "Submission failed"); return }
      const d = await res.json()
      setGuestId(d.guestId)
      router.push(`/rsvp/confirmed/${d.guestId}`)
    } catch { setFormError("Submission failed. Please try again.") }
    finally { setSubmitting(false) }
  }

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#0a0a0a" }}>
      <div style={{ width:24, height:24, border:"2px solid rgba(180,140,60,0.2)", borderTopColor:"#b48c3c", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#0a0a0a", padding:"2rem", textAlign:"center" }}>
      <div style={{ fontSize:"2rem", marginBottom:"1rem" }}>😔</div>
      <h2 style={{ color:"#f0ece4", fontFamily:"Georgia, serif", fontWeight:300, marginBottom:"0.5rem" }}>
        {error === "Event not found" ? "This event doesn't exist" : error}
      </h2>
      <p style={{ color:"rgba(240,236,228,0.4)", fontSize:"0.875rem" }}>Please check the link and try again.</p>
    </div>
  )

  if (!event) return null

  const eventDate = new Date(event.eventDate).toLocaleDateString("en-NG", {
    weekday:"long", year:"numeric", month:"long", day:"numeric"
  })

  const isClosed = event.inviteModel === "CLOSED" && !inviteToken

  if (isClosed) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#0a0a0a", padding:"2rem", textAlign:"center" }}>
      <div style={{ fontSize:"2rem", marginBottom:"1rem" }}>🔒</div>
      <h2 style={{ color:"#f0ece4", fontFamily:"Georgia, serif", fontWeight:300, marginBottom:"0.5rem" }}>Private Event</h2>
      <p style={{ color:"rgba(240,236,228,0.4)", fontSize:"0.875rem" }}>This event requires a personal invitation link.</p>
    </div>
  )

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
        .rsvp-wrap{min-height:100vh;display:flex;flex-direction:column;align-items:center;padding-bottom:4rem}
        .rsvp-hero{width:100%;max-width:640px;aspect-ratio:16/7;position:relative;overflow:hidden;background:#111}
        .rsvp-hero-empty{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#111 0%,#1a1a1a 100%)}
        .rsvp-card{width:100%;max-width:640px;padding:0 1.25rem}
        .rsvp-event-name{font-family:'Cormorant Garamond',serif;font-size:clamp(1.75rem,6vw,2.75rem);font-weight:300;color:#f0ece4;margin:1.5rem 0 0.375rem;line-height:1.15;letter-spacing:-0.01em}
        .rsvp-event-meta{font-size:0.8rem;color:rgba(240,236,228,0.5);margin-bottom:0.25rem;display:flex;align-items:center;gap:0.375rem;flex-wrap:wrap}
        .rsvp-divider{height:1px;background:rgba(180,140,60,0.15);margin:1.25rem 0}
        .rsvp-form-title{font-size:0.58rem;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:1.125rem}
        .rsvp-field{margin-bottom:0.875rem}
        .rsvp-label{display:block;font-size:0.7rem;font-weight:500;color:rgba(240,236,228,0.6);letter-spacing:0.04em;margin-bottom:0.35rem}
        .rsvp-input,.rsvp-sel{width:100%;padding:0.65rem 0.875rem;background:#1a1a1a;border:1px solid rgba(180,140,60,0.2);color:#f0ece4;font-family:'DM Sans',sans-serif;font-size:0.875rem;outline:none;border-radius:5px;transition:border-color 0.15s}
        .rsvp-input:focus,.rsvp-sel:focus{border-color:var(--gold)}
        .rsvp-input::placeholder{color:rgba(240,236,228,0.2)}
        .rsvp-sel option{background:#1a1a1a}
        .rsvp-row2{display:grid;grid-template-columns:1fr 1fr;gap:0.75rem}
        @media(max-width:420px){.rsvp-row2{grid-template-columns:1fr}}
        .rsvp-rsvp-choice{display:grid;grid-template-columns:1fr 1fr;gap:0.625rem;margin-bottom:1.125rem}
        .rsvp-choice-btn{padding:0.75rem;border-radius:6px;border:1.5px solid rgba(180,140,60,0.2);background:transparent;color:rgba(240,236,228,0.6);font-family:'DM Sans',sans-serif;font-size:0.8rem;cursor:pointer;transition:all 0.2s;text-align:center}
        .rsvp-choice-btn.active-yes{border-color:#22c55e;background:rgba(34,197,94,0.1);color:#22c55e}
        .rsvp-choice-btn.active-no{border-color:#ef4444;background:rgba(239,68,68,0.1);color:#ef4444}
        .rsvp-privacy{display:flex;align-items:flex-start;gap:0.625rem;padding:0.75rem;background:#111;border:1px solid rgba(180,140,60,0.12);border-radius:5px;cursor:pointer;margin-bottom:1.125rem}
        .rsvp-privacy input{flex-shrink:0;width:14px;height:14px;margin-top:2px;accent-color:#b48c3c}
        .rsvp-privacy-text{font-size:0.75rem;color:rgba(240,236,228,0.5);line-height:1.5}
        .rsvp-privacy-text strong{color:rgba(240,236,228,0.75)}
        .rsvp-submit{width:100%;padding:0.875rem;font-family:'DM Sans',sans-serif;font-size:0.8rem;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;border:none;border-radius:5px;transition:all 0.2s}
        .rsvp-submit:disabled{opacity:0.5;cursor:not-allowed}
        .rsvp-error{font-size:0.75rem;color:#ef4444;padding:0.625rem 0.75rem;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:4px;margin-bottom:0.875rem}
        .rsvp-otp-box{text-align:center;padding:1rem 0}
        .rsvp-otp-input{font-size:1.5rem;letter-spacing:0.5rem;text-align:center;width:100%;padding:0.875rem;background:#1a1a1a;border:1px solid rgba(180,140,60,0.3);color:#f0ece4;border-radius:5px;outline:none;font-family:'DM Sans',sans-serif}
        .rsvp-otp-input:focus{border-color:#b48c3c}
        .rsvp-meal-cat{margin-bottom:1.25rem}
        .rsvp-meal-cat-title{font-size:0.6rem;font-weight:500;letter-spacing:0.15em;text-transform:uppercase;color:rgba(180,140,60,0.8);margin-bottom:0.625rem}

        /* ── Shared meal item styles ── */
        .rsvp-meal-item{display:flex;align-items:center;gap:0.75rem;padding:0.75rem;border:1.5px solid rgba(180,140,60,0.15);border-radius:5px;margin-bottom:0.375rem;cursor:pointer;transition:all 0.15s}
        .rsvp-meal-item:hover:not(.disabled){border-color:rgba(180,140,60,0.3);background:rgba(180,140,60,0.04)}
        .rsvp-meal-item.selected{border-color:#b48c3c;background:rgba(180,140,60,0.08)}
        .rsvp-meal-item.disabled{opacity:0.4;cursor:not-allowed}

        /* ── Radio (single select) ── */
        .rsvp-meal-radio{width:16px;height:16px;border-radius:50%;border:2px solid rgba(180,140,60,0.4);flex-shrink:0;display:flex;align-items:center;justify-content:center}
        .rsvp-meal-radio.selected{border-color:#b48c3c;background:#b48c3c}
        .rsvp-meal-radio.selected::after{content:'';width:6px;height:6px;border-radius:50%;background:#0a0a0a}

        /* ── Checkbox (multi select — drinks) ── */
        .rsvp-meal-checkbox{width:16px;height:16px;border-radius:3px;border:2px solid rgba(180,140,60,0.4);flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.15s}
        .rsvp-meal-checkbox.selected{border-color:#b48c3c;background:#b48c3c}
        .rsvp-meal-checkbox.selected::after{content:'✓';font-size:10px;color:#0a0a0a;line-height:1;font-weight:700}

        /* ── Drink counter badge ── */
        .rsvp-drink-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:0.625rem}
        .rsvp-drink-counter{font-size:0.65rem;font-weight:500;padding:0.2rem 0.55rem;border-radius:99px;border:1px solid rgba(180,140,60,0.3);color:rgba(180,140,60,0.8);background:rgba(180,140,60,0.06);transition:all 0.2s}
        .rsvp-drink-counter.at-max{border-color:rgba(180,140,60,0.6);color:#b48c3c;background:rgba(180,140,60,0.12)}

        .rsvp-back-btn{background:transparent;border:none;color:rgba(240,236,228,0.4);font-family:'DM Sans',sans-serif;font-size:0.75rem;cursor:pointer;display:flex;align-items:center;gap:0.35rem;padding:0;margin-bottom:1rem;transition:color 0.15s}
        .rsvp-back-btn:hover{color:rgba(240,236,228,0.7)}
        .rsvp-step-indicator{display:flex;align-items:center;gap:0.375rem;margin-bottom:1.5rem}
        .rsvp-step-dot{width:6px;height:6px;border-radius:50%;background:rgba(180,140,60,0.2);transition:background 0.2s}
        .rsvp-step-dot.active{background:#b48c3c}
      `}</style>
      <style>{`:root{--gold:${gold}}`}</style>

      <div className="rsvp-wrap">
        {/* Hero */}
        <div className="rsvp-hero">
          {event.invitationCard
            ? <Image src={event.invitationCard} alt={event.name} fill style={{ objectFit:"cover" }} unoptimized />
            : <div className="rsvp-hero-empty">
                <span style={{ fontSize:"0.7rem", letterSpacing:"0.15em", textTransform:"uppercase", color:"rgba(240,236,228,0.2)" }}>
                  {event.name}
                </span>
              </div>
          }
        </div>

        <div className="rsvp-card">
          {/* Event info */}
          <h1 className="rsvp-event-name">{event.name}</h1>
          <div className="rsvp-event-meta">
            <span>📅 {eventDate}</span>
            {event.startTime && <><span>·</span><span>🕐 {event.startTime}</span></>}
          </div>
          {event.venueName && (
            <div className="rsvp-event-meta" style={{ marginTop:"0.25rem" }}>
              <span>📍 {event.venueName}{event.venueAddress ? `, ${event.venueAddress}` : ""}</span>
            </div>
          )}
          {event.description && (
            <p style={{ fontSize:"0.82rem", color:"rgba(240,236,228,0.5)", lineHeight:1.7, marginTop:"0.75rem" }}>{event.description}</p>
          )}

          <div className="rsvp-divider" />

          {/* Step indicators */}
          <div className="rsvp-step-indicator">
            {["form", "otp", "meals"].map(s => (
              <div key={s} className={`rsvp-step-dot${step === s ? " active" : ""}`} />
            ))}
          </div>

          {/* ══ STEP: FORM ══ */}
          {step === "form" && (
            <>
              <div className="rsvp-form-title" style={{ color:gold }}>
                {prefilled ? "Confirm your details" : "RSVP to this event"}
              </div>

              {/* Attending? */}
              <div className="rsvp-field">
                <div className="rsvp-label">Are you attending?</div>
                <div className="rsvp-rsvp-choice">
                  <button className={`rsvp-choice-btn${rsvp === "CONFIRMED" ? " active-yes" : ""}`} onClick={() => setRsvp("CONFIRMED")}>
                    ✓ Yes, I'll be there
                  </button>
                  <button className={`rsvp-choice-btn${rsvp === "DECLINED" ? " active-no" : ""}`} onClick={() => setRsvp("DECLINED")}>
                    ✗ Can't make it
                  </button>
                </div>
              </div>

              <div className="rsvp-row2">
                <div className="rsvp-field">
                  <label className="rsvp-label">First Name *</label>
                  <input className="rsvp-input" placeholder="Tunde" value={firstName} onChange={e => setFirstName(e.target.value)} />
                </div>
                <div className="rsvp-field">
                  <label className="rsvp-label">Last Name *</label>
                  <input className="rsvp-input" placeholder="Adeyemi" value={lastName} onChange={e => setLastName(e.target.value)} />
                </div>
              </div>

              <div className="rsvp-field">
                <label className="rsvp-label">Phone Number *</label>
                <input className="rsvp-input" placeholder="08012345678" value={phone} onChange={e => setPhone(e.target.value)} type="tel" />
              </div>

              <div className="rsvp-field">
                <label className="rsvp-label">Email Address</label>
                <input className="rsvp-input" placeholder="tunde@email.com" value={email} onChange={e => setEmail(e.target.value)} type="email" />
              </div>

              {/* Tier selection */}
              {!prefilled?.tierId && event.guestTiers.length > 1 && (
                <div className="rsvp-field">
                  <label className="rsvp-label">Guest Category</label>
                  <select className="rsvp-sel" value={tierId} onChange={e => setTierId(e.target.value)}>
                    <option value="">Select category</option>
                    {event.guestTiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}

              {/* Privacy toggle */}
              <label className="rsvp-privacy">
                <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} />
                <div className="rsvp-privacy-text">
                  <strong>Keep my details private</strong><br />
                  Your name and contact will not be visible to the host. The event planner can still see your entry for coordination.
                </div>
              </label>

              {formError && <div className="rsvp-error">{formError}</div>}

              <button
                className="rsvp-submit"
                style={{ background:gold, color:"#0a0a0a" }}
                onClick={handleSubmitForm}
                disabled={submitting || otpSending}
              >
                {submitting || otpSending ? "Please wait…" : rsvp === "CONFIRMED" ? "Confirm RSVP →" : "Submit →"}
              </button>
            </>
          )}

          {/* ══ STEP: OTP ══ */}
          {step === "otp" && (
            <>
              <button className="rsvp-back-btn" onClick={() => setStep("form")}>← Back</button>
              <div className="rsvp-form-title" style={{ color:gold }}>Verify your number</div>
              <div className="rsvp-otp-box">
                <p style={{ fontSize:"0.82rem", color:"rgba(240,236,228,0.55)", marginBottom:"1.25rem", lineHeight:1.6 }}>
                  We sent a 6-digit code to <strong style={{ color:"#f0ece4" }}>{phone}</strong>.
                  Enter it below to confirm your RSVP.
                </p>
                <input
                  className="rsvp-otp-input"
                  placeholder="000000"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g,"").slice(0,6))}
                  maxLength={6}
                  inputMode="numeric"
                />
              </div>
              {otpError && <div className="rsvp-error">{otpError}</div>}
              <button className="rsvp-submit" style={{ background:gold, color:"#0a0a0a", marginTop:"1rem" }}
                onClick={verifyOtp} disabled={otpVerifying || otp.length < 6}>
                {otpVerifying ? "Verifying…" : "Verify →"}
              </button>
              <button style={{ width:"100%", marginTop:"0.75rem", background:"transparent", border:"none", color:"rgba(240,236,228,0.35)", fontSize:"0.75rem", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}
                onClick={sendOtp}>
                Resend code
              </button>
            </>
          )}

          {/* ══ STEP: MEALS ══ */}
          {step === "meals" && (
            <>
              <button className="rsvp-back-btn" onClick={() => setStep(event.requireOtp ? "otp" : "form")}>← Back</button>
              <div className="rsvp-form-title" style={{ color:gold }}>Choose your meals</div>
              <p style={{ fontSize:"0.78rem", color:"rgba(240,236,228,0.45)", marginBottom:"1.25rem", lineHeight:1.6 }}>
                Select one option per course. For drinks, you can pick up to {MAX_DRINKS}.
              </p>

              {Object.entries(menuByCategory).map(([cat, items]) => {
                const isDrink = cat === "DRINK"

                if (isDrink) {
                  // ── DRINK — multi-select, max 4 ──────────────
                  const selectedCount = drinkSelections.size
                  const atMax         = selectedCount >= MAX_DRINKS

                  return (
                    <div className="rsvp-meal-cat" key={cat}>
                      <div className="rsvp-drink-header">
                        <div className="rsvp-meal-cat-title">{MENU_CATEGORY_LABELS[cat] ?? cat}</div>
                        <div className={`rsvp-drink-counter${atMax ? " at-max" : ""}`}>
                          {selectedCount} / {MAX_DRINKS} selected
                        </div>
                      </div>
                      {items.map(item => {
                        const selected  = drinkSelections.has(item.id)
                        const isDisabled = !selected && atMax

                        return (
                          <div
                            key={item.id}
                            className={`rsvp-meal-item${selected ? " selected" : ""}${isDisabled ? " disabled" : ""}`}
                            onClick={() => !isDisabled && toggleDrink(item.id)}
                          >
                            <div className={`rsvp-meal-checkbox${selected ? " selected" : ""}`} />
                            <div>
                              <div style={{ fontSize:"0.82rem", fontWeight:500, color: isDisabled ? "rgba(240,236,228,0.4)" : "#f0ece4" }}>
                                {item.name}
                              </div>
                              {item.description && (
                                <div style={{ fontSize:"0.72rem", color:"rgba(240,236,228,0.35)", marginTop:"0.15rem" }}>
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {atMax && (
                        <p style={{ fontSize:"0.7rem", color:"rgba(180,140,60,0.6)", marginTop:"0.375rem", textAlign:"center" }}>
                          Maximum {MAX_DRINKS} drinks selected. Deselect one to change.
                        </p>
                      )}
                    </div>
                  )
                }

                // ── All other categories — single-select radio ──
                return (
                  <div className="rsvp-meal-cat" key={cat}>
                    <div className="rsvp-meal-cat-title">{MENU_CATEGORY_LABELS[cat] ?? cat}</div>
                    {items.map(item => {
                      const selected = mealSelections[cat] === item.id
                      return (
                        <div key={item.id} className={`rsvp-meal-item${selected ? " selected" : ""}`}
                          onClick={() => setMealSelections(prev => ({ ...prev, [cat]: item.id }))}>
                          <div className={`rsvp-meal-radio${selected ? " selected" : ""}`} />
                          <div>
                            <div style={{ fontSize:"0.82rem", fontWeight:500, color:"#f0ece4" }}>{item.name}</div>
                            {item.description && (
                              <div style={{ fontSize:"0.72rem", color:"rgba(240,236,228,0.45)", marginTop:"0.15rem" }}>
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

              {formError && <div className="rsvp-error">{formError}</div>}
              <button className="rsvp-submit" style={{ background:gold, color:"#0a0a0a" }}
                onClick={() => submitRsvp()} disabled={submitting}>
                {submitting ? "Submitting…" : "Complete RSVP →"}
              </button>
              <button style={{ width:"100%", marginTop:"0.625rem", background:"transparent", border:"none", color:"rgba(240,236,228,0.35)", fontSize:"0.75rem", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}
                onClick={() => submitRsvp({ skipMeals: true })}>
                Skip meal selection
              </button>
            </>
          )}

          <p style={{ fontSize:"0.65rem", color:"rgba(240,236,228,0.2)", textAlign:"center", marginTop:"2rem" }}>Powered by EventFlow</p>
        </div>
      </div>
    </>
  )
}
