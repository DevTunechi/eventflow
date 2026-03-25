"use client"
// src/app/vendor/[portalToken]/page.tsx
// Updated: + Payment history + Acknowledge/Dispute
//          + Vendor→Planner feedback
//          + Complaints
//          + Shareable achievement card

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import html2canvas from "html2canvas"

interface TimelineItem { id:string; time:string; title:string; description:string|null; sortOrder:number }
interface StaffMember  { id:string; name:string; phone:string|null; qrToken:string; checkedIn:boolean; checkedInAt:string|null }
interface TallyItem    { menuItemId:string; name:string; category:string; totalOrders:number }
interface VendorStaffCount { name:string; role:string; staffAllotted:number; staffRegistered:number }

interface VendorPayment {
  id:string; amount:string; method:string; note:string|null
  receiptUrl:string|null; status:string; acknowledgedAt:string|null
  disputedAt:string|null; disputeNote:string|null; createdAt:string
}

interface PaymentSummary {
  payments:VendorPayment[]; totalCost:string|null
  totalPaid:string; balance:string|null
}

interface VendorPortalData {
  vendor: {
    id:string; name:string; contactName:string|null; role:string
    arriveTime:string|null; arriveLocation:string|null; instructions:string|null
    notes:string|null; staffCount:number|null; staffRegistered:number
    canOverrideCapacity:boolean; capacityOverrideActive:boolean
    staff:StaffMember[]
    existingFeedback:{ rating:number; message:string|null }|null
  }
  event: {
    id:string; name:string; eventDate:string
    startTime:string|null; endTime:string|null
    venueName:string|null; venueAddress:string|null; status:string
    plannerName:string|null; plannerPhone:string|null; plannerEmail:string|null
    timeline:TimelineItem[]
  }
  stats:          { totalGuests:number; checkedIn:number; pending:number }
  foodTallies:    TallyItem[]
  drinkTallies:   TallyItem[]
  allVendorStaff: VendorStaffCount[]
  expiry:         { isExpired:boolean; isInFeedbackWindow:boolean; expiresAt:string }
}

function roleLabel(role:string):string {
  const map:Record<string,string>={CATERER:"Caterer",SECURITY:"Security",MEDIA:"Media",LIVE_BAND:"Live Band",DJ:"DJ",MC:"MC",HYPEMAN:"Hypeman",AFTER_PARTY:"After Party",DRINK_VENDOR:"Drinks",DECORATOR:"Decorator",PHOTOGRAPHER:"Photographer",VIDEOGRAPHER:"Videographer",OTHER:"Vendor"}
  return map[role]??role
}

const fmtNGN = (v:string|null|undefined) => v ? `₦${Number(v).toLocaleString("en-NG")}` : "—"

const VENDOR_COMPLAINT_CATS = [
  "Late payment","Poor communication","Scope change","Safety concern","Unprofessional conduct","Other",
]

// Milestone thresholds for achievement cards
const MILESTONES = [
  { key:"first",   label:"First Event Completed", icon:"🎉", check:(rating:number,events:number)=>events>=1 },
  { key:"five",    label:"5 Events Strong",        icon:"🏅", check:(rating:number,events:number)=>events>=5 },
  { key:"ten",     label:"EventFlow Veteran",       icon:"🔥", check:(rating:number,events:number)=>events>=10 },
  { key:"toprated",label:"Top Rated Vendor",        icon:"🌟", check:(rating:number,events:number)=>rating>=4.5 },
]

export default function VendorPortalPage() {
  const { portalToken } = useParams<{ portalToken:string }>()

  const [data,     setData]     = useState<VendorPortalData|null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string|null>(null)
  const [expired,  setExpired]  = useState(false)
  const [expiredEventName, setExpiredEventName] = useState("")

  // Payments
  const [payments,      setPayments]      = useState<PaymentSummary|null>(null)
  const [loadingPay,    setLoadingPay]    = useState(false)
  const [actingPayId,   setActingPayId]   = useState<string|null>(null)
  const [disputeFormId, setDisputeFormId] = useState<string|null>(null)
  const [disputeNote,   setDisputeNote]   = useState("")
  const [payError,      setPayError]      = useState("")

  // Staff
  const [staffForm,     setStaffForm]     = useState({ name:"", phone:"" })
  const [addingStaff,   setAddingStaff]   = useState(false)
  const [showStaffForm, setShowStaffForm] = useState(false)
  const [staffError,    setStaffError]    = useState("")
  const [removingId,    setRemovingId]    = useState<string|null>(null)

  // Feedback (vendor→planner)
  const [feedbackRating,     setFeedbackRating]     = useState(0)
  const [feedbackMessage,    setFeedbackMessage]    = useState("")
  const [feedbackWouldWork,  setFeedbackWouldWork]  = useState(true)
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [feedbackDone,       setFeedbackDone]       = useState(false)
  const [feedbackError,      setFeedbackError]      = useState("")

  // Planner feedback (read-only for vendor)
  const [plannerFeedback, setPlannerFeedback] = useState<{rating:number;comment:string|null;wouldHire:boolean|null}|null>(null)

  // Complaints
  const [showComplaintForm, setShowComplaintForm] = useState(false)
  const [complaintCat,      setComplaintCat]      = useState("")
  const [complaintDesc,     setComplaintDesc]     = useState("")
  const [complaints,        setComplaints]        = useState<{id:string;category:string;description:string;status:string;response:string|null;createdAt:string;raisedBy:string}[]>([])
  const [savingComplaint,   setSavingComplaint]   = useState(false)
  const [complaintError,    setComplaintError]    = useState("")

  // Achievement card
  const [showAchievement, setShowAchievement] = useState(false)
  const [achieving,       setAchieving]       = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // Override
  const [toggling, setToggling] = useState(false)

  // ── Fetch ──────────────────────────────────

  const fetchData = useCallback(async (silent=false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`/api/vendor/${portalToken}`)
      if (res.status===410) { const d=await res.json(); setExpiredEventName(d.eventName??"this event"); setExpired(true); return }
      if (res.status===404) { setError("This vendor link is invalid or has expired."); return }
      if (!res.ok)          { setError("Failed to load your portal."); return }
      const d = await res.json()
      setData(d)
      if (d.vendor.existingFeedback) {
        setFeedbackRating(d.vendor.existingFeedback.rating)
        setFeedbackMessage(d.vendor.existingFeedback.message??"")
        setFeedbackDone(true)
      }
    } catch { if (!silent) setError("Network error — please check your connection.") }
    finally { setLoading(false) }
  }, [portalToken])

  const fetchPayments = useCallback(async () => {
    setLoadingPay(true)
    try {
      const res = await fetch(`/api/vendor/${portalToken}/payments`)
      if (res.ok) setPayments(await res.json())
    } catch { /* silent */ }
    finally { setLoadingPay(false) }
  }, [portalToken])

  const fetchFeedback = useCallback(async () => {
    try {
      const res = await fetch(`/api/vendor/${portalToken}/feedback`)
      if (res.ok) {
        const d = await res.json()
        if (d.feedback?.vendorRating) { setFeedbackRating(d.feedback.vendorRating); setFeedbackMessage(d.feedback.vendorComment??""); setFeedbackWouldWork(d.feedback.vendorWouldWork??true); setFeedbackDone(true) }
        if (d.feedback?.plannerRating) setPlannerFeedback({ rating:d.feedback.plannerRating, comment:d.feedback.plannerComment, wouldHire:d.feedback.plannerWouldHire })
      }
    } catch { /* silent */ }
  }, [portalToken])

  const fetchComplaints = useCallback(async () => {
    try {
      const res = await fetch(`/api/vendor/${portalToken}/complaints`)
      if (res.ok) { const d=await res.json(); setComplaints(d.complaints||[]) }
    } catch { /* silent */ }
  }, [portalToken])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { if (data) { fetchPayments(); fetchFeedback(); fetchComplaints() } }, [data?.vendor.id])

  useEffect(() => {
    const i = setInterval(() => fetchData(true), 30_000)
    return () => clearInterval(i)
  }, [fetchData])

  // ── Payment actions ────────────────────────

  const handlePaymentAction = async (paymentId:string, action:"acknowledge"|"dispute") => {
    if (action==="dispute" && !disputeNote.trim()) { setPayError("Please describe the dispute."); return }
    setActingPayId(paymentId); setPayError("")
    try {
      const res = await fetch(`/api/vendor/${portalToken}/payments`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ paymentId, action, disputeNote:disputeNote.trim()||null }),
      })
      if (res.ok) {
        await fetchPayments()
        setDisputeFormId(null); setDisputeNote("")
      } else {
        const d=await res.json(); setPayError(d.error??"Failed")
      }
    } catch { setPayError("Network error.") }
    finally { setActingPayId(null) }
  }

  // ── Staff ──────────────────────────────────

  const handleAddStaff = async () => {
    if (!staffForm.name.trim()) { setStaffError("Staff name is required."); return }
    setAddingStaff(true); setStaffError("")
    try {
      const res=await fetch(`/api/vendor/${portalToken}/staff`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:staffForm.name,phone:staffForm.phone})})
      const d=await res.json()
      if (!res.ok) { setStaffError(d.error??"Failed"); return }
      setData(prev=>prev?{...prev,vendor:{...prev.vendor,staff:[...prev.vendor.staff,d.staff],staffRegistered:prev.vendor.staffRegistered+1}}:prev)
      setStaffForm({name:"",phone:""}); setShowStaffForm(false)
    } catch { setStaffError("Network error.") }
    finally { setAddingStaff(false) }
  }

  const handleRemoveStaff = async (staffId:string) => {
    setRemovingId(staffId)
    try {
      await fetch(`/api/vendor/${portalToken}/staff?staffId=${staffId}`,{method:"DELETE"})
      setData(prev=>prev?{...prev,vendor:{...prev.vendor,staff:prev.vendor.staff.filter(s=>s.id!==staffId),staffRegistered:prev.vendor.staffRegistered-1}}:prev)
    } catch { /* silent */ }
    finally { setRemovingId(null) }
  }

  // ── Override ───────────────────────────────

  const handleOverrideToggle = async () => {
    if (!data||toggling) return; setToggling(true)
    try {
      const res=await fetch(`/api/vendor/${portalToken}/override`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({active:!data.vendor.capacityOverrideActive})})
      if (res.ok) { const u=await res.json(); setData(prev=>prev?{...prev,vendor:{...prev.vendor,capacityOverrideActive:u.capacityOverrideActive}}:prev) }
    } catch { /* silent */ }
    finally { setToggling(false) }
  }

  // ── Feedback ───────────────────────────────

  const handleFeedbackSubmit = async () => {
    if (feedbackRating===0) { setFeedbackError("Please select a rating."); return }
    setSubmittingFeedback(true); setFeedbackError("")
    try {
      const res=await fetch(`/api/vendor/${portalToken}/feedback`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rating:feedbackRating,message:feedbackMessage,wouldWork:feedbackWouldWork})})
      const d=await res.json()
      if (!res.ok) { setFeedbackError(d.error??"Failed"); return }
      setFeedbackDone(true)
    } catch { setFeedbackError("Network error.") }
    finally { setSubmittingFeedback(false) }
  }

  // ── Complaint ──────────────────────────────

  const handleComplaintSubmit = async () => {
    if (!complaintCat||!complaintDesc.trim()) { setComplaintError("Select a category and describe the issue."); return }
    setSavingComplaint(true); setComplaintError("")
    try {
      const res=await fetch(`/api/vendor/${portalToken}/complaints`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({category:complaintCat,description:complaintDesc})})
      const d=await res.json()
      if (!res.ok) { setComplaintError(d.error??"Failed"); return }
      setComplaints(prev=>[d.complaint,...prev])
      setShowComplaintForm(false); setComplaintCat(""); setComplaintDesc("")
    } catch { setComplaintError("Network error.") }
    finally { setSavingComplaint(false) }
  }

  // ── Achievement card download ──────────────

  const handleShareAchievement = async () => {
    setAchieving(true)
    try {
      await new Promise(r => setTimeout(r, 100))
      if (!cardRef.current) return
      const canvas = await html2canvas(cardRef.current, { background:"#0a0a0a" })
      const link   = document.createElement("a")
      link.download = `${data?.vendor.name.replace(/\s+/g,"-")}-achievement.png`
      link.href     = canvas.toDataURL("image/png")
      link.click()
    } catch {
      // Fallback: just show the card so they can screenshot
    } finally { setAchieving(false) }
  }

  // ── Loading / Error / Expired ──────────────

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh"}}>
      <div style={{width:22,height:22,border:"1.5px solid rgba(180,140,60,0.2)",borderTopColor:"#b48c3c",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (expired) return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Cormorant+Garamond:wght@300;400&display=swap');*,*::before,*::after{box-sizing:border-box}body{margin:0;background:#0a0a0a;color:#f0ede6;font-family:'DM Sans',sans-serif}`}</style>
      <div style={{maxWidth:480,margin:"0 auto",padding:"4rem 1.25rem",textAlign:"center"}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.75rem",fontWeight:300,marginBottom:"0.75rem"}}>{expiredEventName}</div>
        <p style={{fontSize:"0.82rem",color:"#6b7280",lineHeight:1.7,marginBottom:"2rem"}}>This event has ended and the vendor portal has closed.<br/>Thank you for being part of the event.</p>
        <div style={{fontSize:"0.7rem",color:"#4b4b4b",letterSpacing:"0.1em",textTransform:"uppercase"}}>Powered by EventFlow</div>
      </div>
    </>
  )

  if (error||!data) return (
    <div style={{padding:"3rem 1.25rem",textAlign:"center",fontFamily:"sans-serif"}}>
      <p style={{color:"#6b7280",marginBottom:"0.5rem",fontSize:"0.9rem"}}>{error??"Portal unavailable"}</p>
      <p style={{fontSize:"0.75rem",color:"#9ca3af"}}>Contact your event planner for a new link.</p>
    </div>
  )

  const { vendor, event, stats, foodTallies, drinkTallies, allVendorStaff } = data
  const isCaterer     = vendor.role==="CATERER"
  const isDrinkVendor = vendor.role==="DRINK_VENDOR"
  const isSecurity    = vendor.role==="SECURITY"
  const hasBrief      = !!(vendor.arriveTime||vendor.arriveLocation||vendor.instructions)
  const totalCrewCount = allVendorStaff.reduce((sum,v)=>sum+v.staffAllotted,0)
  const eventDate     = new Date(event.eventDate).toLocaleDateString("en-NG",{weekday:"long",year:"numeric",month:"long",day:"numeric"})
  const checkinPct    = stats.totalGuests>0?Math.round((stats.checkedIn/stats.totalGuests)*100):0
  const staffSlotsLeft = (vendor.staffCount??0)-vendor.staffRegistered
  const canAddStaff    = staffSlotsLeft>0

  // Payment status label
  const payStatusLabel = () => {
    if (!payments?.totalCost) return null
    const cost=Number(payments.totalCost); const paid=Number(payments.totalPaid)
    if (paid===0)    return { label:"🔴 Unpaid",       color:"#ef4444" }
    if (paid>=cost)  return { label:"🟢 Paid in Full", color:"#22c55e" }
    return                  { label:"🟡 Part Payment", color:"#f59e0b" }
  }
  const ps = payStatusLabel()

  const inputStyle:React.CSSProperties = { padding:"0.55rem 0.75rem",background:"#161616",border:"1px solid #2a2a2a",color:"#f0ede6",fontFamily:"'DM Sans',sans-serif",fontSize:"0.82rem",outline:"none",width:"100%" }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Cormorant+Garamond:wght@300;400&display=swap');
        *,*::before,*::after{box-sizing:border-box}
        body{margin:0;background:#0a0a0a;color:#f0ede6;font-family:'DM Sans',sans-serif}

        .vp-wrap{max-width:480px;margin:0 auto;padding:1.5rem 1rem 5rem;width:100%;overflow-x:hidden}
        @media(min-width:480px){.vp-wrap{padding:2rem 1.25rem 5rem}}

        .vp-badge{display:inline-flex;align-items:center;gap:0.5rem;padding:0.3rem 0.75rem;border:1px solid #2a2a2a;background:#161616;font-size:0.7rem;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:1.25rem;color:#b48c3c;word-break:break-all}
        .vp-hero{background:#111;border:1px solid #2a2a2a;padding:1.125rem;margin-bottom:1rem}
        .vp-event-name{font-family:'Cormorant Garamond',serif;font-size:clamp(1.25rem,5vw,1.5rem);font-weight:300;margin-bottom:0.5rem;color:#f0ede6;word-break:break-word}
        .vp-meta{font-size:0.75rem;color:#6b7280;line-height:1.8}

        .vp-brief{background:#111;border:1px solid rgba(180,140,60,0.3);padding:1.125rem;margin-bottom:1rem}
        .vp-brief-title{font-size:0.6rem;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;color:#b48c3c;margin-bottom:0.875rem;display:flex;align-items:center;gap:0.75rem}
        .vp-brief-title::after{content:'';flex:1;height:1px;background:rgba(180,140,60,0.2)}
        .vp-brief-row{display:flex;gap:0.75rem;padding:0.5rem 0;border-bottom:1px solid #1a1a1a;align-items:flex-start}
        .vp-brief-row:last-child{border-bottom:none}
        .vp-brief-icon{font-size:0.9rem;flex-shrink:0;width:20px;text-align:center;padding-top:2px}
        .vp-brief-text{color:#f0ede6;line-height:1.6;word-break:break-word;flex:1;min-width:0;font-size:0.82rem}
        .vp-brief-label{font-size:0.62rem;color:#6b7280;margin-bottom:0.15rem;letter-spacing:0.04em}

        .vp-card{background:#111;border:1px solid #2a2a2a;padding:1.125rem;margin-bottom:1rem}
        .vp-card-title{font-size:0.6rem;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;color:#b48c3c;margin-bottom:1rem;display:flex;align-items:center;gap:0.75rem}
        .vp-card-title::after{content:'';flex:1;height:1px;background:#2a2a2a}

        .vp-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-bottom:1rem}
        .vp-stat{background:#161616;border:1px solid #2a2a2a;padding:0.75rem 0.5rem;text-align:center}
        .vp-stat-num{font-family:'Cormorant Garamond',serif;font-size:clamp(1.375rem,5vw,1.75rem);font-weight:300;color:#b48c3c;line-height:1;margin-bottom:0.2rem}
        .vp-stat-label{font-size:0.55rem;color:#6b7280;letter-spacing:0.08em;text-transform:uppercase}

        .vp-progress-label{display:flex;justify-content:space-between;font-size:0.72rem;color:#6b7280;margin-bottom:0.5rem}
        .vp-progress-track{height:4px;background:#2a2a2a;border-radius:2px;overflow:hidden}
        .vp-progress-fill{height:100%;background:#b48c3c;border-radius:2px;transition:width 0.6s ease}

        .vp-crew-row{display:flex;justify-content:space-between;align-items:center;padding:0.55rem 0;border-bottom:1px solid #1a1a1a;gap:0.5rem}
        .vp-crew-row:last-child{border-bottom:none}
        .vp-crew-name{color:#f0ede6;flex:1;min-width:0;word-break:break-word;font-size:0.82rem}
        .vp-crew-role{font-size:0.65rem;color:#6b7280;margin-top:0.1rem}
        .vp-crew-count{font-family:'Cormorant Garamond',serif;font-size:1.25rem;font-weight:300;color:#b48c3c;flex-shrink:0}
        .vp-crew-total{display:flex;justify-content:space-between;padding:0.625rem 0;margin-top:0.25rem;border-top:1px solid #2a2a2a;font-size:0.82rem}
        .vp-crew-total-label{color:#6b7280}
        .vp-crew-total-num{font-family:'Cormorant Garamond',serif;font-size:1.25rem;font-weight:300;color:#f0ede6}

        .vp-tally-row{display:flex;justify-content:space-between;align-items:center;padding:0.625rem 0;border-bottom:1px solid #1a1a1a;gap:0.5rem}
        .vp-tally-row:last-child{border-bottom:none}
        .vp-tally-name{font-size:0.82rem;color:#f0ede6;word-break:break-word;flex:1;min-width:0}
        .vp-tally-cat{font-size:0.65rem;color:#6b7280;margin-top:0.1rem}
        .vp-tally-count{font-family:'Cormorant Garamond',serif;font-size:1.25rem;font-weight:300;color:#b48c3c;flex-shrink:0}

        .vp-tl-item{display:flex;gap:0.875rem;padding:0.75rem 0;border-bottom:1px solid #1a1a1a}
        .vp-tl-item:last-child{border-bottom:none}
        .vp-tl-time{font-size:0.72rem;color:#b48c3c;white-space:nowrap;font-weight:500;padding-top:2px;min-width:55px}
        .vp-tl-title{font-size:0.85rem;font-weight:500;color:#f0ede6;margin-bottom:0.15rem;word-break:break-word}
        .vp-tl-desc{font-size:0.72rem;color:#6b7280;line-height:1.5;word-break:break-word}

        .vp-staff-row{display:flex;align-items:center;justify-content:space-between;gap:0.75rem;padding:0.625rem 0;border-bottom:1px solid #1a1a1a}
        .vp-staff-row:last-child{border-bottom:none}
        .vp-staff-name{font-size:0.85rem;color:#f0ede6;font-weight:500;word-break:break-word}
        .vp-staff-phone{font-size:0.7rem;color:#6b7280}
        .vp-staff-badge{font-size:0.6rem;letter-spacing:0.06em;padding:0.2rem 0.55rem;border-radius:99px;white-space:nowrap;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.08);color:#22c55e}
        .vp-staff-form{background:#161616;border:1px solid #2a2a2a;padding:1rem;margin-top:0.75rem;display:flex;flex-direction:column;gap:0.5rem}
        .vp-staff-cap{font-size:0.7rem;color:#6b7280}

        .vp-info-row{display:flex;justify-content:space-between;align-items:flex-start;padding:0.5rem 0;border-bottom:1px solid #1a1a1a;font-size:0.78rem;gap:0.75rem}
        .vp-info-row:last-child{border-bottom:none}
        .vp-info-k{color:#6b7280;flex-shrink:0}
        .vp-info-v{color:#f0ede6;font-weight:500;text-align:right;word-break:break-word;min-width:0}

        .vp-override{padding:1rem;border:1px solid;margin-bottom:1rem}
        .vp-override-on{border-color:rgba(34,197,94,0.3);background:rgba(34,197,94,0.06)}
        .vp-override-off{border-color:#2a2a2a;background:#111}
        .vp-override-title{font-size:0.78rem;font-weight:500;margin-bottom:0.25rem}
        .vp-override-desc{font-size:0.72rem;color:#6b7280;margin-bottom:0.875rem;line-height:1.5}

        /* Payment rows */
        .vp-pay-row{padding:0.875rem 0;border-bottom:1px solid #1a1a1a;min-width:0}
        .vp-pay-row:last-child{border-bottom:none}
        .vp-pay-top{display:flex;align-items:flex-start;justify-content:space-between;gap:0.75rem;margin-bottom:0.5rem}
        .vp-pay-amount{font-family:'Cormorant Garamond',serif;font-size:1.375rem;font-weight:300;color:#f0ede6}
        .vp-pay-method{font-size:0.68rem;color:#6b7280;margin-top:0.1rem}
        .vp-pay-tag{font-size:0.6rem;font-weight:500;padding:0.15rem 0.45rem;border-radius:99px;border:1px solid;flex-shrink:0;white-space:nowrap}
        .vp-pay-ack{border-color:rgba(34,197,94,0.3);color:#22c55e}
        .vp-pay-disp{border-color:rgba(239,68,68,0.3);color:#ef4444}
        .vp-pay-pend{border-color:#3a3a3a;color:#6b7280}

        /* Payment summary */
        .vp-pay-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-bottom:1rem}
        .vp-pay-stat{background:#161616;border:1px solid #2a2a2a;padding:0.625rem 0.5rem;text-align:center}
        .vp-pay-stat-num{font-family:'Cormorant Garamond',serif;font-size:1.125rem;font-weight:300;color:#b48c3c;line-height:1;margin-bottom:0.15rem}
        .vp-pay-stat-label{font-size:0.52rem;color:#6b7280;letter-spacing:0.06em;text-transform:uppercase}

        /* Stars */
        .vp-stars{display:flex;gap:0.625rem;margin-bottom:0.875rem}
        .vp-star{font-size:clamp(1.5rem,7vw,2rem);cursor:pointer;transition:transform 0.1s;line-height:1;-webkit-tap-highlight-color:transparent}
        .vp-star:hover{transform:scale(1.15)}
        .vp-star-filled{color:#b48c3c}
        .vp-star-empty{color:#2a2a2a}
        .vp-feedback-done{padding:1rem;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);font-size:0.82rem;color:#22c55e;line-height:1.5}

        /* Planner's feedback card */
        .vp-planner-fb{padding:1rem;background:rgba(180,140,60,0.06);border:1px solid rgba(180,140,60,0.25);margin-top:0.875rem}
        .vp-planner-fb-label{font-size:0.58rem;font-weight:500;letter-spacing:0.15em;text-transform:uppercase;color:#b48c3c;margin-bottom:0.5rem}

        /* Complaint chips */
        .vp-chips{display:flex;gap:0.375rem;flex-wrap:wrap;margin-bottom:0.625rem}
        .vp-chip{padding:0.3rem 0.625rem;font-size:0.72rem;border:1px solid #2a2a2a;color:#9ca3af;cursor:pointer;transition:all 0.15s;background:transparent;font-family:'DM Sans',sans-serif}
        .vp-chip.on{border-color:#b48c3c;color:#b48c3c;background:rgba(180,140,60,0.08)}

        /* Complaint item */
        .vp-comp-item{padding:0.875rem;border:1px solid #2a2a2a;margin-bottom:0.625rem}
        .vp-comp-item:last-child{margin-bottom:0}
        .vp-comp-cat{font-size:0.72rem;font-weight:500;color:#f0ede6;margin-bottom:0.25rem}
        .vp-comp-desc{font-size:0.78rem;color:#9ca3af;line-height:1.5;margin-bottom:0.375rem}
        .vp-comp-status{font-size:0.6rem;font-weight:500;padding:0.15rem 0.45rem;border-radius:99px;border:1px solid}
        .vp-comp-open{color:#ef4444;border-color:rgba(239,68,68,0.3);background:rgba(239,68,68,0.08)}
        .vp-comp-disc{color:#f59e0b;border-color:rgba(245,158,11,0.3);background:rgba(245,158,11,0.08)}
        .vp-comp-res{color:#22c55e;border-color:rgba(34,197,94,0.3);background:rgba(34,197,94,0.08)}

        /* Achievement card */
        .vp-achievement-card{background:#0a0a0a;border:1px solid rgba(180,140,60,0.4);padding:2rem 1.5rem;text-align:center;margin:1rem 0;min-width:0}
        .vp-ac-icon{font-size:2.5rem;margin-bottom:0.875rem}
        .vp-ac-stars{font-size:1.25rem;color:#b48c3c;margin-bottom:0.625rem;letter-spacing:0.1em}
        .vp-ac-quote{font-family:'Cormorant Garamond',serif;font-size:1.125rem;font-weight:300;color:#f0ede6;line-height:1.6;margin-bottom:0.875rem;font-style:italic}
        .vp-ac-name{font-size:0.875rem;font-weight:500;color:#f0ede6;margin-bottom:0.25rem}
        .vp-ac-role{font-size:0.72rem;color:#6b7280;margin-bottom:1rem}
        .vp-ac-brand{font-size:0.6rem;letter-spacing:0.2em;text-transform:uppercase;color:rgba(180,140,60,0.5)}
        .vp-ac-verified{font-size:0.65rem;color:#6b7280;margin-bottom:0.375rem}

        /* Milestone badges */
        .vp-milestones{display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.875rem;justify-content:center}
        .vp-milestone{font-size:0.65rem;padding:0.2rem 0.5rem;border:1px solid rgba(180,140,60,0.25);color:rgba(180,140,60,0.7);border-radius:99px}

        /* Buttons */
        .vp-btn-gold{padding:0.55rem 1rem;background:#b48c3c;color:#0a0a0a;border:none;font-family:'DM Sans',sans-serif;font-size:0.75rem;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;cursor:pointer}
        .vp-btn-gold:disabled{opacity:0.5;cursor:not-allowed}
        .vp-btn-ghost{padding:0.5rem 0.875rem;background:transparent;border:1px solid #2a2a2a;color:#9ca3af;font-family:'DM Sans',sans-serif;font-size:0.72rem;cursor:pointer}
        .vp-btn-ghost:hover{border-color:#4b4b4b;color:#f0ede6}
        .vp-btn-ghost:disabled{opacity:0.4;cursor:not-allowed}
        .vp-btn-red{padding:0.4rem 0.7rem;background:transparent;border:1px solid rgba(239,68,68,0.2);color:rgba(239,68,68,0.6);font-family:'DM Sans',sans-serif;font-size:0.68rem;cursor:pointer}
        .vp-btn-red:hover{border-color:#ef4444;color:#ef4444}
        .vp-btn-red:disabled{opacity:0.3;cursor:not-allowed}
        .vp-btn-full{width:100%;padding:0.625rem;font-family:'DM Sans',sans-serif;font-size:0.78rem;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;cursor:pointer;border:none}
        .vp-btn-on{background:#22c55e;color:#0a0a0a}
        .vp-btn-off{background:#2a2a2a;color:#f0ede6}
        .vp-btn-full:disabled{opacity:0.5;cursor:not-allowed}
        .vp-btn-row{display:flex;gap:0.5rem}
        .vp-error{font-size:0.72rem;color:#ef4444;margin-top:0.35rem}
        .vp-textarea{padding:0.55rem 0.75rem;background:#161616;border:1px solid #2a2a2a;color:#f0ede6;font-family:'DM Sans',sans-serif;font-size:0.82rem;outline:none;width:100%;resize:vertical;min-height:72px}
        .vp-empty{font-size:0.78rem;color:#4b4b4b;padding:1rem 0;text-align:center}

        /* Share button */
        .vp-share-btn{width:100%;padding:0.75rem;background:rgba(180,140,60,0.12);border:1px solid rgba(180,140,60,0.35);color:#b48c3c;font-family:'DM Sans',sans-serif;font-size:0.78rem;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.625rem;margin-top:0.875rem}
        .vp-share-btn:hover{background:rgba(180,140,60,0.2)}
        .vp-share-btn:disabled{opacity:0.5;cursor:not-allowed}
      `}</style>

      <div className="vp-wrap">

        {/* Identity badge */}
        <div className="vp-badge">{vendor.name} · {roleLabel(vendor.role)}</div>

        {/* Event hero */}
        <div className="vp-hero">
          <div className="vp-event-name">{event.name}</div>
          <div className="vp-meta">
            {eventDate}{event.startTime&&` · ${event.startTime}`}{event.endTime&&` – ${event.endTime}`}
            {(event.venueName||event.venueAddress)&&<><br/>{event.venueName}{event.venueAddress&&`, ${event.venueAddress}`}</>}
          </div>
        </div>

        {/* Vendor brief */}
        {hasBrief && (
          <div className="vp-brief">
            <div className="vp-brief-title">Your brief</div>
            {vendor.arriveTime && <div className="vp-brief-row"><span className="vp-brief-icon">🕐</span><div><div className="vp-brief-label">Arrive by</div><div className="vp-brief-text">{vendor.arriveTime}</div></div></div>}
            {vendor.arriveLocation && <div className="vp-brief-row"><span className="vp-brief-icon">📍</span><div><div className="vp-brief-label">Location</div><div className="vp-brief-text">{vendor.arriveLocation}</div></div></div>}
            {vendor.instructions && <div className="vp-brief-row"><span className="vp-brief-icon">📋</span><div><div className="vp-brief-label">Instructions</div><div className="vp-brief-text" style={{whiteSpace:"pre-wrap"}}>{vendor.instructions}</div></div></div>}
          </div>
        )}

        {/* Stats */}
        <div className="vp-stats">
          <div className="vp-stat"><div className="vp-stat-num">{stats.totalGuests}</div><div className="vp-stat-label">Expected</div></div>
          <div className="vp-stat"><div className="vp-stat-num">{stats.checkedIn}</div><div className="vp-stat-label">Arrived</div></div>
          <div className="vp-stat"><div className="vp-stat-num">{stats.pending}</div><div className="vp-stat-label">Pending</div></div>
        </div>

        {/* Progress */}
        <div className="vp-card">
          <div className="vp-card-title">Arrival progress</div>
          <div className="vp-progress-label"><span>{stats.checkedIn} of {stats.totalGuests} guests</span><span>{checkinPct}%</span></div>
          <div className="vp-progress-track"><div className="vp-progress-fill" style={{width:`${checkinPct}%`}}/></div>
        </div>

        {/* ── PAYMENTS ── */}
        <div className="vp-card">
          <div className="vp-card-title">
            Payments
            {ps && <span style={{fontSize:"0.65rem",fontWeight:400,letterSpacing:0,textTransform:"none",color:ps.color}}>{ps.label}</span>}
          </div>
          {loadingPay ? (
            <div className="vp-empty">Loading…</div>
          ) : payments ? (
            <>
              <div className="vp-pay-stats">
                <div className="vp-pay-stat"><div className="vp-pay-stat-num">{fmtNGN(payments.totalCost)}</div><div className="vp-pay-stat-label">Total</div></div>
                <div className="vp-pay-stat"><div className="vp-pay-stat-num">{fmtNGN(payments.totalPaid)}</div><div className="vp-pay-stat-label">Paid</div></div>
                <div className="vp-pay-stat">
                  <div className="vp-pay-stat-num" style={{color:payments.balance&&Number(payments.balance)>0?"#f59e0b":"#22c55e"}}>
                    {payments.balance===null?"—":Number(payments.balance)>0?fmtNGN(payments.balance):"Fully paid"}
                  </div>
                  <div className="vp-pay-stat-label">Balance</div>
                </div>
              </div>

              {payments.payments.length===0 ? (
                <div className="vp-empty">No payments recorded yet.</div>
              ) : (
                payments.payments.map(p => {
                  const isPending = p.status==="PENDING"
                  const isDispForming = disputeFormId===p.id
                  return (
                    <div className="vp-pay-row" key={p.id}>
                      <div className="vp-pay-top">
                        <div>
                          <div className="vp-pay-amount">{fmtNGN(p.amount)}</div>
                          <div className="vp-pay-method">{p.method==="BANK_TRANSFER"?"Bank Transfer":"Cash"} · {new Date(p.createdAt).toLocaleDateString("en-NG",{day:"numeric",month:"short"})}</div>
                          {p.note && <div style={{fontSize:"0.7rem",color:"#6b7280",marginTop:"0.15rem"}}>{p.note}</div>}
                        </div>
                        <span className={`vp-pay-tag ${p.status==="ACKNOWLEDGED"?"vp-pay-ack":p.status==="DISPUTED"?"vp-pay-disp":"vp-pay-pend"}`}>
                          {p.status==="ACKNOWLEDGED"?"✓ Acknowledged":p.status==="DISPUTED"?"⚑ Disputed":"Pending"}
                        </span>
                      </div>
                      {p.receiptUrl && <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:"0.7rem",color:"#b48c3c",display:"inline-flex",alignItems:"center",gap:"0.35rem",marginBottom:"0.5rem"}}>📎 View receipt</a>}
                      {p.status==="DISPUTED" && p.disputeNote && <div style={{fontSize:"0.7rem",color:"#ef4444",marginBottom:"0.5rem"}}>⚑ {p.disputeNote}</div>}

                      {isPending && !isDispForming && (
                        <div className="vp-btn-row">
                          <button className="vp-btn-ghost" style={{flex:1,fontSize:"0.72rem",color:"#22c55e",borderColor:"rgba(34,197,94,0.3)"}} onClick={()=>handlePaymentAction(p.id,"acknowledge")} disabled={actingPayId===p.id}>
                            {actingPayId===p.id?"…":"✓ Acknowledge"}
                          </button>
                          <button className="vp-btn-ghost" style={{flex:1,fontSize:"0.72rem",color:"rgba(239,68,68,0.7)",borderColor:"rgba(239,68,68,0.25)"}} onClick={()=>setDisputeFormId(p.id)}>
                            ⚑ Dispute
                          </button>
                        </div>
                      )}

                      {isDispForming && (
                        <div style={{marginTop:"0.5rem"}}>
                          <textarea className="vp-textarea" placeholder="Describe the dispute…" style={{minHeight:"60px",marginBottom:"0.5rem"}} value={disputeNote} onChange={e=>setDisputeNote(e.target.value)} />
                          {payError && <div className="vp-error">{payError}</div>}
                          <div className="vp-btn-row">
                            <button className="vp-btn-gold" style={{flex:1}} onClick={()=>handlePaymentAction(p.id,"dispute")} disabled={actingPayId===p.id}>{actingPayId===p.id?"…":"Submit dispute"}</button>
                            <button className="vp-btn-ghost" onClick={()=>{setDisputeFormId(null);setDisputeNote("");setPayError("")}}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </>
          ) : (
            <div className="vp-empty">No payment data yet.</div>
          )}
        </div>

        {/* Caterer crew */}
        {isCaterer && allVendorStaff.length>0 && (
          <div className="vp-card">
            <div className="vp-card-title">Vendor crew to cater for</div>
            <p style={{fontSize:"0.75rem",color:"#6b7280",marginBottom:"0.875rem",lineHeight:1.6}}>Prepare food for guests + this crew total.</p>
            {allVendorStaff.map((v,i)=>(
              <div className="vp-crew-row" key={i}>
                <div><div className="vp-crew-name">{v.name}</div><div className="vp-crew-role">{roleLabel(v.role)}</div></div>
                <div className="vp-crew-count">{v.staffAllotted}</div>
              </div>
            ))}
            <div className="vp-crew-total">
              <span className="vp-crew-total-label">Total (guests + crew)</span>
              <span className="vp-crew-total-num">{stats.totalGuests+totalCrewCount}</span>
            </div>
          </div>
        )}

        {/* Caterer food tallies */}
        {isCaterer && (
          <div className="vp-card">
            <div className="vp-card-title">Pre-ordered food</div>
            {foodTallies.length===0?<div className="vp-empty">No pre-ordered meals yet.</div>:foodTallies.map(item=>(
              <div className="vp-tally-row" key={item.menuItemId}><div><div className="vp-tally-name">{item.name}</div><div className="vp-tally-cat">{item.category.charAt(0)+item.category.slice(1).toLowerCase()}</div></div><div className="vp-tally-count">{item.totalOrders}</div></div>
            ))}
          </div>
        )}

        {/* Drink tallies */}
        {isDrinkVendor && (
          <div className="vp-card">
            <div className="vp-card-title">Pre-ordered drinks</div>
            {drinkTallies.length===0?<div className="vp-empty">No pre-ordered drinks yet.</div>:drinkTallies.map(item=>(
              <div className="vp-tally-row" key={item.menuItemId}><div><div className="vp-tally-name">{item.name}</div><div className="vp-tally-cat">Drink</div></div><div className="vp-tally-count">{item.totalOrders}</div></div>
            ))}
          </div>
        )}

        {/* Security override */}
        {isSecurity && vendor.canOverrideCapacity && (
          <div className={`vp-override ${vendor.capacityOverrideActive?"vp-override-on":"vp-override-off"}`}>
            <div className="vp-override-title" style={{color:vendor.capacityOverrideActive?"#22c55e":"#f0ede6"}}>{vendor.capacityOverrideActive?"Walk-in mode is ON":"Walk-in mode is off"}</div>
            <div className="vp-override-desc">Only activate when instructed by the event planner.</div>
            <button className={`vp-btn-full ${vendor.capacityOverrideActive?"vp-btn-off":"vp-btn-on"}`} onClick={handleOverrideToggle} disabled={toggling}>{toggling?"Updating…":vendor.capacityOverrideActive?"Deactivate walk-in mode":"Activate walk-in mode"}</button>
          </div>
        )}

        {/* Timeline */}
        {event.timeline.length>0 && (
          <div className="vp-card">
            <div className="vp-card-title">Event schedule</div>
            {event.timeline.map(item=>(
              <div className="vp-tl-item" key={item.id}>
                <div className="vp-tl-time">{item.time}</div>
                <div><div className="vp-tl-title">{item.title}</div>{item.description&&<div className="vp-tl-desc">{item.description}</div>}</div>
              </div>
            ))}
          </div>
        )}

        {/* Staff */}
        {(vendor.staffCount??0)>0 && (
          <div className="vp-card">
            <div className="vp-card-title">My staff <span style={{fontSize:"0.65rem",color:"#6b7280",fontWeight:400,letterSpacing:0,textTransform:"none"}}>{vendor.staffRegistered} / {vendor.staffCount} registered</span></div>
            {vendor.staff.length===0?<div className="vp-empty">No staff registered yet.</div>:vendor.staff.map(member=>(
              <div className="vp-staff-row" key={member.id}>
                <div style={{minWidth:0}}><div className="vp-staff-name">{member.name}</div>{member.phone&&<div className="vp-staff-phone">{member.phone}</div>}</div>
                <div style={{display:"flex",alignItems:"center",gap:"0.5rem",flexShrink:0}}>
                  {member.checkedIn&&<span className="vp-staff-badge">Checked in</span>}
                  {!member.checkedIn&&<button className="vp-btn-red" onClick={()=>handleRemoveStaff(member.id)} disabled={removingId===member.id}>{removingId===member.id?"…":"Remove"}</button>}
                </div>
              </div>
            ))}
            {canAddStaff&&!showStaffForm&&<button className="vp-btn-ghost" style={{marginTop:"0.875rem",width:"100%"}} onClick={()=>{setShowStaffForm(true);setStaffError("")}}>+ Add staff member ({staffSlotsLeft} slot{staffSlotsLeft!==1?"s":""} remaining)</button>}
            {showStaffForm&&(
              <div className="vp-staff-form">
                <div className="vp-staff-cap">{staffSlotsLeft} slot{staffSlotsLeft!==1?"s":""} remaining</div>
                <input style={inputStyle} placeholder="Staff name *" value={staffForm.name} onChange={e=>setStaffForm(f=>({...f,name:e.target.value}))}/>
                <input style={inputStyle} placeholder="Phone (optional)" type="tel" value={staffForm.phone} onChange={e=>setStaffForm(f=>({...f,phone:e.target.value}))}/>
                {staffError&&<div className="vp-error">{staffError}</div>}
                <div className="vp-btn-row">
                  <button className="vp-btn-gold" onClick={handleAddStaff} disabled={addingStaff} style={{flex:1}}>{addingStaff?"Adding…":"Add"}</button>
                  <button className="vp-btn-ghost" onClick={()=>{setShowStaffForm(false);setStaffError("")}}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Vendor details */}
        <div className="vp-card">
          <div className="vp-card-title">Your details</div>
          {vendor.contactName&&<div className="vp-info-row"><span className="vp-info-k">Contact</span><span className="vp-info-v">{vendor.contactName}</span></div>}
          <div className="vp-info-row"><span className="vp-info-k">Role</span><span className="vp-info-v">{roleLabel(vendor.role)}</span></div>
          {event.plannerPhone&&<div className="vp-info-row"><span className="vp-info-k">Planner phone</span><span className="vp-info-v">{event.plannerPhone}</span></div>}
          {event.plannerEmail&&<div className="vp-info-row"><span className="vp-info-k">Planner email</span><span className="vp-info-v">{event.plannerEmail}</span></div>}
        </div>

        {/* ── COMPLAINTS ── */}
        <div className="vp-card">
          <div className="vp-card-title">Raise a concern</div>
          <p style={{fontSize:"0.75rem",color:"#6b7280",marginBottom:"0.875rem",lineHeight:1.5}}>Something wrong? Raise it here — the planner will see and respond.</p>

          {complaints.map(c=>(
            <div className="vp-comp-item" key={c.id}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"0.5rem",marginBottom:"0.375rem",flexWrap:"wrap"}}>
                <div className="vp-comp-cat">{c.category}</div>
                <span className={`vp-comp-status ${c.status==="OPEN"?"vp-comp-open":c.status==="IN_DISCUSSION"?"vp-comp-disc":"vp-comp-res"}`}>
                  {c.status==="IN_DISCUSSION"?"In discussion":c.status.charAt(0)+c.status.slice(1).toLowerCase()}
                </span>
              </div>
              <div className="vp-comp-desc">{c.description}</div>
              {c.response&&<div style={{fontSize:"0.72rem",color:"#9ca3af",padding:"0.5rem 0.75rem",borderLeft:"2px solid rgba(180,140,60,0.4)",lineHeight:1.5}}>Response: {c.response}</div>}
            </div>
          ))}

          {!showComplaintForm&&<button className="vp-btn-ghost" style={{width:"100%",marginTop:complaints.length>0?"0.875rem":"0"}} onClick={()=>setShowComplaintForm(true)}>+ Raise a concern</button>}

          {showComplaintForm&&(
            <div style={{marginTop:"0.875rem"}}>
              <div className="vp-chips">
                {VENDOR_COMPLAINT_CATS.map(cat=>(
                  <button key={cat} className={`vp-chip${complaintCat===cat?" on":""}`} onClick={()=>setComplaintCat(cat)}>{cat}</button>
                ))}
              </div>
              <textarea className="vp-textarea" placeholder="Describe the issue briefly…" value={complaintDesc} onChange={e=>setComplaintDesc(e.target.value)} style={{marginBottom:"0.5rem"}}/>
              {complaintError&&<div className="vp-error">{complaintError}</div>}
              <div className="vp-btn-row">
                <button className="vp-btn-gold" style={{flex:1}} onClick={handleComplaintSubmit} disabled={savingComplaint}>{savingComplaint?"Submitting…":"Submit concern"}</button>
                <button className="vp-btn-ghost" onClick={()=>{setShowComplaintForm(false);setComplaintError("")}}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* ── FEEDBACK (vendor→planner) ── */}
        {data.expiry.isInFeedbackWindow && (
          <div className="vp-card">
            <div className="vp-card-title">{feedbackDone?"Your feedback":"How did it go?"}</div>

            {feedbackDone ? (
              <>
                <div className="vp-feedback-done">
                  ✓ Thank you. The planner will see your feedback.
                  <br/><button className="vp-btn-ghost" style={{marginTop:"0.75rem",fontSize:"0.7rem"}} onClick={()=>setFeedbackDone(false)}>Edit my feedback</button>
                </div>

                {/* Planner's feedback to vendor (visible after completion) */}
                {plannerFeedback && (
                  <div className="vp-planner-fb">
                    <div className="vp-planner-fb-label">What the planner said about you</div>
                    <div style={{fontSize:"0.82rem",color:"#b48c3c",marginBottom:"0.375rem"}}>{"★".repeat(plannerFeedback.rating)}{"☆".repeat(5-plannerFeedback.rating)}</div>
                    {plannerFeedback.comment&&<div style={{fontSize:"0.78rem",color:"#f0ede6",lineHeight:1.6,fontStyle:"italic",marginBottom:"0.375rem"}}>"{plannerFeedback.comment}"</div>}
                    {plannerFeedback.wouldHire!==null&&<div style={{fontSize:"0.7rem",color:"#6b7280"}}>{plannerFeedback.wouldHire?"👍 Would hire again":"Would not rehire"}</div>}
                  </div>
                )}

                {/* Achievement card */}
                {plannerFeedback && plannerFeedback.rating >= 4 && (
                  <div style={{marginTop:"0.875rem"}}>
                    {!showAchievement ? (
                      <button className="vp-share-btn" onClick={()=>setShowAchievement(true)}>
                        🏆 Share your achievement
                      </button>
                    ) : (
                      <>
                        {/* The shareable card */}
                        <div ref={cardRef} className="vp-achievement-card">
                          <div className="vp-ac-icon">{plannerFeedback.rating>=5?"🏆":plannerFeedback.rating>=4?"🌟":"⭐"}</div>
                          <div className="vp-ac-stars">{"★".repeat(plannerFeedback.rating)}{"☆".repeat(5-plannerFeedback.rating)}</div>
                          {plannerFeedback.comment&&(
                            <div className="vp-ac-quote">"{plannerFeedback.comment}"</div>
                          )}
                          <div className="vp-ac-verified">— Verified event planner · EventFlowNG</div>
                          <div style={{width:"40px",height:"1px",background:"rgba(180,140,60,0.3)",margin:"0.875rem auto"}}/>
                          <div className="vp-ac-name">{vendor.name}</div>
                          <div className="vp-ac-role">{roleLabel(vendor.role)}</div>
                          <div className="vp-milestones">
                            {plannerFeedback.rating>=4&&<span className="vp-milestone">⭐ {plannerFeedback.rating}.0 Rating</span>}
                            {plannerFeedback.wouldHire&&<span className="vp-milestone">👍 Rehire recommended</span>}
                          </div>
                          <div className="vp-ac-brand">eventflowng.com</div>
                        </div>

                        <div style={{display:"flex",gap:"0.5rem",marginTop:"0.625rem"}}>
                          <button className="vp-share-btn" style={{flex:1,marginTop:0}} onClick={handleShareAchievement} disabled={achieving}>
                            {achieving?"Generating…":"📥 Download card"}
                          </button>
                          <button className="vp-btn-ghost" style={{flexShrink:0}} onClick={()=>setShowAchievement(false)}>Close</button>
                        </div>
                        <p style={{fontSize:"0.65rem",color:"#4b4b4b",textAlign:"center",marginTop:"0.5rem"}}>Screenshot or download to share on WhatsApp, Instagram & TikTok</p>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <p style={{fontSize:"0.78rem",color:"#6b7280",marginBottom:"0.875rem",lineHeight:1.6}}>Share how the event went from your end.</p>
                <div className="vp-stars">{[1,2,3,4,5].map(star=><span key={star} className={`vp-star ${star<=feedbackRating?"vp-star-filled":"vp-star-empty"}`} onClick={()=>setFeedbackRating(star)}>★</span>)}</div>
                <textarea className="vp-textarea" placeholder="Any comments? (optional)" value={feedbackMessage} onChange={e=>setFeedbackMessage(e.target.value)} style={{marginBottom:"0.625rem"}}/>
                <label style={{display:"flex",alignItems:"center",gap:"0.5rem",fontSize:"0.8rem",color:"#9ca3af",cursor:"pointer",marginBottom:"0.875rem"}}>
                  <input type="checkbox" checked={feedbackWouldWork} onChange={e=>setFeedbackWouldWork(e.target.checked)} />
                  👍 Would work with this planner again
                </label>
                {feedbackError&&<div className="vp-error">{feedbackError}</div>}
                <button className="vp-btn-gold" onClick={handleFeedbackSubmit} disabled={submittingFeedback||feedbackRating===0} style={{width:"100%"}}>
                  {submittingFeedback?"Submitting…":"Submit feedback"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
