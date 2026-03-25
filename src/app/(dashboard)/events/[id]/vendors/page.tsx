"use client"
// src/app/(dashboard)/events/[id]/vendors/page.tsx
// Updated: + Payment tracking, + Planner→Vendor feedback, + Complaints

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

interface Vendor {
  id: string; name: string; contactName: string | null
  email: string | null; phone: string | null; role: string
  notes: string | null; arriveTime: string | null
  arriveLocation: string | null; instructions: string | null
  staffCount: number | null; portalToken: string
  lastAccessed: string | null; canOverrideCapacity: boolean
  capacityOverrideActive: boolean
}

interface VendorPayment {
  id: string; amount: string; method: string; note: string | null
  receiptUrl: string | null; status: string
  acknowledgedAt: string | null; disputedAt: string | null
  disputeNote: string | null; createdAt: string
}

interface PaymentSummary {
  payments: VendorPayment[]; totalCost: string | null
  totalPaid: string; balance: string | null
}

interface Complaint {
  id: string; raisedBy: string; category: string
  description: string; evidenceUrl: string | null
  status: string; response: string | null; createdAt: string
}

interface Feedback {
  plannerRating: number | null; plannerComment: string | null
  plannerWouldHire: boolean | null; vendorRating: number | null
  vendorComment: string | null; vendorWouldWork: boolean | null
}

const VENDOR_ROLES = [
  "CATERER","SECURITY","MEDIA","LIVE_BAND","DJ",
  "MC","HYPEMAN","AFTER_PARTY","DRINK_VENDOR",
  "DECORATOR","PHOTOGRAPHER","VIDEOGRAPHER","OTHER",
]

function roleLabel(role: string): string {
  const map: Record<string,string> = {
    CATERER:"Caterer",SECURITY:"Security",MEDIA:"Media",
    LIVE_BAND:"Live Band",DJ:"DJ",MC:"MC",HYPEMAN:"Hypeman",
    AFTER_PARTY:"After Party",DRINK_VENDOR:"Drink Vendor",
    DECORATOR:"Decorator",PHOTOGRAPHER:"Photographer",
    VIDEOGRAPHER:"Videographer",OTHER:"Other",
  }
  return map[role] ?? role
}

const fmtNGN = (v: string | null | undefined) =>
  v ? `₦${Number(v).toLocaleString("en-NG")}` : "—"

function paymentStatusTag(status: string) {
  if (status === "ACKNOWLEDGED") return { label:"✓ Acknowledged", color:"#22c55e", bg:"rgba(34,197,94,0.08)", border:"rgba(34,197,94,0.3)" }
  if (status === "DISPUTED")     return { label:"⚑ Disputed",     color:"#ef4444", bg:"rgba(239,68,68,0.08)", border:"rgba(239,68,68,0.3)" }
  return { label:"Pending", color:"var(--text-3)", bg:"transparent", border:"var(--border)" }
}

function vendorPaymentStatus(totalCost: string | null, totalPaid: string) {
  if (!totalCost) return null
  const cost = Number(totalCost); const paid = Number(totalPaid)
  if (paid === 0)          return { label:"🔴 Unpaid",        color:"#ef4444" }
  if (paid >= cost)        return { label:"🟢 Paid in Full",  color:"#22c55e" }
  return                          { label:"🟡 Part Payment",  color:"#f59e0b" }
}

const PLANNER_COMPLAINT_CATS = [
  "Delay / Late arrival","Quality issue","No show",
  "Scope creep","Poor communication","Other",
]

const EMPTY_FORM = {
  name:"",contactName:"",email:"",phone:"",
  role:"OTHER",notes:"",staffCount:"",canOverrideCapacity:false,
}

function getAuthHeaders(): Record<string,string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("ef-session") ?? "" : ""
  return token ? { Authorization:`Bearer ${token}` } : {}
}

export default function VendorsPage() {
  const { id: eventId } = useParams<{ id: string }>()

  const [vendors,   setVendors]   = useState<Vendor[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string|null>(null)
  const [showForm,  setShowForm]  = useState(false)
  const [editId,    setEditId]    = useState<string|null>(null)
  const [form,      setForm]      = useState({...EMPTY_FORM})
  const [saving,    setSaving]    = useState(false)
  const [formError, setFormError] = useState("")
  const [copiedId,  setCopiedId]  = useState<string|null>(null)
  const [deleting,  setDeleting]  = useState<string|null>(null)

  // Brief
  const [briefOpenId, setBriefOpenId]  = useState<string|null>(null)
  const [briefForm,   setBriefForm]    = useState({ arriveTime:"", arriveLocation:"", instructions:"" })
  const [savingBrief, setSavingBrief]  = useState(false)
  const [briefError,  setBriefError]   = useState("")
  const [briefSavedId,setBriefSavedId] = useState<string|null>(null)

  // Payment
  const [paymentOpenId,  setPaymentOpenId]  = useState<string|null>(null)
  const [paymentSummary, setPaymentSummary] = useState<Record<string,PaymentSummary>>({})
  const [paymentForm,    setPaymentForm]    = useState({ amount:"", method:"BANK_TRANSFER", note:"", totalCost:"", receiptUrl:"" })
  const [showPayForm,    setShowPayForm]    = useState(false)
  const [savingPayment,  setSavingPayment]  = useState(false)
  const [paymentError,   setPaymentError]   = useState("")
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  // Feedback
  const [feedbackOpenId, setFeedbackOpenId] = useState<string|null>(null)
  const [feedbackData,   setFeedbackData]   = useState<Record<string,Feedback>>({})
  const [feedbackForm,   setFeedbackForm]   = useState({ rating:0, comment:"", wouldHire:true })
  const [savingFeedback, setSavingFeedback] = useState(false)
  const [feedbackError,  setFeedbackError]  = useState("")
  const [feedbackSaved,  setFeedbackSaved]  = useState(false)

  // Complaints
  const [complaintOpenId,  setComplaintOpenId]  = useState<string|null>(null)
  const [complaintsData,   setComplaintsData]   = useState<Record<string,Complaint[]>>({})
  const [complaintForm,    setComplaintForm]     = useState({ category:"", description:"" })
  const [savingComplaint,  setSavingComplaint]   = useState(false)
  const [complaintError,   setComplaintError]    = useState("")
  const [showComplaintForm,setShowComplaintForm] = useState(false)
  const [respondingId,     setRespondingId]      = useState<string|null>(null)
  const [respondForm,      setRespondForm]       = useState({ response:"", status:"RESOLVED" })

  // ── Fetch vendors ──────────────────────────

  const fetchVendors = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/vendors`, { headers:getAuthHeaders() })
      if (!res.ok) throw new Error("Failed to load vendors")
      setVendors(await res.json())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally { setLoading(false) }
  }, [eventId])

  useEffect(() => { fetchVendors() }, [fetchVendors])

  // ── Fetch payments for a vendor ────────────

  const fetchPayments = async (vendorId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/vendors/${vendorId}/payments`, { headers:getAuthHeaders() })
      if (res.ok) {
        const d = await res.json()
        setPaymentSummary(prev => ({ ...prev, [vendorId]: d }))
      }
    } catch { /* silent */ }
  }

  // ── Fetch feedback ─────────────────────────

  const fetchFeedback = async (vendorId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/vendors/${vendorId}/feedback`, { headers:getAuthHeaders() })
      if (res.ok) {
        const d = await res.json()
        if (d.feedback) {
          setFeedbackData(prev => ({ ...prev, [vendorId]: d.feedback }))
          setFeedbackForm({
            rating:    d.feedback.plannerRating ?? 0,
            comment:   d.feedback.plannerComment ?? "",
            wouldHire: d.feedback.plannerWouldHire ?? true,
          })
        }
      }
    } catch { /* silent */ }
  }

  // ── Fetch complaints ───────────────────────

  const fetchComplaints = async (vendorId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/vendors/${vendorId}/complaints`, { headers:getAuthHeaders() })
      if (res.ok) {
        const d = await res.json()
        setComplaintsData(prev => ({ ...prev, [vendorId]: d.complaints }))
      }
    } catch { /* silent */ }
  }

  // ── Open panels ────────────────────────────

  const openPayments = (v: Vendor) => {
    setPaymentOpenId(v.id); setShowPayForm(false); setPaymentError("")
    setPaymentForm({ amount:"", method:"BANK_TRANSFER", note:"", totalCost:"", receiptUrl:"" })
    fetchPayments(v.id)
  }

  const openFeedback = (v: Vendor) => {
    setFeedbackOpenId(v.id); setFeedbackError(""); setFeedbackSaved(false)
    fetchFeedback(v.id)
  }

  const openComplaints = (v: Vendor) => {
    setComplaintOpenId(v.id); setShowComplaintForm(false); setComplaintError("")
    setComplaintForm({ category:"", description:"" })
    fetchComplaints(v.id)
  }

  // ── Vendor form ────────────────────────────

  const openAddForm  = () => { setForm({...EMPTY_FORM}); setEditId(null); setFormError(""); setShowForm(true) }
  const openEditForm = (v: Vendor) => {
    setForm({ name:v.name, contactName:v.contactName??"", email:v.email??"", phone:v.phone??"",
      role:v.role, notes:v.notes??"", staffCount:v.staffCount!=null?String(v.staffCount):"",
      canOverrideCapacity:v.canOverrideCapacity })
    setEditId(v.id); setFormError(""); setShowForm(true)
  }
  const closeForm = () => { setShowForm(false); setEditId(null); setFormError("") }

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError("Vendor name is required."); return }
    setSaving(true); setFormError("")
    const body = { name:form.name.trim(), contactName:form.contactName.trim()||null,
      email:form.email.trim()||null, phone:form.phone.trim()||null,
      role:form.role, notes:form.notes.trim()||null,
      staffCount:form.staffCount.trim()?parseInt(form.staffCount,10):null,
      canOverrideCapacity:form.canOverrideCapacity }
    try {
      const url = editId ? `/api/events/${eventId}/vendors/${editId}` : `/api/events/${eventId}/vendors`
      const res = await fetch(url, { method:editId?"PATCH":"POST",
        headers:{"Content-Type":"application/json",...getAuthHeaders()}, body:JSON.stringify(body) })
      if (!res.ok) { const d=await res.json(); setFormError(d.error??"Failed"); return }
      await fetchVendors(); closeForm()
    } catch { setFormError("Network error.") }
    finally { setSaving(false) }
  }

  const handleDelete = async (vendorId: string) => {
    if (!confirm("Remove this vendor?")) return
    setDeleting(vendorId)
    try {
      await fetch(`/api/events/${eventId}/vendors/${vendorId}`, { method:"DELETE", headers:getAuthHeaders() })
      setVendors(prev => prev.filter(v => v.id !== vendorId))
      if (briefOpenId === vendorId)    setBriefOpenId(null)
      if (paymentOpenId === vendorId)  setPaymentOpenId(null)
      if (feedbackOpenId === vendorId) setFeedbackOpenId(null)
      if (complaintOpenId === vendorId)setComplaintOpenId(null)
    } catch { /* silent */ }
    finally { setDeleting(null) }
  }

  // ── Brief ──────────────────────────────────

  const openBrief  = (v: Vendor) => { setBriefForm({ arriveTime:v.arriveTime??"", arriveLocation:v.arriveLocation??"", instructions:v.instructions??"" }); setBriefError(""); setBriefSavedId(null); setBriefOpenId(v.id) }
  const closeBrief = () => { setBriefOpenId(null); setBriefError("") }

  const handleSaveBrief = async (vendorId: string) => {
    setSavingBrief(true); setBriefError("")
    try {
      const res = await fetch(`/api/events/${eventId}/vendors/${vendorId}`, {
        method:"PATCH", headers:{"Content-Type":"application/json",...getAuthHeaders()},
        body:JSON.stringify({ arriveTime:briefForm.arriveTime.trim()||null, arriveLocation:briefForm.arriveLocation.trim()||null, instructions:briefForm.instructions.trim()||null }),
      })
      if (!res.ok) { const d=await res.json(); setBriefError(d.error??"Failed"); return }
      setVendors(prev => prev.map(v => v.id===vendorId ? { ...v, arriveTime:briefForm.arriveTime.trim()||null, arriveLocation:briefForm.arriveLocation.trim()||null, instructions:briefForm.instructions.trim()||null } : v))
      setBriefSavedId(vendorId); setTimeout(()=>setBriefSavedId(null),3000)
    } catch { setBriefError("Network error.") }
    finally  { setSavingBrief(false) }
  }

  // ── Receipt upload ─────────────────────────

  const handleReceiptUpload = async (file: File) => {
    if (!["image/jpeg","image/png","image/webp","application/pdf"].includes(file.type)) {
      setPaymentError("Receipt must be JPEG, PNG, WEBP or PDF."); return
    }
    if (file.size > 5*1024*1024) { setPaymentError("Receipt must be under 5MB."); return }
    setUploadingReceipt(true); setPaymentError("")
    try {
      const fd = new FormData(); fd.append("file",file); fd.append("eventName","payment-receipt")
      const res = await fetch("/api/upload/invitation-card", { method:"POST", headers:getAuthHeaders(), body:fd })
      const d   = await res.json()
      if (!res.ok) { setPaymentError(d.error??"Upload failed"); return }
      setPaymentForm(f => ({ ...f, receiptUrl:d.url }))
    } catch { setPaymentError("Upload failed.") }
    finally { setUploadingReceipt(false) }
  }

  // ── Save payment ───────────────────────────

  const handleSavePayment = async (vendorId: string) => {
    if (!paymentForm.amount || Number(paymentForm.amount)<=0) { setPaymentError("Enter a valid amount."); return }
    if (paymentForm.method==="BANK_TRANSFER" && !paymentForm.receiptUrl) { setPaymentError("Upload receipt for bank transfers."); return }
    setSavingPayment(true); setPaymentError("")
    try {
      const res = await fetch(`/api/events/${eventId}/vendors/${vendorId}/payments`, {
        method:"POST", headers:{"Content-Type":"application/json",...getAuthHeaders()},
        body:JSON.stringify({
          amount:    paymentForm.amount,
          method:    paymentForm.method,
          note:      paymentForm.note.trim()||null,
          receiptUrl:paymentForm.receiptUrl||null,
          totalCost: paymentForm.totalCost ? Number(paymentForm.totalCost) : undefined,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setPaymentError(d.error??"Failed"); return }
      await fetchPayments(vendorId)
      setShowPayForm(false)
      setPaymentForm({ amount:"", method:"BANK_TRANSFER", note:"", totalCost:"", receiptUrl:"" })
    } catch { setPaymentError("Network error.") }
    finally { setSavingPayment(false) }
  }

  // ── Save feedback ──────────────────────────

  const handleSaveFeedback = async (vendorId: string) => {
    if (feedbackForm.rating===0) { setFeedbackError("Please select a rating."); return }
    setSavingFeedback(true); setFeedbackError("")
    try {
      const res = await fetch(`/api/events/${eventId}/vendors/${vendorId}/feedback`, {
        method:"POST", headers:{"Content-Type":"application/json",...getAuthHeaders()},
        body:JSON.stringify({ rating:feedbackForm.rating, comment:feedbackForm.comment, wouldHire:feedbackForm.wouldHire }),
      })
      const d = await res.json()
      if (!res.ok) { setFeedbackError(d.error??"Failed"); return }
      setFeedbackData(prev => ({ ...prev, [vendorId]: d.feedback }))
      setFeedbackSaved(true); setTimeout(()=>setFeedbackSaved(false),3000)
    } catch { setFeedbackError("Network error.") }
    finally { setSavingFeedback(false) }
  }

  // ── Save complaint ─────────────────────────

  const handleSaveComplaint = async (vendorId: string) => {
    if (!complaintForm.category || !complaintForm.description.trim()) {
      setComplaintError("Category and description are required."); return
    }
    setSavingComplaint(true); setComplaintError("")
    try {
      const res = await fetch(`/api/events/${eventId}/vendors/${vendorId}/complaints`, {
        method:"POST", headers:{"Content-Type":"application/json",...getAuthHeaders()},
        body:JSON.stringify({ category:complaintForm.category, description:complaintForm.description }),
      })
      const d = await res.json()
      if (!res.ok) { setComplaintError(d.error??"Failed"); return }
      setComplaintsData(prev => ({ ...prev, [vendorId]: [d.complaint, ...(prev[vendorId]||[])] }))
      setShowComplaintForm(false)
      setComplaintForm({ category:"", description:"" })
    } catch { setComplaintError("Network error.") }
    finally { setSavingComplaint(false) }
  }

  // ── Respond to complaint ───────────────────

  const handleRespondComplaint = async (vendorId: string, complaintId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/vendors/${vendorId}/complaints`, {
        method:"PATCH", headers:{"Content-Type":"application/json",...getAuthHeaders()},
        body:JSON.stringify({ complaintId, status:respondForm.status, response:respondForm.response }),
      })
      if (res.ok) {
        await fetchComplaints(vendorId)
        setRespondingId(null)
      }
    } catch { /* silent */ }
  }

  // ── Copy link ──────────────────────────────

  const copyPortalLink = (portalToken: string, vendorId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/vendor/${portalToken}`)
    setCopiedId(vendorId); setTimeout(()=>setCopiedId(null),2000)
  }

  // ── Render ─────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=DM+Sans:wght@300;400;500&display=swap');
        .vv *,  .vv *::before, .vv *::after { box-sizing: border-box; }

        .vv { max-width:780px; margin:0 auto; padding:1.25rem 1rem 4rem; font-family:'DM Sans',sans-serif; overflow-x:hidden; width:100%; }
        @media(min-width:600px){ .vv { padding:2rem 1.5rem 4rem; } }

        .vv-top { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:1.5rem; flex-wrap:wrap; gap:0.75rem; }
        .vv-back { font-size:0.78rem; color:var(--text-3); text-decoration:none; display:flex; align-items:center; gap:0.35rem; transition:color 0.2s; }
        .vv-back:hover { color:var(--gold); }
        .vv-heading { font-family:'Cormorant Garamond',serif; font-size:clamp(1.375rem,4vw,1.625rem); font-weight:300; color:var(--text); margin-top:0.4rem; }

        .vv-btn-gold  { padding:0.5rem 1rem; background:var(--gold); color:#0a0a0a; border:none; font-family:'DM Sans',sans-serif; font-size:0.78rem; font-weight:500; letter-spacing:0.05em; text-transform:uppercase; cursor:pointer; white-space:nowrap; flex-shrink:0; }
        .vv-btn-gold:disabled { opacity:0.5; cursor:not-allowed; }
        .vv-btn-ghost { padding:0.45rem 0.75rem; background:transparent; border:1px solid var(--border); color:var(--text-2); font-family:'DM Sans',sans-serif; font-size:0.72rem; cursor:pointer; white-space:nowrap; }
        .vv-btn-ghost:hover { border-color:var(--border-hover); color:var(--text); }
        .vv-btn-red   { padding:0.45rem 0.75rem; background:transparent; border:1px solid rgba(239,68,68,0.25); color:rgba(239,68,68,0.6); font-family:'DM Sans',sans-serif; font-size:0.72rem; cursor:pointer; white-space:nowrap; }
        .vv-btn-red:hover { border-color:#ef4444; color:#ef4444; }
        .vv-btn-red:disabled { opacity:0.4; cursor:not-allowed; }
        .vv-btn-sm    { padding:0.3rem 0.6rem; font-size:0.68rem; }

        .vv-list { display:flex; flex-direction:column; gap:0.875rem; }
        .vv-card { background:var(--bg-2); border:1px solid var(--border); padding:1rem; min-width:0; overflow:hidden; }
        .vv-card-top { display:flex; align-items:flex-start; justify-content:space-between; gap:0.75rem; margin-bottom:0.75rem; flex-wrap:wrap; }
        .vv-vendor-name { font-size:0.95rem; font-weight:500; color:var(--text); margin-bottom:0.25rem; word-break:break-word; }
        .vv-vendor-role { display:inline-block; font-size:0.6rem; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; padding:0.2rem 0.6rem; border:1px solid var(--border); color:var(--text-3); }
        .vv-card-actions { display:flex; gap:0.5rem; flex-shrink:0; flex-wrap:wrap; }

        .vv-details { display:flex; flex-wrap:wrap; gap:0.375rem 1.25rem; font-size:0.75rem; color:var(--text-2); margin-bottom:0.75rem; }
        .vv-detail { display:flex; align-items:center; gap:0.35rem; word-break:break-word; }

        .vv-badge-row { display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.75rem; }
        .vv-badge { font-size:0.6rem; font-weight:500; letter-spacing:0.06em; padding:0.2rem 0.5rem; border-radius:99px; border:1px solid; white-space:nowrap; }
        .vv-badge-staff    { color:#4a9eff; border-color:rgba(74,158,255,0.3); background:rgba(74,158,255,0.08); }
        .vv-badge-override { color:#f59e0b; border-color:rgba(245,158,11,0.3); background:rgba(245,158,11,0.08); }
        .vv-badge-accessed { color:#22c55e; border-color:rgba(34,197,94,0.3); background:rgba(34,197,94,0.08); }
        .vv-badge-brief    { color:#a78bfa; border-color:rgba(167,139,250,0.3); background:rgba(167,139,250,0.08); }

        .vv-link-row { display:flex; gap:0.5rem; min-width:0; }
        .vv-link-val { flex:1; min-width:0; padding:0.45rem 0.75rem; background:var(--bg); border:1px solid var(--border); font-size:0.7rem; color:var(--text-3); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

        /* Section bars */
        .vv-section-bar { display:flex; align-items:center; justify-content:space-between; gap:0.75rem; margin-top:0.875rem; padding-top:0.875rem; border-top:1px solid var(--border); flex-wrap:wrap; }
        .vv-section-label { font-size:0.6rem; font-weight:500; letter-spacing:0.12em; text-transform:uppercase; color:var(--text-3); margin-bottom:0.2rem; }
        .vv-section-preview { font-size:0.75rem; color:var(--text-2); }
        .vv-section-empty   { font-size:0.75rem; color:var(--text-3); font-style:italic; }

        /* Expanding panels */
        .vv-panel { margin-top:0.875rem; padding:1.125rem; background:var(--bg-3); border:1px solid var(--border); }
        .vv-panel-title { font-size:0.6rem; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--gold); margin-bottom:1rem; }

        /* Payment summary card */
        .vv-pay-summary { display:flex; gap:0.625rem; margin-bottom:1rem; flex-wrap:wrap; }
        .vv-pay-stat { flex:1; min-width:80px; background:var(--bg-2); border:1px solid var(--border); padding:0.75rem; text-align:center; }
        .vv-pay-stat-num   { font-family:'Cormorant Garamond',serif; font-size:1.25rem; font-weight:300; color:var(--gold); margin-bottom:0.2rem; }
        .vv-pay-stat-label { font-size:0.55rem; color:var(--text-3); letter-spacing:0.08em; text-transform:uppercase; }

        /* Payment rows */
        .vv-pay-row { padding:0.625rem 0; border-bottom:1px solid var(--border); display:flex; align-items:flex-start; justify-content:space-between; gap:0.75rem; min-width:0; }
        .vv-pay-row:last-child { border-bottom:none; }
        .vv-pay-method { font-size:0.68rem; color:var(--text-3); margin-top:0.15rem; }
        .vv-pay-amount { font-family:'Cormorant Garamond',serif; font-size:1.125rem; font-weight:300; color:var(--text); flex-shrink:0; }
        .vv-pay-status-tag { font-size:0.6rem; font-weight:500; padding:0.15rem 0.45rem; border-radius:99px; border:1px solid; white-space:nowrap; }

        /* Payment form */
        .vv-pay-form { background:var(--bg-2); border:1px solid var(--border); padding:1rem; margin-top:0.875rem; }
        .vv-pay-form-title { font-size:0.6rem; font-weight:500; letter-spacing:0.15em; text-transform:uppercase; color:var(--gold); margin-bottom:0.875rem; }
        .vv-form-grid { display:grid; grid-template-columns:1fr; gap:0.625rem; }
        @media(min-width:480px){ .vv-form-grid { grid-template-columns:1fr 1fr; } }
        .vv-field     { display:flex; flex-direction:column; gap:0.3rem; min-width:0; }
        .vv-field.full{ grid-column:1/-1; }
        .vv-label     { font-size:0.63rem; color:var(--text-3); letter-spacing:0.06em; text-transform:uppercase; }
        .vv-input,.vv-select,.vv-textarea {
          padding:0.55rem 0.75rem; background:var(--bg-3); border:1px solid var(--border);
          color:var(--text); font-family:'DM Sans',sans-serif; font-size:0.82rem;
          outline:none; transition:border-color 0.2s; width:100%;
        }
        .vv-input:focus,.vv-select:focus,.vv-textarea:focus { border-color:var(--gold); }
        .vv-textarea { resize:vertical; min-height:72px; }
        .vv-form-footer { display:flex; gap:0.5rem; justify-content:flex-end; margin-top:0.875rem; flex-wrap:wrap; }
        .vv-form-error  { font-size:0.72rem; color:#ef4444; margin-top:0.5rem; }
        .vv-success     { font-size:0.72rem; color:#22c55e; margin-top:0.35rem; }

        /* Stars */
        .vv-stars { display:flex; gap:0.5rem; margin-bottom:0.875rem; }
        .vv-star  { font-size:1.625rem; cursor:pointer; line-height:1; -webkit-tap-highlight-color:transparent; transition:transform 0.1s; }
        .vv-star:hover { transform:scale(1.12); }
        .vv-star-on  { color:var(--gold); }
        .vv-star-off { color:var(--border); }

        /* Complaint chips */
        .vv-chips { display:flex; gap:0.375rem; flex-wrap:wrap; margin-bottom:0.625rem; }
        .vv-chip  { padding:0.3rem 0.625rem; font-size:0.72rem; border:1px solid var(--border); color:var(--text-2); cursor:pointer; transition:all 0.15s; background:transparent; font-family:'DM Sans',sans-serif; }
        .vv-chip.on { border-color:var(--gold); color:var(--gold); background:rgba(180,140,60,0.08); }

        /* Complaint thread */
        .vv-complaint-item { padding:0.875rem; border:1px solid var(--border); margin-bottom:0.625rem; }
        .vv-complaint-item:last-child { margin-bottom:0; }
        .vv-complaint-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:0.5rem; gap:0.5rem; flex-wrap:wrap; }
        .vv-complaint-cat   { font-size:0.68rem; font-weight:500; color:var(--text-2); }
        .vv-complaint-by    { font-size:0.6rem; color:var(--text-3); }
        .vv-complaint-desc  { font-size:0.78rem; color:var(--text-2); line-height:1.6; margin-bottom:0.5rem; }
        .vv-complaint-status { font-size:0.6rem; font-weight:500; letter-spacing:0.06em; padding:0.15rem 0.45rem; border-radius:99px; border:1px solid; }
        .vv-status-open { color:#ef4444; border-color:rgba(239,68,68,0.3); background:rgba(239,68,68,0.08); }
        .vv-status-disc { color:#f59e0b; border-color:rgba(245,158,11,0.3); background:rgba(245,158,11,0.08); }
        .vv-status-res  { color:#22c55e; border-color:rgba(34,197,94,0.3); background:rgba(34,197,94,0.08); }

        /* Brief */
        .vv-brief-bar   { display:flex; align-items:flex-start; justify-content:space-between; gap:0.75rem; margin-top:0.875rem; padding-top:0.875rem; border-top:1px solid var(--border); flex-wrap:wrap; }
        .vv-brief-grid  { display:grid; grid-template-columns:1fr; gap:0.75rem; }
        @media(min-width:480px){ .vv-brief-grid { grid-template-columns:1fr 1fr; } }
        .vv-brief-footer{ display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; }

        /* Empty states */
        .vv-empty { padding:2.5rem 1.25rem; text-align:center; border:1px dashed var(--border); }
        .vv-empty-title { font-family:'Cormorant Garamond',serif; font-size:1.25rem; font-weight:300; color:var(--text-2); margin-bottom:0.5rem; }
        .vv-empty-desc  { font-size:0.8rem; color:var(--text-3); margin-bottom:1.25rem; line-height:1.6; }

        /* Receipt */
        .vv-receipt-row { display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; }
        .vv-receipt-preview { font-size:0.7rem; color:var(--gold); text-decoration:none; border:1px solid rgba(180,140,60,0.3); padding:0.3rem 0.625rem; display:inline-flex; align-items:center; gap:0.35rem; }

        /* Feedback card for vendor's response */
        .vv-vendor-said { margin-top:0.875rem; padding:0.875rem; background:var(--bg-2); border:1px solid var(--border); border-left:3px solid var(--gold); }
        .vv-vendor-said-label { font-size:0.58rem; font-weight:500; letter-spacing:0.12em; text-transform:uppercase; color:var(--gold); margin-bottom:0.5rem; }
      `}</style>

      <div className="vv">
        <div className="vv-top">
          <div>
            <Link href={`/events/${eventId}`} className="vv-back">← Back to event</Link>
            <h1 className="vv-heading">Vendors</h1>
          </div>
          <button className="vv-btn-gold" onClick={openAddForm}>+ Add Vendor</button>
        </div>

        {/* Add/Edit form */}
        {showForm && (
          <div className="vv-panel" style={{ marginBottom:"1.25rem" }}>
            <div className="vv-panel-title">{editId?"Edit vendor":"Add vendor"}</div>
            <div className="vv-form-grid">
              <div className="vv-field">
                <label className="vv-label">Vendor / company name *</label>
                <input className="vv-input" placeholder="e.g. Lagos Catering Co." value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
              </div>
              <div className="vv-field">
                <label className="vv-label">Role *</label>
                <select className="vv-select" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                  {VENDOR_ROLES.map(r=><option key={r} value={r}>{roleLabel(r)}</option>)}
                </select>
              </div>
              <div className="vv-field">
                <label className="vv-label">Contact person</label>
                <input className="vv-input" placeholder="Full name" value={form.contactName} onChange={e=>setForm(f=>({...f,contactName:e.target.value}))} />
              </div>
              <div className="vv-field">
                <label className="vv-label">Number of staff</label>
                <input className="vv-input" type="number" min="0" placeholder="e.g. 5" value={form.staffCount} onChange={e=>setForm(f=>({...f,staffCount:e.target.value}))} />
              </div>
              <div className="vv-field">
                <label className="vv-label">Email</label>
                <input className="vv-input" type="email" placeholder="vendor@example.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} />
              </div>
              <div className="vv-field">
                <label className="vv-label">Phone</label>
                <input className="vv-input" type="tel" placeholder="+234 800 000 0000" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} />
              </div>
              <div className="vv-field full">
                <label style={{ display:"flex",alignItems:"flex-start",gap:"0.625rem",fontSize:"0.8rem",color:"var(--text-2)",cursor:"pointer",lineHeight:1.5 }}>
                  <input type="checkbox" checked={form.canOverrideCapacity} style={{ marginTop:2,flexShrink:0 }} onChange={e=>setForm(f=>({...f,canOverrideCapacity:e.target.checked}))} />
                  Allow this vendor to activate walk-in mode (bypass venue capacity)
                </label>
              </div>
            </div>
            {formError && <div className="vv-form-error">{formError}</div>}
            <div className="vv-form-footer">
              <button className="vv-btn-ghost" onClick={closeForm}>Cancel</button>
              <button className="vv-btn-gold" onClick={handleSave} disabled={saving}>{saving?"Saving…":editId?"Save changes":"Add vendor"}</button>
            </div>
          </div>
        )}

        {loading && <p style={{ fontSize:"0.82rem",color:"var(--text-3)" }}>Loading vendors…</p>}
        {error   && <p style={{ fontSize:"0.82rem",color:"#ef4444" }}>{error}</p>}

        {!loading && !error && vendors.length===0 && !showForm && (
          <div className="vv-empty">
            <div className="vv-empty-title">No vendors yet</div>
            <div className="vv-empty-desc">Add caterers, security, media and other event crew. Each gets a private portal link and their own brief.</div>
            <button className="vv-btn-gold" onClick={openAddForm}>+ Add first vendor</button>
          </div>
        )}

        {!loading && vendors.length>0 && (
          <div className="vv-list">
            {vendors.map(vendor => {
              const portalLink   = `${typeof window!=="undefined"?window.location.origin:""}/vendor/${vendor.portalToken}`
              const hasBrief     = !!(vendor.arriveTime||vendor.arriveLocation||vendor.instructions)
              const isBriefOpen  = briefOpenId===vendor.id
              const isPayOpen    = paymentOpenId===vendor.id
              const isFeedOpen   = feedbackOpenId===vendor.id
              const isComplOpen  = complaintOpenId===vendor.id
              const ps           = paymentSummary[vendor.id]
              const payStatus    = ps ? vendorPaymentStatus(ps.totalCost, ps.totalPaid) : null
              const fb           = feedbackData[vendor.id]
              const complaints   = complaintsData[vendor.id] || []
              const openCount    = complaints.filter(c=>c.status==="OPEN").length

              return (
                <div className="vv-card" key={vendor.id}>

                  {/* Header */}
                  <div className="vv-card-top">
                    <div style={{ minWidth:0 }}>
                      <div className="vv-vendor-name">{vendor.name}</div>
                      <span className="vv-vendor-role">{roleLabel(vendor.role)}</span>
                    </div>
                    <div className="vv-card-actions">
                      <button className="vv-btn-ghost vv-btn-sm" onClick={()=>openEditForm(vendor)}>Edit</button>
                      <button className="vv-btn-red vv-btn-sm" onClick={()=>handleDelete(vendor.id)} disabled={deleting===vendor.id}>{deleting===vendor.id?"…":"Remove"}</button>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="vv-details">
                    {vendor.contactName && <span className="vv-detail">👤 {vendor.contactName}</span>}
                    {vendor.phone       && <span className="vv-detail">📞 {vendor.phone}</span>}
                    {vendor.email       && <span className="vv-detail">✉ {vendor.email}</span>}
                  </div>

                  {/* Badges */}
                  <div className="vv-badge-row">
                    {vendor.staffCount!=null && <span className="vv-badge vv-badge-staff">{vendor.staffCount} staff</span>}
                    {vendor.canOverrideCapacity && <span className="vv-badge vv-badge-override">Walk-in override</span>}
                    {hasBrief && <span className="vv-badge vv-badge-brief">Brief written</span>}
                    {payStatus && <span className="vv-badge" style={{ color:payStatus.color, borderColor:`${payStatus.color}44`, background:`${payStatus.color}11` }}>{payStatus.label}</span>}
                    {openCount>0 && <span className="vv-badge" style={{ color:"#ef4444", borderColor:"rgba(239,68,68,0.3)", background:"rgba(239,68,68,0.08)" }}>⚑ {openCount} open concern{openCount!==1?"s":""}</span>}
                    {vendor.lastAccessed && <span className="vv-badge vv-badge-accessed">Portal accessed {new Date(vendor.lastAccessed).toLocaleDateString("en-NG")}</span>}
                  </div>

                  {/* Portal link */}
                  <div className="vv-link-row">
                    <div className="vv-link-val">{portalLink}</div>
                    <button className="vv-btn-ghost" style={{ borderColor:copiedId===vendor.id?"#22c55e":undefined, color:copiedId===vendor.id?"#22c55e":undefined }} onClick={()=>copyPortalLink(vendor.portalToken,vendor.id)}>
                      {copiedId===vendor.id?"✓ Copied":"Copy link"}
                    </button>
                  </div>

                  {/* ── Action bars ── */}

                  {/* Payments */}
                  <div className="vv-section-bar">
                    <div style={{ flex:1,minWidth:0 }}>
                      <div className="vv-section-label">Payments</div>
                      {ps ? (
                        <div className="vv-section-preview">
                          Paid {fmtNGN(ps.totalPaid)}{ps.totalCost?` of ${fmtNGN(ps.totalCost)}`:""}
                          {ps.balance && Number(ps.balance)>0 ? ` · Balance ${fmtNGN(ps.balance)}` : ""}
                        </div>
                      ) : <div className="vv-section-empty">No payments logged</div>}
                    </div>
                    <button className="vv-btn-ghost vv-btn-sm" style={{ flexShrink:0 }} onClick={()=>isPayOpen?setPaymentOpenId(null):openPayments(vendor)}>
                      {isPayOpen?"Close":"Manage"}
                    </button>
                  </div>

                  {isPayOpen && (
                    <div className="vv-panel">
                      <div className="vv-panel-title">Payment tracking — {vendor.name}</div>

                      {ps && (
                        <div className="vv-pay-summary">
                          <div className="vv-pay-stat"><div className="vv-pay-stat-num">{fmtNGN(ps.totalCost)}</div><div className="vv-pay-stat-label">Total cost</div></div>
                          <div className="vv-pay-stat"><div className="vv-pay-stat-num">{fmtNGN(ps.totalPaid)}</div><div className="vv-pay-stat-label">Total paid</div></div>
                          <div className="vv-pay-stat">
                            <div className="vv-pay-stat-num" style={{ color:ps.balance&&Number(ps.balance)>0?"#f59e0b":"#22c55e" }}>
                              {ps.balance===null?"—":Number(ps.balance)>0?fmtNGN(ps.balance):"Fully paid"}
                            </div>
                            <div className="vv-pay-stat-label">Balance</div>
                          </div>
                        </div>
                      )}

                      {/* Payment history */}
                      {ps?.payments.length===0 && <p style={{ fontSize:"0.78rem",color:"var(--text-3)",marginBottom:"0.875rem" }}>No payments logged yet.</p>}
                      {ps?.payments.map(p => {
                        const tag = paymentStatusTag(p.status)
                        return (
                          <div className="vv-pay-row" key={p.id}>
                            <div style={{ minWidth:0 }}>
                              <div style={{ fontSize:"0.82rem",color:"var(--text)",fontWeight:500 }}>{fmtNGN(p.amount)}</div>
                              <div className="vv-pay-method">{p.method==="BANK_TRANSFER"?"Bank Transfer":"Cash"} · {new Date(p.createdAt).toLocaleDateString("en-NG",{day:"numeric",month:"short"})}</div>
                              {p.note && <div style={{ fontSize:"0.7rem",color:"var(--text-3)",marginTop:"0.15rem" }}>{p.note}</div>}
                              {p.receiptUrl && <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="vv-receipt-preview" style={{ marginTop:"0.35rem",display:"inline-flex" }}>📎 View receipt</a>}
                              {p.status==="DISPUTED" && p.disputeNote && <div style={{ fontSize:"0.7rem",color:"#ef4444",marginTop:"0.25rem" }}>⚑ {p.disputeNote}</div>}
                            </div>
                            <span className="vv-pay-status-tag" style={{ color:tag.color, borderColor:tag.border, background:tag.bg }}>{tag.label}</span>
                          </div>
                        )
                      })}

                      {/* Add payment button */}
                      {!showPayForm && (
                        <button className="vv-btn-ghost" style={{ width:"100%",marginTop:"0.875rem" }} onClick={()=>{setShowPayForm(true);setPaymentError("")}}>
                          + Log a payment
                        </button>
                      )}

                      {/* Add payment form */}
                      {showPayForm && (
                        <div className="vv-pay-form">
                          <div className="vv-pay-form-title">Log payment</div>
                          <div className="vv-form-grid">
                            <div className="vv-field">
                              <label className="vv-label">Total project cost (₦)</label>
                              <input className="vv-input" type="number" placeholder="e.g. 150000" value={paymentForm.totalCost} onChange={e=>setPaymentForm(f=>({...f,totalCost:e.target.value}))} />
                            </div>
                            <div className="vv-field">
                              <label className="vv-label">Amount paid *</label>
                              <input className="vv-input" type="number" placeholder="e.g. 50000" value={paymentForm.amount} onChange={e=>setPaymentForm(f=>({...f,amount:e.target.value}))} />
                            </div>
                            <div className="vv-field">
                              <label className="vv-label">Payment method *</label>
                              <select className="vv-select" value={paymentForm.method} onChange={e=>setPaymentForm(f=>({...f,method:e.target.value}))}>
                                <option value="BANK_TRANSFER">Bank Transfer</option>
                                <option value="CASH">Cash</option>
                              </select>
                            </div>
                            <div className="vv-field">
                              <label className="vv-label">Note (optional)</label>
                              <input className="vv-input" placeholder="e.g. First instalment" value={paymentForm.note} onChange={e=>setPaymentForm(f=>({...f,note:e.target.value}))} />
                            </div>
                            <div className="vv-field full">
                              <label className="vv-label">Receipt {paymentForm.method==="BANK_TRANSFER"?"(required)":"(optional)"}</label>
                              <input ref={receiptInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display:"none" }} onChange={e=>{const f=e.target.files?.[0];if(f)handleReceiptUpload(f)}} />
                              {paymentForm.receiptUrl ? (
                                <div className="vv-receipt-row">
                                  <a href={paymentForm.receiptUrl} target="_blank" rel="noopener noreferrer" className="vv-receipt-preview">📎 Receipt uploaded</a>
                                  <button className="vv-btn-ghost vv-btn-sm" onClick={()=>setPaymentForm(f=>({...f,receiptUrl:""}))}>Remove</button>
                                </div>
                              ) : (
                                <button className="vv-btn-ghost" onClick={()=>receiptInputRef.current?.click()} disabled={uploadingReceipt}>
                                  {uploadingReceipt?"Uploading…":"Upload receipt"}
                                </button>
                              )}
                            </div>
                          </div>
                          {paymentError && <div className="vv-form-error">{paymentError}</div>}
                          <div className="vv-form-footer">
                            <button className="vv-btn-ghost" onClick={()=>{setShowPayForm(false);setPaymentError("")}}>Cancel</button>
                            <button className="vv-btn-gold" onClick={()=>handleSavePayment(vendor.id)} disabled={savingPayment}>{savingPayment?"Saving…":"Log payment"}</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Brief */}
                  <div className="vv-brief-bar">
                    <div style={{ flex:1,minWidth:0 }}>
                      <div className="vv-section-label">Vendor brief</div>
                      {hasBrief
                        ? <div className="vv-section-preview" style={{ overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{[vendor.arriveTime,vendor.arriveLocation,vendor.instructions].filter(Boolean).join(" · ")}</div>
                        : <div className="vv-section-empty">No brief written yet</div>}
                    </div>
                    <button className="vv-btn-ghost vv-btn-sm" style={{ flexShrink:0 }} onClick={()=>isBriefOpen?closeBrief():openBrief(vendor)}>
                      {isBriefOpen?"Close":hasBrief?"Edit brief":"Write brief"}
                    </button>
                  </div>

                  {isBriefOpen && (
                    <div className="vv-panel">
                      <div className="vv-panel-title">Brief for {vendor.name}</div>
                      <p style={{ fontSize:"0.72rem",color:"var(--text-3)",marginBottom:"0.875rem",lineHeight:1.6 }}>Only <strong>{vendor.name}</strong> sees this on their portal.</p>
                      <div className="vv-brief-grid">
                        <div className="vv-field">
                          <label className="vv-label">Arrival time</label>
                          <input className="vv-input" placeholder="e.g. 12:00 PM" value={briefForm.arriveTime} onChange={e=>setBriefForm(f=>({...f,arriveTime:e.target.value}))} />
                        </div>
                        <div className="vv-field">
                          <label className="vv-label">Arrival location</label>
                          <input className="vv-input" placeholder="e.g. Couple's residence, Lekki" value={briefForm.arriveLocation} onChange={e=>setBriefForm(f=>({...f,arriveLocation:e.target.value}))} />
                        </div>
                        <div className="vv-field" style={{ gridColumn:"1/-1" }}>
                          <label className="vv-label">Instructions</label>
                          <textarea className="vv-textarea" style={{ minHeight:"90px" }} placeholder="Detailed instructions…" value={briefForm.instructions} onChange={e=>setBriefForm(f=>({...f,instructions:e.target.value}))} />
                        </div>
                      </div>
                      <div className="vv-brief-footer">
                        <div>
                          {briefError           && <div className="vv-form-error">{briefError}</div>}
                          {briefSavedId===vendor.id && <div className="vv-success">✓ Brief saved</div>}
                        </div>
                        <div style={{ display:"flex",gap:"0.5rem" }}>
                          <button className="vv-btn-ghost" onClick={closeBrief}>Cancel</button>
                          <button className="vv-btn-gold" onClick={()=>handleSaveBrief(vendor.id)} disabled={savingBrief}>{savingBrief?"Saving…":"Save brief"}</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Feedback */}
                  <div className="vv-section-bar">
                    <div style={{ flex:1,minWidth:0 }}>
                      <div className="vv-section-label">Feedback</div>
                      {fb?.plannerRating
                        ? <div className="vv-section-preview">{"★".repeat(fb.plannerRating)}{"☆".repeat(5-fb.plannerRating)} · {fb.plannerWouldHire?"Would hire again":"Would not rehire"}</div>
                        : <div className="vv-section-empty">No feedback given yet</div>}
                    </div>
                    <button className="vv-btn-ghost vv-btn-sm" style={{ flexShrink:0 }} onClick={()=>isFeedOpen?setFeedbackOpenId(null):openFeedback(vendor)}>
                      {isFeedOpen?"Close":fb?.plannerRating?"Edit feedback":"Give feedback"}
                    </button>
                  </div>

                  {isFeedOpen && (
                    <div className="vv-panel">
                      <div className="vv-panel-title">Your feedback for {vendor.name}</div>
                      <div className="vv-stars">
                        {[1,2,3,4,5].map(s=>(
                          <span key={s} className={`vv-star ${s<=feedbackForm.rating?"vv-star-on":"vv-star-off"}`} onClick={()=>setFeedbackForm(f=>({...f,rating:s}))}>★</span>
                        ))}
                      </div>
                      <div className="vv-field" style={{ marginBottom:"0.75rem" }}>
                        <label className="vv-label">Comment (optional)</label>
                        <textarea className="vv-textarea" placeholder="How did they perform?" value={feedbackForm.comment} onChange={e=>setFeedbackForm(f=>({...f,comment:e.target.value}))} />
                      </div>
                      <label style={{ display:"flex",alignItems:"center",gap:"0.5rem",fontSize:"0.8rem",color:"var(--text-2)",cursor:"pointer",marginBottom:"0.875rem" }}>
                        <input type="checkbox" checked={feedbackForm.wouldHire} onChange={e=>setFeedbackForm(f=>({...f,wouldHire:e.target.checked}))} />
                        👍 Would hire again
                      </label>

                      {/* Vendor's response (read-only) */}
                      {fb?.vendorRating && (
                        <div className="vv-vendor-said">
                          <div className="vv-vendor-said-label">Vendor's feedback about this event</div>
                          <div style={{ fontSize:"0.75rem",color:"var(--text-2)",marginBottom:"0.25rem" }}>{"★".repeat(fb.vendorRating)}{"☆".repeat(5-fb.vendorRating)}</div>
                          {fb.vendorComment && <div style={{ fontSize:"0.75rem",color:"var(--text-2)",lineHeight:1.6,fontStyle:"italic" }}>"{fb.vendorComment}"</div>}
                          {fb.vendorWouldWork!==null && <div style={{ fontSize:"0.7rem",color:"var(--text-3)",marginTop:"0.25rem" }}>{fb.vendorWouldWork?"Would work again":"Would not work again"}</div>}
                        </div>
                      )}

                      {feedbackError && <div className="vv-form-error">{feedbackError}</div>}
                      {feedbackSaved && <div className="vv-success">✓ Feedback saved</div>}
                      <div className="vv-form-footer">
                        <button className="vv-btn-ghost" onClick={()=>setFeedbackOpenId(null)}>Close</button>
                        <button className="vv-btn-gold" onClick={()=>handleSaveFeedback(vendor.id)} disabled={savingFeedback||feedbackForm.rating===0}>{savingFeedback?"Saving…":"Save feedback"}</button>
                      </div>
                    </div>
                  )}

                  {/* Complaints */}
                  <div className="vv-section-bar">
                    <div style={{ flex:1,minWidth:0 }}>
                      <div className="vv-section-label">Concerns</div>
                      {complaints.length>0
                        ? <div className="vv-section-preview">{complaints.length} concern{complaints.length!==1?"s":""} · {openCount>0?`${openCount} open`:"all resolved"}</div>
                        : <div className="vv-section-empty">No concerns raised</div>}
                    </div>
                    <button className="vv-btn-ghost vv-btn-sm" style={{ flexShrink:0 }} onClick={()=>isComplOpen?setComplaintOpenId(null):openComplaints(vendor)}>
                      {isComplOpen?"Close":"Manage"}
                    </button>
                  </div>

                  {isComplOpen && (
                    <div className="vv-panel">
                      <div className="vv-panel-title">Concerns — {vendor.name}</div>

                      {complaints.map(c => {
                        const statusCls = c.status==="OPEN"?"vv-status-open":c.status==="IN_DISCUSSION"?"vv-status-disc":"vv-status-res"
                        const isResponding = respondingId===c.id
                        return (
                          <div className="vv-complaint-item" key={c.id}>
                            <div className="vv-complaint-header">
                              <div>
                                <div className="vv-complaint-cat">{c.category}</div>
                                <div className="vv-complaint-by">Raised by {c.raisedBy==="PLANNER"?"you":"vendor"} · {new Date(c.createdAt).toLocaleDateString("en-NG",{day:"numeric",month:"short"})}</div>
                              </div>
                              <span className={`vv-complaint-status ${statusCls}`}>{c.status==="IN_DISCUSSION"?"In discussion":c.status.charAt(0)+c.status.slice(1).toLowerCase()}</span>
                            </div>
                            <div className="vv-complaint-desc">{c.description}</div>
                            {c.response && <div style={{ fontSize:"0.75rem",color:"var(--text-2)",padding:"0.5rem 0.75rem",background:"var(--bg-2)",borderLeft:"2px solid var(--gold)",lineHeight:1.6,marginBottom:"0.5rem" }}>Response: {c.response}</div>}
                            {c.status!=="RESOLVED" && !isResponding && (
                              <button className="vv-btn-ghost vv-btn-sm" onClick={()=>{setRespondingId(c.id);setRespondForm({response:"",status:"RESOLVED"})}}>Respond / Resolve</button>
                            )}
                            {isResponding && (
                              <div style={{ display:"flex",flexDirection:"column",gap:"0.5rem",marginTop:"0.5rem" }}>
                                <textarea className="vv-textarea" placeholder="Your response…" style={{ minHeight:"60px" }} value={respondForm.response} onChange={e=>setRespondForm(f=>({...f,response:e.target.value}))} />
                                <select className="vv-select" value={respondForm.status} onChange={e=>setRespondForm(f=>({...f,status:e.target.value}))}>
                                  <option value="IN_DISCUSSION">Mark as In Discussion</option>
                                  <option value="RESOLVED">Mark as Resolved</option>
                                </select>
                                <div style={{ display:"flex",gap:"0.5rem" }}>
                                  <button className="vv-btn-gold" style={{ flex:1,padding:"0.45rem" }} onClick={()=>handleRespondComplaint(vendor.id,c.id)}>Save response</button>
                                  <button className="vv-btn-ghost" onClick={()=>setRespondingId(null)}>Cancel</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {!showComplaintForm && (
                        <button className="vv-btn-ghost" style={{ width:"100%",marginTop:complaints.length>0?"0.875rem":"0" }} onClick={()=>setShowComplaintForm(true)}>
                          + Raise a concern
                        </button>
                      )}

                      {showComplaintForm && (
                        <div style={{ marginTop:"0.875rem" }}>
                          <div className="vv-label" style={{ marginBottom:"0.5rem" }}>Category</div>
                          <div className="vv-chips">
                            {PLANNER_COMPLAINT_CATS.map(cat=>(
                              <button key={cat} className={`vv-chip${complaintForm.category===cat?" on":""}`} onClick={()=>setComplaintForm(f=>({...f,category:cat}))}>{cat}</button>
                            ))}
                          </div>
                          <textarea className="vv-textarea" placeholder="Describe the issue in 2-3 lines…" value={complaintForm.description} onChange={e=>setComplaintForm(f=>({...f,description:e.target.value}))} style={{ marginBottom:"0.5rem" }} />
                          {complaintError && <div className="vv-form-error">{complaintError}</div>}
                          <div style={{ display:"flex",gap:"0.5rem" }}>
                            <button className="vv-btn-gold" style={{ flex:1 }} onClick={()=>handleSaveComplaint(vendor.id)} disabled={savingComplaint}>{savingComplaint?"Saving…":"Raise concern"}</button>
                            <button className="vv-btn-ghost" onClick={()=>{setShowComplaintForm(false);setComplaintError("")}}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
