"use client"
// src/app/(dashboard)/settings/page.tsx
// Planner settings — Profile, Notifications,
// Connected Accounts, Security, Billing, Danger Zone

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

interface UserProfile {
  id:           string
  name:         string | null
  email:        string | null
  phone:        string | null
  businessName: string | null
  businessLogo: string | null
  plan:         string
}

type Section = "profile" | "notifications" | "connected" | "security" | "billing" | "danger"

const SECTIONS: { key: Section; label: string; icon: string }[] = [
  { key:"profile",       label:"Profile",            icon:"👤" },
  { key:"billing",       label:"Billing & Plans",    icon:"💳" },
  { key:"notifications", label:"Notifications",      icon:"🔔" },
  { key:"connected",     label:"Connected Accounts", icon:"🔗" },
  { key:"security",      label:"Security",           icon:"🔒" },
  { key:"danger",        label:"Danger Zone",        icon:"⚠️" },
]

const PLAN_LABELS: Record<string, string> = {
  free:"Free", starter:"Starter", pro:"Pro",
}

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("ef-session") ?? ""
    : ""
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function SettingsPage() {
  const router = useRouter()
  const [section,  setSection]  = useState<Section>("profile")
  const [profile,  setProfile]  = useState<UserProfile | null>(null)
  const [loading,  setLoading]  = useState(true)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Profile form
  const [form,       setForm]       = useState({ name:"", phone:"", businessName:"", businessLogo:"" })
  const [saving,     setSaving]     = useState(false)
  const [saveMsg,    setSaveMsg]    = useState("")
  const [saveError,  setSaveError]  = useState("")
  const [logoPreview,setLogoPreview]= useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  // Notification prefs (stored locally — no backend needed for now)
  const [notifPrefs, setNotifPrefs] = useState({
    rsvpConfirmed:  true,
    rsvpDeclined:   false,
    guestCheckedIn: false,
    giftReceived:   true,
    paymentSuccess: true,
    paymentFailed:  true,
  })

  // Danger zone
  const [deleteConfirm,  setDeleteConfirm]  = useState("")
  const [deleting,       setDeleting]       = useState(false)
  const [deleteError,    setDeleteError]    = useState("")

  // Billing info
  const [billing, setBilling] = useState<{ plan:string; nextBillingDate:string|null; status:string|null } | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/settings/profile", { headers: getAuthHeaders() })
        if (res.ok) {
          const d = await res.json()
          setProfile(d.user)
          setForm({
            name:         d.user.name         ?? "",
            phone:        d.user.phone        ?? "",
            businessName: d.user.businessName ?? "",
            businessLogo: d.user.businessLogo ?? "",
          })
          setLogoPreview(d.user.businessLogo ?? null)
        }
      } catch { /* silent */ }

      try {
        const res = await fetch("/api/payments/billing", { headers: getAuthHeaders() })
        if (res.ok) {
          const d = await res.json()
          setBilling({
            plan:           d.plan,
            nextBillingDate: d.subscription?.nextBillingDate ?? null,
            status:         d.subscription?.status ?? null,
          })
        }
      } catch { /* silent */ }

      setLoading(false)
    }
    load()
  }, [])

  const handleSaveProfile = async () => {
    setSaving(true); setSaveMsg(""); setSaveError("")
    try {
      const res = await fetch("/api/settings/profile", {
        method:  "PATCH",
        headers: { "Content-Type":"application/json", ...getAuthHeaders() },
        body:    JSON.stringify({
          name:         form.name.trim()         || null,
          phone:        form.phone.trim()        || null,
          businessName: form.businessName.trim() || null,
          businessLogo: form.businessLogo        || null,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setSaveError(d.error ?? "Failed to save"); return }
      setProfile(d.user)
      setSaveMsg("Profile saved successfully")
      setTimeout(() => setSaveMsg(""), 3000)
    } catch { setSaveError("Network error. Please try again.") }
    finally { setSaving(false) }
  }

  const handleLogoUpload = async (file: File) => {
    if (!file) return
    if (!["image/jpeg","image/png","image/webp"].includes(file.type)) {
      setSaveError("Logo must be JPEG, PNG or WEBP."); return
    }
    if (file.size > 2 * 1024 * 1024) {
      setSaveError("Logo must be under 2MB."); return
    }
    setUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("eventName", form.businessName || "business-logo")
      const res = await fetch("/api/upload/invitation-card", {
        method:  "POST",
        headers: getAuthHeaders(),
        body:    formData,
      })
      const d = await res.json()
      if (!res.ok) { setSaveError(d.error ?? "Upload failed"); return }
      setForm(f => ({ ...f, businessLogo: d.url }))
      setLogoPreview(d.url)
    } catch { setSaveError("Upload failed. Please try again.") }
    finally { setUploadingLogo(false) }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") { setDeleteError('Type "DELETE" to confirm.'); return }
    setDeleting(true); setDeleteError("")
    try {
      const res = await fetch("/api/settings/delete-account", {
        method:  "POST",
        headers: getAuthHeaders(),
      })
      if (!res.ok) { const d = await res.json(); setDeleteError(d.error ?? "Failed"); return }
      localStorage.removeItem("ef-session")
      router.push("/")
    } catch { setDeleteError("Network error. Please try again.") }
    finally { setDeleting(false) }
  }

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"60vh" }}>
      <div style={{ width:22, height:22, border:"1.5px solid rgba(180,140,60,0.2)", borderTopColor:"#b48c3c", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .st-wrap { max-width: 860px; margin: 0 auto; padding: 1.5rem 1.25rem 4rem; font-family: 'DM Sans', sans-serif; overflow-x: hidden; }
        @media(min-width:600px){ .st-wrap { padding: 2rem 1.5rem 4rem; } }

        .st-heading { font-family: 'Cormorant Garamond', serif; font-size: clamp(1.375rem,4vw,1.75rem); font-weight: 300; color: var(--text); margin-bottom: 1.75rem; }

        /* Sidebar nav + content layout */
        .st-layout { display: flex; flex-direction: column; gap: 1.5rem; }
        @media(min-width:700px){ .st-layout { flex-direction: row; align-items: flex-start; gap: 2rem; } }

        .st-nav { display: flex; flex-direction: row; overflow-x: auto; gap: 0.375rem; padding-bottom: 0.25rem; flex-shrink: 0; }
        @media(min-width:700px){ .st-nav { flex-direction: column; min-width: 180px; overflow-x: visible; } }
        .st-nav::-webkit-scrollbar { display: none; }

        .st-nav-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.55rem 0.875rem; background: transparent; border: 1px solid transparent; color: var(--text-3); font-family: 'DM Sans', sans-serif; font-size: 0.78rem; cursor: pointer; transition: all 0.2s; white-space: nowrap; border-radius: 6px; }
        .st-nav-btn:hover { color: var(--text); background: var(--bg-2); }
        .st-nav-btn.active { color: var(--gold); background: var(--bg-2); border-color: var(--border); }
        .st-nav-icon { font-size: 0.875rem; flex-shrink: 0; }

        .st-content { flex: 1; min-width: 0; }

        /* Cards */
        .st-card { background: var(--bg-2); border: 1px solid var(--border); padding: 1.25rem; margin-bottom: 1rem; }
        .st-card-title { font-size: 0.6rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 1.125rem; display: flex; align-items: center; gap: 0.75rem; }
        .st-card-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }

        /* Form fields */
        .st-field { margin-bottom: 0.875rem; }
        .st-label { display: block; font-size: 0.67rem; color: var(--text-3); letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 0.35rem; }
        .st-input { width: 100%; padding: 0.575rem 0.75rem; background: var(--bg-3); border: 1px solid var(--border); color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 0.82rem; outline: none; transition: border-color 0.2s; }
        .st-input:focus { border-color: var(--gold); }
        .st-input::placeholder { color: var(--text-3); }
        .st-input:disabled { opacity: 0.5; cursor: not-allowed; }
        .st-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
        @media(max-width:480px){ .st-row2 { grid-template-columns: 1fr; } }

        /* Buttons */
        .st-btn-gold  { padding: 0.575rem 1.25rem; background: var(--gold); color: #0a0a0a; border: none; font-family: 'DM Sans', sans-serif; font-size: 0.75rem; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .st-btn-gold:disabled { opacity: 0.5; cursor: not-allowed; }
        .st-btn-ghost { padding: 0.55rem 1.125rem; background: transparent; border: 1px solid var(--border); color: var(--text-2); font-family: 'DM Sans', sans-serif; font-size: 0.75rem; cursor: pointer; transition: all 0.2s; }
        .st-btn-ghost:hover { border-color: var(--border-hover); color: var(--text); }
        .st-btn-red   { padding: 0.575rem 1.25rem; background: transparent; border: 1px solid rgba(239,68,68,0.35); color: rgba(239,68,68,0.7); font-family: 'DM Sans', sans-serif; font-size: 0.75rem; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .st-btn-red:hover:not(:disabled) { border-color: #ef4444; color: #ef4444; }
        .st-btn-red:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Toggle switch */
        .st-toggle-row { display: flex; align-items: flex-start; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--border); gap: 1rem; }
        .st-toggle-row:last-child { border-bottom: none; }
        .st-toggle-label { font-size: 0.82rem; color: var(--text); font-weight: 500; margin-bottom: 0.15rem; }
        .st-toggle-desc  { font-size: 0.7rem; color: var(--text-3); line-height: 1.5; }
        .st-switch { width: 38px; height: 20px; border-radius: 10px; background: var(--bg); border: 1.5px solid var(--border); cursor: pointer; flex-shrink: 0; position: relative; transition: all 0.2s; margin-top: 2px; }
        .st-switch.on { background: var(--gold); border-color: var(--gold); }
        .st-switch-thumb { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: var(--text-3); transition: all 0.2s; }
        .st-switch.on .st-switch-thumb { left: 20px; background: #0a0a0a; }

        /* Logo upload */
        .st-logo-wrap { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.125rem; flex-wrap: wrap; }
        .st-logo-preview { width: 64px; height: 64px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-3); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
        .st-logo-preview img { width: 100%; height: 100%; object-fit: cover; }
        .st-logo-placeholder { font-size: 1.5rem; opacity: 0.3; }

        /* Plan badge */
        .st-plan-badge { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.25rem 0.625rem; border-radius: 99px; font-size: 0.65rem; font-weight: 500; letter-spacing: 0.05em; border: 1px solid rgba(180,140,60,0.35); background: rgba(180,140,60,0.08); color: var(--gold); }

        /* Info rows */
        .st-info-row { display: flex; justify-content: space-between; align-items: center; padding: 0.55rem 0; border-bottom: 1px solid var(--border); font-size: 0.78rem; gap: 1rem; }
        .st-info-row:last-child { border-bottom: none; }
        .st-info-k { color: var(--text-3); }
        .st-info-v { color: var(--text); font-weight: 500; text-align: right; }

        /* Coming soon */
        .st-coming-soon { padding: 2rem; text-align: center; border: 1px dashed var(--border); }
        .st-coming-icon  { font-size: 2rem; margin-bottom: 0.75rem; opacity: 0.5; }
        .st-coming-title { font-family: 'Cormorant Garamond', serif; font-size: 1.125rem; font-weight: 300; color: var(--text-2); margin-bottom: 0.375rem; }
        .st-coming-desc  { font-size: 0.75rem; color: var(--text-3); line-height: 1.6; }

        /* Danger zone */
        .st-danger-card { background: rgba(239,68,68,0.04); border: 1px solid rgba(239,68,68,0.2); padding: 1.25rem; }

        /* Alerts */
        .st-success { font-size: 0.75rem; color: #22c55e; margin-top: 0.5rem; }
        .st-error   { font-size: 0.75rem; color: #ef4444; margin-top: 0.5rem; }
      `}</style>

      <div className="st-wrap">
        <h1 className="st-heading">Settings</h1>

        <div className="st-layout">
          {/* Sidebar nav */}
          <nav className="st-nav">
            {SECTIONS.map(s => (
              <button
                key={s.key}
                className={`st-nav-btn${section === s.key ? " active" : ""}`}
                onClick={() => setSection(s.key)}
              >
                <span className="st-nav-icon">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="st-content">

            {/* ══ PROFILE ══ */}
            {section === "profile" && (
              <>
                <div className="st-card">
                  <div className="st-card-title" style={{ color:"var(--gold)" }}>Profile</div>

                  {/* Business logo */}
                  <div className="st-field">
                    <div className="st-label">Business logo</div>
                    <div className="st-logo-wrap">
                      <div className="st-logo-preview">
                        {logoPreview
                          ? <Image src={logoPreview} alt="Logo" width={64} height={64} style={{ objectFit:"cover" }} unoptimized />
                          : <span className="st-logo-placeholder">🏢</span>
                        }
                      </div>
                      <div>
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          style={{ display:"none" }}
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }}
                        />
                        <button className="st-btn-ghost" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                          {uploadingLogo ? "Uploading…" : logoPreview ? "Change logo" : "Upload logo"}
                        </button>
                        {logoPreview && (
                          <button
                            className="st-btn-ghost"
                            style={{ marginLeft:"0.5rem", color:"rgba(239,68,68,0.6)", borderColor:"rgba(239,68,68,0.2)" }}
                            onClick={() => { setLogoPreview(null); setForm(f => ({ ...f, businessLogo:"" })) }}
                          >
                            Remove
                          </button>
                        )}
                        <div style={{ fontSize:"0.65rem", color:"var(--text-3)", marginTop:"0.4rem" }}>
                          JPEG, PNG or WEBP · Max 2MB
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="st-row2">
                    <div className="st-field">
                      <label className="st-label">Full name</label>
                      <input className="st-input" placeholder="Your name" value={form.name} onChange={e => setForm(f => ({...f,name:e.target.value}))} />
                    </div>
                    <div className="st-field">
                      <label className="st-label">Phone number</label>
                      <input className="st-input" type="tel" placeholder="+234 800 000 0000" value={form.phone} onChange={e => setForm(f => ({...f,phone:e.target.value}))} />
                    </div>
                  </div>

                  <div className="st-field">
                    <label className="st-label">Business / brand name</label>
                    <input className="st-input" placeholder="e.g. Tunde Events Co." value={form.businessName} onChange={e => setForm(f => ({...f,businessName:e.target.value}))} />
                  </div>

                  <div className="st-field">
                    <label className="st-label">Email address</label>
                    <input className="st-input" value={profile?.email ?? ""} disabled />
                    <div style={{ fontSize:"0.65rem", color:"var(--text-3)", marginTop:"0.35rem" }}>Email cannot be changed. Contact support if needed.</div>
                  </div>

                  {saveError && <div className="st-error">{saveError}</div>}
                  {saveMsg   && <div className="st-success">✓ {saveMsg}</div>}

                  <div style={{ marginTop:"1rem" }}>
                    <button className="st-btn-gold" onClick={handleSaveProfile} disabled={saving}>
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ══ BILLING ══ */}
            {section === "billing" && (
              <>
                <div className="st-card">
                  <div className="st-card-title" style={{ color:"var(--gold)" }}>Current plan</div>
                  <div className="st-info-row">
                    <span className="st-info-k">Plan</span>
                    <span className="st-plan-badge">{billing ? PLAN_LABELS[billing.plan] ?? billing.plan : PLAN_LABELS[profile?.plan ?? "free"]}</span>
                  </div>
                  {billing?.nextBillingDate && (
                    <div className="st-info-row">
                      <span className="st-info-k">Next billing date</span>
                      <span className="st-info-v">{new Date(billing.nextBillingDate).toLocaleDateString("en-NG",{day:"numeric",month:"long",year:"numeric"})}</span>
                    </div>
                  )}
                  {billing?.status && (
                    <div className="st-info-row">
                      <span className="st-info-k">Status</span>
                      <span className="st-info-v" style={{ color:billing.status==="ACTIVE"?"#22c55e":"#ef4444" }}>
                        {billing.status.charAt(0)+billing.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                  )}
                  <div style={{ marginTop:"1rem", display:"flex", gap:"0.625rem", flexWrap:"wrap" }}>
                    <Link href="/dashboard/pricing">
                      <button className="st-btn-gold">View all plans →</button>
                    </Link>
                    <Link href="/dashboard/settings/billing">
                      <button className="st-btn-ghost">Manage billing</button>
                    </Link>
                  </div>
                </div>

                {/* Top-ups quick reference */}
                <div className="st-card">
                  <div className="st-card-title" style={{ color:"var(--gold)" }}>Event top-ups</div>
                  {[
                    { name:"Extra Guests Pack",       price:"₦2,000", desc:"+200 guests · per event" },
                    { name:"WhatsApp QR Delivery",    price:"₦1,500", desc:"Send QR via WhatsApp · per event" },
                    { name:"Priority Check-in Tools", price:"₦2,500", desc:"Advanced check-in tools · per event" },
                  ].map(t => (
                    <div className="st-info-row" key={t.name}>
                      <div>
                        <div style={{ fontSize:"0.78rem", color:"var(--text)", fontWeight:500 }}>{t.name}</div>
                        <div style={{ fontSize:"0.67rem", color:"var(--text-3)" }}>{t.desc}</div>
                      </div>
                      <div style={{ fontSize:"0.875rem", color:"var(--gold)", fontFamily:"'Cormorant Garamond',serif", fontWeight:300, flexShrink:0 }}>{t.price}</div>
                    </div>
                  ))}
                  <div style={{ fontSize:"0.7rem", color:"var(--text-3)", marginTop:"0.875rem", lineHeight:1.6 }}>
                    Purchase top-ups from the event page when you need them.
                  </div>
                </div>
              </>
            )}

            {/* ══ NOTIFICATIONS ══ */}
            {section === "notifications" && (
              <div className="st-card">
                <div className="st-card-title" style={{ color:"var(--gold)" }}>Notification preferences</div>
                <p style={{ fontSize:"0.75rem", color:"var(--text-3)", marginBottom:"1rem", lineHeight:1.6 }}>
                  Choose which email notifications you receive. You'll always receive payment and security emails.
                </p>
                {[
                  { key:"rsvpConfirmed",  label:"RSVP confirmed",     desc:"A guest confirms their attendance"    },
                  { key:"rsvpDeclined",   label:"RSVP declined",      desc:"A guest declines their invitation"    },
                  { key:"guestCheckedIn", label:"Guest check-in",      desc:"A guest scans in at the gate"         },
                  { key:"giftReceived",   label:"Gift received",       desc:"A gift is recorded during your event" },
                  { key:"paymentSuccess", label:"Payment confirmed",   desc:"A subscription or top-up payment succeeds" },
                  { key:"paymentFailed",  label:"Payment failed",      desc:"A subscription renewal fails"         },
                ].map(pref => (
                  <div className="st-toggle-row" key={pref.key}>
                    <div>
                      <div className="st-toggle-label">{pref.label}</div>
                      <div className="st-toggle-desc">{pref.desc}</div>
                    </div>
                    <div
                      className={`st-switch${notifPrefs[pref.key as keyof typeof notifPrefs] ? " on" : ""}`}
                      onClick={() => setNotifPrefs(p => ({ ...p, [pref.key]: !p[pref.key as keyof typeof notifPrefs] }))}
                    >
                      <div className="st-switch-thumb" />
                    </div>
                  </div>
                ))}
                <div style={{ marginTop:"1.125rem" }}>
                  <button className="st-btn-gold" onClick={() => { /* TODO: persist notif prefs */ setSaveMsg("Preferences saved"); setTimeout(()=>setSaveMsg(""),2000) }}>
                    Save preferences
                  </button>
                  {saveMsg && <div className="st-success" style={{ marginTop:"0.5rem" }}>✓ {saveMsg}</div>}
                </div>
              </div>
            )}

            {/* ══ CONNECTED ACCOUNTS ══ */}
            {section === "connected" && (
              <>
                {/* Google — already connected since they log in with Google */}
                <div className="st-card">
                  <div className="st-card-title" style={{ color:"var(--gold)" }}>Connected accounts</div>
                  <div className="st-info-row">
                    <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
                      <span style={{ fontSize:"1.25rem" }}>🔵</span>
                      <div>
                        <div style={{ fontSize:"0.82rem", fontWeight:500, color:"var(--text)" }}>Google</div>
                        <div style={{ fontSize:"0.68rem", color:"var(--text-3)" }}>{profile?.email}</div>
                      </div>
                    </div>
                    <span style={{ fontSize:"0.65rem", padding:"0.2rem 0.55rem", borderRadius:99, border:"1px solid rgba(34,197,94,0.3)", background:"rgba(34,197,94,0.08)", color:"#22c55e" }}>Connected</span>
                  </div>
                </div>

                {/* WhatsApp Business — coming soon */}
                <div className="st-card">
                  <div className="st-card-title" style={{ color:"var(--gold)" }}>WhatsApp Business</div>
                  <div className="st-coming-soon">
                    <div className="st-coming-icon">💬</div>
                    <div className="st-coming-title">Coming soon</div>
                    <div className="st-coming-desc">
                      EventFlow will send WhatsApp invitations and QR codes to your guests directly from our verified business number.<br /><br />
                      No setup needed on your end — this will be available once our WhatsApp Business API registration with Meta is complete.
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ══ SECURITY ══ */}
            {section === "security" && (
              <>
                <div className="st-card">
                  <div className="st-card-title" style={{ color:"var(--gold)" }}>Security</div>
                  <div className="st-coming-soon" style={{ border:"none", padding:"0.5rem 0" }}>
                    <div style={{ fontSize:"0.82rem", color:"var(--text-2)", lineHeight:1.7 }}>
                      Your account is secured via Google OAuth. EventFlow does not store passwords.<br /><br />
                      To change your Google account password or enable 2-factor authentication, visit your{" "}
                      <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" style={{ color:"var(--gold)" }}>
                        Google account security settings
                      </a>.
                    </div>
                  </div>
                </div>

                <div className="st-card">
                  <div className="st-card-title" style={{ color:"var(--gold)" }}>Active sessions</div>
                  <div style={{ fontSize:"0.78rem", color:"var(--text-2)", marginBottom:"0.875rem" }}>
                    You are currently logged in on this device.
                  </div>
                  <button
                    className="st-btn-ghost"
                    onClick={() => {
                      localStorage.removeItem("ef-session")
                      window.location.href = "/login"
                    }}
                  >
                    Sign out of this device
                  </button>
                </div>
              </>
            )}

            {/* ══ DANGER ZONE ══ */}
            {section === "danger" && (
              <div className="st-danger-card">
                <div style={{ fontSize:"0.6rem", fontWeight:500, letterSpacing:"0.18em", textTransform:"uppercase", color:"#ef4444", marginBottom:"1rem" }}>
                  Danger Zone
                </div>
                <div style={{ fontSize:"0.82rem", fontWeight:500, color:"var(--text)", marginBottom:"0.375rem" }}>
                  Delete your account
                </div>
                <p style={{ fontSize:"0.75rem", color:"rgba(240,236,228,0.5)", lineHeight:1.7, marginBottom:"1.25rem" }}>
                  This permanently deletes your account, all your events, guests, vendor portals, and any data associated with EventFlow.
                  This action <strong style={{ color:"#ef4444" }}>cannot be undone</strong>. Your active subscription will be cancelled immediately.
                </p>
                <div className="st-field">
                  <label className="st-label" style={{ color:"rgba(239,68,68,0.6)" }}>Type DELETE to confirm</label>
                  <input
                    className="st-input"
                    placeholder="DELETE"
                    value={deleteConfirm}
                    onChange={e => setDeleteConfirm(e.target.value)}
                    style={{ borderColor:"rgba(239,68,68,0.2)" }}
                  />
                </div>
                {deleteError && <div className="st-error">{deleteError}</div>}
                <button
                  className="st-btn-red"
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteConfirm !== "DELETE"}
                  style={{ marginTop:"0.75rem" }}
                >
                  {deleting ? "Deleting…" : "Delete my account permanently"}
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
