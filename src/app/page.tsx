// ─────────────────────────────────────────────
// src/app/(auth)/login/page.tsx
//
// DESKTOP: Two-panel split — brand story left,
//          login form right. Unchanged.
//
// MOBILE:  Single flowing page:
//          Logo + headline + subtext
//          → Carousel (1.png–6.png from public/)
//          → Login form
//          → Trust signals
// ─────────────────────────────────────────────

"use client"

import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import Image from "next/image"

// The 6 venue photos placed in public/
// Named 1.png through 6.png
const CAROUSEL_IMAGES = [
  "/1.png", "/2.png", "/3.png",
  "/4.png", "/5.png", "/6.png",
]

const SLIDE_DURATION = 2500 // 2.5 seconds per slide

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth()
  const router = useRouter()

  // Carousel state — tracks which slide is visible
  const [activeSlide, setActiveSlide]   = useState(0)
  // Controls opacity for the crossfade effect
  const [fading, setFading]             = useState(false)

  // Redirect already-signed-in users immediately
  useEffect(() => {
    if (!loading && user) router.push("/dashboard")
  }, [user, loading, router])

  // Advance to the next slide with a smooth fade
  const nextSlide = useCallback(() => {
    setFading(true) // start fade out

    // After fade-out completes, swap the image
    setTimeout(() => {
      setActiveSlide(prev => (prev + 1) % CAROUSEL_IMAGES.length)
      setFading(false) // fade back in
    }, 400) // 400ms crossfade duration
  }, [])

  // Auto-advance the carousel every 2.5 seconds
  useEffect(() => {
    const timer = setInterval(nextSlide, SLIDE_DURATION)
    return () => clearInterval(timer) // clean up on unmount
  }, [nextSlide])

  // Loading spinner while Firebase checks session
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0a0a0a",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 20, height: 20,
          border: "1.5px solid rgba(180,140,60,0.3)",
          borderTopColor: "#b48c3c",
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }

        /* ── Root: horizontal flex on desktop ── */
        .login-root {
          min-height: 100vh;
          min-height: 100dvh;
          background-color: #0a0a0a;
          display: flex;
          font-family: 'DM Sans', sans-serif;
          overflow-x: hidden;
          position: relative;
        }

        /* Ambient gold glow */
        .login-root::before {
          content: '';
          position: fixed; inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 20% 50%, rgba(180,140,60,0.07) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 80% 20%, rgba(180,140,60,0.05) 0%, transparent 50%);
          pointer-events: none; z-index: 0;
        }

        /* Film grain */
        .login-root::after {
          content: '';
          position: fixed; inset: -200%;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
          opacity: 0.025; pointer-events: none; z-index: 0;
        }

        /* ── LEFT PANEL (desktop only) ── */
        .left-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 3rem;
          position: relative; z-index: 1;
          border-right: 1px solid rgba(180,140,60,0.1);
        }

        .left-panel-inner {
          display: flex; flex-direction: column;
          justify-content: center; flex: 1;
          max-width: 520px;
        }

        .eyebrow {
          font-size: 0.65rem; font-weight: 500;
          letter-spacing: 0.25em; text-transform: uppercase;
          color: #b48c3c; margin-bottom: 2rem;
          display: flex; align-items: center; gap: 0.75rem;
        }

        .eyebrow::before {
          content: ''; display: block;
          width: 2rem; height: 1px;
          background: #b48c3c; opacity: 0.6; flex-shrink: 0;
        }

        .headline {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(2.5rem, 4vw, 4.5rem);
          font-weight: 300; line-height: 1.05;
          color: #f0ece4; margin-bottom: 1.5rem;
          letter-spacing: -0.01em;
        }

        .headline em { font-style: italic; color: #b48c3c; }

        .subtext {
          font-size: 0.9rem; font-weight: 300;
          color: rgba(240,236,228,0.45);
          line-height: 1.7; max-width: 380px;
        }

        .features { margin-top: 3rem; display: flex; flex-direction: column; gap: 1rem; }
        .feature-item { display: flex; align-items: flex-start; gap: 0.875rem; }
        .feature-dot {
          width: 4px; height: 4px; border-radius: 50%;
          background: #b48c3c; margin-top: 0.45rem; flex-shrink: 0;
        }
        .feature-text { font-size: 0.8rem; color: rgba(240,236,228,0.4); font-weight: 300; line-height: 1.5; }
        .feature-text strong { color: rgba(240,236,228,0.7); font-weight: 400; }
        .left-footer { font-size: 0.7rem; color: rgba(240,236,228,0.2); letter-spacing: 0.05em; }

        /* ── RIGHT PANEL (desktop) / full width (mobile) ── */
        .right-panel {
          width: 480px; flex-shrink: 0;
          display: flex; flex-direction: column;
          justify-content: center; align-items: center;
          padding: 3rem; position: relative; z-index: 1;
        }

        .login-card { width: 100%; max-width: 360px; }

        /* Logo row — shown on desktop right panel */
        .logo-mark {
          display: flex; align-items: center;
          gap: 0.75rem; margin-bottom: 3rem;
        }

        .logo-text {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.25rem; font-weight: 400;
          color: #f0ece4; letter-spacing: 0.12em;
        }
        .logo-text span { color: #b48c3c; }

        /* ── CAROUSEL ── */
        /* Hidden on desktop — shown only on mobile */
        .carousel {
          display: none;
        }

        .carousel-track {
          /* Full bleed — no padding, edge to edge */
          width: 100%;
          /* 16:9 aspect ratio for landscape photos */
          aspect-ratio: 16 / 9;
          position: relative;
          overflow: hidden;
          background: #111;
        }

        /* Each slide fades in/out via opacity transition */
        .carousel-slide {
          position: absolute; inset: 0;
          transition: opacity 0.4s ease;
        }

        /* Bottom gradient so content below doesn't clash */
        .carousel-track::after {
          content: '';
          position: absolute; bottom: 0; left: 0; right: 0;
          height: 40%;
          background: linear-gradient(to bottom, transparent, #0a0a0a);
          z-index: 2; pointer-events: none;
        }

        /* Dot indicators below carousel */
        .carousel-dots {
          display: flex;
          justify-content: center;
          gap: 0.4rem;
          margin-top: 0.875rem;
          margin-bottom: 0.25rem;
        }

        .carousel-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: rgba(180,140,60,0.25);
          transition: background 0.3s ease, transform 0.3s ease;
          cursor: pointer;
          border: none; padding: 0;
        }

        /* Active dot — gold and slightly larger */
        .carousel-dot.active {
          background: #b48c3c;
          transform: scale(1.3);
        }

        /* Login section */
        .card-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.875rem; font-weight: 300;
          color: #f0ece4; margin-bottom: 0.5rem;
          letter-spacing: -0.01em;
        }

        .card-subtitle {
          font-size: 0.8rem; color: rgba(240,236,228,0.4);
          font-weight: 300; margin-bottom: 2.5rem; line-height: 1.6;
        }

        .divider { display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; }
        .divider-line { flex: 1; height: 1px; background: rgba(180,140,60,0.15); }
        .divider-text {
          font-size: 0.65rem; letter-spacing: 0.15em;
          text-transform: uppercase; color: rgba(240,236,228,0.25);
          white-space: nowrap;
        }

        /* Google button */
        .google-btn {
          width: 100%; padding: 0.875rem 1.5rem;
          background: transparent;
          border: 1px solid rgba(180,140,60,0.25);
          color: #f0ece4; font-family: 'DM Sans', sans-serif;
          font-size: 0.875rem; font-weight: 400;
          letter-spacing: 0.02em; cursor: pointer;
          display: flex; align-items: center;
          justify-content: center; gap: 0.875rem;
          transition: all 0.3s ease;
          position: relative; overflow: hidden;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }

        .google-btn::before {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(180,140,60,0.08), transparent);
          opacity: 0; transition: opacity 0.3s ease;
        }

        .google-btn:hover::before { opacity: 1; }

        @media (hover: hover) {
          .google-btn:hover {
            border-color: rgba(180,140,60,0.5);
            transform: translateY(-1px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(180,140,60,0.1);
          }
          .google-btn:active { transform: translateY(0); }
        }

        @media (hover: none) {
          .google-btn:active {
            background: rgba(180,140,60,0.08);
            border-color: rgba(180,140,60,0.5);
          }
        }

        .google-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .google-btn-icon { width: 18px; height: 18px; flex-shrink: 0; }

        .trust-row {
          margin-top: 2rem; display: flex;
          align-items: center; justify-content: center;
          gap: 1.5rem; flex-wrap: wrap;
        }

        .trust-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.65rem; color: rgba(240,236,228,0.25); letter-spacing: 0.05em; }
        .trust-dot { width: 3px; height: 3px; border-radius: 50%; background: rgba(180,140,60,0.3); flex-shrink: 0; }

        /* Entrance animations */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim-1 { animation: fadeUp 0.6s ease forwards; }
        .anim-2 { animation: fadeUp 0.6s 0.1s ease both; }
        .anim-3 { animation: fadeUp 0.6s 0.2s ease both; }
        .anim-4 { animation: fadeUp 0.6s 0.3s ease both; }
        .anim-5 { animation: fadeUp 0.6s 0.4s ease both; }
        .anim-6 { animation: fadeUp 0.6s 0.5s ease both; }

        /* ── DESKTOP TABLET LANDSCAPE ── */
        @media (max-width: 1024px) {
          .left-panel { padding: 2rem; }
          .right-panel { width: 420px; padding: 2rem; }
        }

        /* ── TABLET PORTRAIT — stack vertically ── */
        @media (max-width: 768px) {
          .login-root { flex-direction: column; }

          /* Left panel becomes top brand section */
          .left-panel {
            border-right: none;
            padding: 2rem 1.5rem 1.5rem;
            flex: none;
          }

          .left-panel-inner { max-width: 100%; }
          .headline { font-size: clamp(2rem, 7vw, 3rem); }
          .features { margin-top: 1.5rem; gap: 0.75rem; }
          .left-footer { display: none; }

          /* Carousel appears on mobile/tablet */
          .carousel { display: block; padding: 0; }

          /* Right panel becomes login section below carousel */
          .right-panel {
            width: 100%; padding: 2rem 1.5rem 2.5rem;
            flex: none; align-items: stretch;
          }

          .login-card { max-width: 100%; }

          /* Hide the logo on mobile right panel
             — already shown at top of left panel */
          .logo-mark { display: none; }

          /* Login title closer to carousel */
          .card-title { margin-top: 0; }
        }

        /* ── MOBILE ── */
        @media (max-width: 480px) {
          .left-panel { padding: 1.75rem 1.25rem 1.25rem; }
          .eyebrow { font-size: 0.6rem; margin-bottom: 1rem; }
          .headline { font-size: clamp(1.75rem, 8vw, 2.25rem); margin-bottom: 0.875rem; }
          .subtext { font-size: 0.8rem; }
          .features { display: none; }

          .right-panel { padding: 1.5rem 1.25rem 2.5rem; }
          .card-title { font-size: 1.5rem; }
          .card-subtitle { font-size: 0.775rem; margin-bottom: 1.75rem; }
          .google-btn { padding: 1rem 1.25rem; font-size: 0.875rem; }
          .trust-row { gap: 1rem; margin-top: 1.25rem; }
        }

        /* ── VERY SMALL ── */
        @media (max-width: 360px) {
          .left-panel { padding: 1.5rem 1rem 1rem; }
          .right-panel { padding: 1.25rem 1rem 2rem; }
          .headline { font-size: 1.5rem; }
        }
      `}</style>

      <div className="login-root">

        {/* ══ LEFT PANEL — brand story (desktop)
               top section (mobile) ══ */}
        <div className="left-panel">

          {/* Logo lockup — top anchor */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Image
              src="/eflogo.png" alt="EventFlow"
              width={28} height={28} priority
              style={{ objectFit: "contain" }}
            />
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "1.1rem", color: "#f0ece4", letterSpacing: "0.12em",
            }}>
              Event<span style={{ color: "#b48c3c" }}>Flow</span>
            </span>
          </div>

          <div className="left-panel-inner">
            <div className="eyebrow anim-1">The Command Center</div>

            <h1 className="headline anim-2">
              Every great event<br />begins with <em>precision.</em>
            </h1>

            <p className="subtext anim-3">
              EventFlow gives Nigerian event planners a complete operations
              platform — from guest management to real-time catering tallies.
            </p>

            <div className="features anim-4">
              {[
                { label: "Zero gatecrasher entry",  desc: "QR-based verification in under 3 seconds" },
                { label: "Precision catering",       desc: "Exact meal counts before the event begins" },
                { label: "Vendor coordination",      desc: "No more endless WhatsApp groups" },
              ].map((f) => (
                <div className="feature-item" key={f.label}>
                  <div className="feature-dot" />
                  <p className="feature-text">
                    <strong>{f.label}</strong> — {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="left-footer">
            © {new Date().getFullYear()} EventFlow · Built for Nigeria
          </div>
        </div>

        {/* ══ CAROUSEL — mobile only, between brand text
               and login form ══ */}
        <div className="carousel anim-5">

          {/* Image track — all slides stacked, only
              active one is visible via opacity */}
          <div className="carousel-track">
            {CAROUSEL_IMAGES.map((src, i) => (
              <div
                key={src}
                className="carousel-slide"
                style={{
                  opacity: i === activeSlide && !fading ? 1 : 0,
                  // Only the active image is visible.
                  // fading=true briefly drops all to 0
                  // creating the crossfade effect
                }}
              >
                <Image
                  src={src}
                  alt={`Venue ${i + 1}`}
                  fill                    // fills the parent div completely
                  style={{ objectFit: "cover" }}
                  priority={i === 0}      // preload first image only
                  sizes="100vw"
                />
              </div>
            ))}
          </div>

          {/* Dot navigation — tap to jump to a slide */}
          <div className="carousel-dots">
            {CAROUSEL_IMAGES.map((_, i) => (
              <button
                key={i}
                className={`carousel-dot ${i === activeSlide ? "active" : ""}`}
                onClick={() => setActiveSlide(i)}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>

        </div>

        {/* ══ RIGHT PANEL — login form ══ */}
        <div className="right-panel">
          <div className="login-card">

            {/* Logo — desktop only (hidden on mobile
                via CSS to avoid duplication) */}
            <div className="logo-mark anim-1">
              <Image
                src="/eflogo.png" alt="EventFlow logo"
                width={36} height={36} priority
                style={{ objectFit: "contain" }}
              />
              <span className="logo-text">
                Event<span>Flow</span>
              </span>
            </div>

            <div className="anim-2">
              <h2 className="card-title">Planner Login</h2>
              <p className="card-subtitle">
                Sign in to access your command center and manage your events.
              </p>
            </div>

            <div className="divider anim-3">
              <div className="divider-line" />
              <span className="divider-text">Continue with</span>
              <div className="divider-line" />
            </div>

            <div className="anim-4">
              <button className="google-btn" onClick={signInWithGoogle}>
                <svg className="google-btn-icon" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84z" />
                </svg>
                Continue with Google
              </button>
            </div>

            <div className="trust-row anim-5">
              <div className="trust-item"><div className="trust-dot" />Plan</div>
              <div className="trust-item"><div className="trust-dot" />Deligate</div>
              <div className="trust-item"><div className="trust-dot" />Execute</div>
            </div>

          </div>
        </div>

      </div>
    </>
  )
}
