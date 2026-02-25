"use client"

import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"

const CAROUSEL_IMAGES = [
  "/1.png", "/2.png", "/3.png",
  "/4.png", "/5.png", "/6.png",
]

const SLIDE_DURATION = 4000

const SOCIAL_LINKS = [
  {
    label: "X",
    href: "https://x.com/eventflow",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L2.168 2.25H8.56l4.265 5.638 5.42-5.638Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://instagram.com/eventflow",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
        <circle cx="12" cy="12" r="4"/>
        <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://tiktok.com/@eventflow",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://youtube.com/@eventflow",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "https://facebook.com/eventflow",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/company/eventflow",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 23.2 24 22.222 0h.003z"/>
      </svg>
    ),
  },
]

const FEATURES = [
  { label: "Zero gatecrasher entry",  desc: "QR-based verification in under 3 seconds" },
  { label: "Precision catering",       desc: "Exact meal counts before the event begins" },
  { label: "Vendor coordination",      desc: "No more endless WhatsApp groups" },
]

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth()
  const router = useRouter()

  const [activeSlide, setActiveSlide] = useState(0)
  const [transitioning, setTransitioning] = useState(false)

  useEffect(() => {
    if (!loading && user) router.push("/dashboard")
  }, [user, loading, router])

  const nextSlide = useCallback(() => {
    setTransitioning(true)
    setTimeout(() => {
      setActiveSlide(prev => (prev + 1) % CAROUSEL_IMAGES.length)
      setTransitioning(false)
    }, 600)
  }, [])

  useEffect(() => {
    const timer = setInterval(nextSlide, SLIDE_DURATION)
    return () => clearInterval(timer)
  }, [nextSlide])

  const goToSlide = (i: number) => {
    if (i === activeSlide) return
    setTransitioning(true)
    setTimeout(() => {
      setActiveSlide(i)
      setTransitioning(false)
    }, 600)
  }

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0a0a0a",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 20, height: 20,
          border: "1.5px solid rgba(180,140,60,0.3)",
          borderTopColor: "#b48c3c", borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const dotsJSX = (light = false) => (
    <div className="lp-carousel-dots">
      {CAROUSEL_IMAGES.map((_, i) => (
        <button
          key={i}
          className={`lp-dot${i === activeSlide ? " active" : ""}${light ? " light" : ""}`}
          onClick={() => goToSlide(i)}
          aria-label={`Go to slide ${i + 1}`}
        />
      ))}
    </div>
  )

  const footerJSX = (
    <footer className="lp-footer">
      <div className="lp-social-row">
        {SOCIAL_LINKS.map(s => (
          <a
            key={s.label}
            href={s.href}
            className="lp-social-link"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.label}
          >
            {s.icon}
          </a>
        ))}
      </div>
      <p className="lp-footer-copy">
        © {new Date().getFullYear()} EventFlow &nbsp;·&nbsp;
        Powered by <span>Dev Tunechi</span>
      </p>
      <div className="lp-footer-legal">
        <Link href="/privacy" className="lp-footer-legal-link">Privacy Policy</Link>
        <span className="lp-footer-legal-dot">·</span>
        <Link href="/data-deletion" className="lp-footer-legal-link">Data Deletion</Link>
      </div>
    </footer>
  )

  const googleBtn = (
    <button className="lp-google-btn" onClick={signInWithGoogle}>
      <svg className="lp-google-icon" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84z" />
      </svg>
      Continue with Google
    </button>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }

        .lp-root {
          min-height: 100vh; min-height: 100dvh;
          background-color: #0a0a0a;
          font-family: 'DM Sans', sans-serif;
          position: relative;
        }
        .lp-root::before {
          content: ''; position: fixed; inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 20% 30%, rgba(180,140,60,0.07) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 80% 70%, rgba(180,140,60,0.05) 0%, transparent 50%);
          pointer-events: none; z-index: 0;
        }
        .lp-root::after {
          content: ''; position: fixed; inset: -200%;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
          opacity: 0.025; pointer-events: none; z-index: 0;
        }

        .lp-desktop {
          display: none;
          height: 100vh; height: 100dvh;
          position: relative; z-index: 1;
        }

        .lp-left {
          position: absolute; inset: 0 42% 0 0;
          display: flex; flex-direction: column;
          overflow: hidden; background: #080808;
        }

        .lp-left-carousel {
          width: 100%; aspect-ratio: 16 / 9;
          position: relative; flex-shrink: 0;
          overflow: hidden; background: #111;
        }
        .lp-left-carousel-slide {
          position: absolute; inset: 0; opacity: 0;
          transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .lp-left-carousel-slide.active { opacity: 1; }
        .lp-left-carousel::after {
          content: ''; position: absolute;
          bottom: 0; left: 0; right: 0; height: 30%;
          background: linear-gradient(to bottom, transparent, #080808);
          z-index: 2; pointer-events: none;
        }
        .lp-left-carousel .lp-carousel-dots {
          position: absolute; bottom: 0.75rem; left: 50%;
          transform: translateX(-50%); z-index: 3;
        }

        .lp-left-brand {
          flex: 1; padding: 2rem 2.75rem 2.25rem;
          display: flex; flex-direction: column;
          justify-content: center; background: #080808;
        }

        .lp-left-eyebrow {
          font-size: 0.62rem; font-weight: 500;
          letter-spacing: 0.3em; text-transform: uppercase;
          color: #b48c3c; margin-bottom: 1rem;
          display: flex; align-items: center; gap: 0.75rem;
        }
        .lp-left-eyebrow::before {
          content: ''; width: 2.5rem; height: 1px;
          background: #b48c3c; opacity: 0.6; flex-shrink: 0;
        }

        .lp-left-headline {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(1.9rem, 2.6vw, 3rem);
          font-weight: 300; line-height: 1.1;
          color: #f0ece4; margin-bottom: 1.5rem;
          letter-spacing: -0.01em;
        }
        .lp-left-headline em { font-style: italic; color: #b48c3c; }

        .lp-left-features { display: flex; flex-direction: column; gap: 0.85rem; }
        .lp-left-feature {
          display: flex; align-items: flex-start; gap: 0.875rem;
          font-size: 0.82rem; color: rgba(240,236,228,0.55);
          font-weight: 300; line-height: 1.55;
        }
        .lp-left-feature-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: #b48c3c; margin-top: 0.5rem; flex-shrink: 0;
          box-shadow: 0 0 6px rgba(180,140,60,0.5);
        }
        .lp-left-feature strong { color: #e8e0d0; font-weight: 500; }

        .lp-right {
          position: absolute; inset: 0 0 0 58%;
          display: flex; flex-direction: column;
          justify-content: space-between;
          padding: 3rem 3.5rem;
          border-left: 1px solid rgba(180,140,60,0.12);
          overflow-y: auto;
        }

        .lp-right-top {
          display: flex; flex-direction: column;
          justify-content: center; flex: 1; max-width: 420px;
        }

        .lp-right-logo {
          display: flex; align-items: center; gap: 0.7rem;
          text-decoration: none; margin-bottom: 3.5rem;
        }
        .lp-right-logo-text {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.4rem; color: #f0ece4; letter-spacing: 0.14em;
        }
        .lp-right-logo-text span { color: #b48c3c; }

        .lp-card-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 2.25rem; font-weight: 300;
          color: #f0ece4; margin-bottom: 0.5rem;
          letter-spacing: -0.01em; line-height: 1.1;
        }
        .lp-card-subtitle {
          font-size: 0.9rem; color: rgba(240,236,228,0.55);
          font-weight: 300; margin-bottom: 2rem; line-height: 1.6;
        }

        .lp-divider {
          display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem;
        }
        .lp-divider-line { flex: 1; height: 1px; background: rgba(180,140,60,0.18); }
        .lp-divider-text {
          font-size: 0.62rem; letter-spacing: 0.18em;
          text-transform: uppercase; color: rgba(240,236,228,0.3); white-space: nowrap;
        }

        .lp-google-btn {
          width: 100%; padding: 1rem 1.5rem;
          background: transparent; border: 1px solid rgba(180,140,60,0.3);
          color: #f0ece4; font-family: 'DM Sans', sans-serif;
          font-size: 0.95rem; font-weight: 400; letter-spacing: 0.02em;
          cursor: pointer; display: flex; align-items: center;
          justify-content: center; gap: 0.875rem;
          transition: all 0.3s ease; position: relative; overflow: hidden;
          -webkit-tap-highlight-color: transparent;
        }
        .lp-google-btn::before {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(180,140,60,0.1), transparent);
          opacity: 0; transition: opacity 0.3s ease;
        }
        .lp-google-btn:hover::before { opacity: 1; }
        .lp-google-btn:hover {
          border-color: rgba(180,140,60,0.6);
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(0,0,0,0.35);
        }
        .lp-google-btn:active { transform: translateY(0); }
        .lp-google-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .lp-google-icon { width: 19px; height: 19px; flex-shrink: 0; }

        .lp-trust {
          margin-top: 1.25rem; display: flex; align-items: center;
          justify-content: center; gap: 1.5rem; flex-wrap: wrap;
        }
        .lp-trust-item {
          display: flex; align-items: center; gap: 0.4rem;
          font-size: 0.68rem; color: rgba(240,236,228,0.35); letter-spacing: 0.06em;
        }
        .lp-trust-dot {
          width: 3px; height: 3px; border-radius: 50%;
          background: rgba(180,140,60,0.45); flex-shrink: 0;
        }

        /* ── Footer ── */
        .lp-footer {
          flex-shrink: 0; padding: 1rem 0 0;
          border-top: 1px solid rgba(180,140,60,0.1); margin-top: 1rem;
        }
        .lp-social-row {
          display: flex; align-items: center;
          justify-content: center; gap: 1.125rem; margin-bottom: 0.6rem;
        }
        .lp-social-link {
          color: rgba(240,236,228,0.45); text-decoration: none;
          transition: color 0.2s ease; display: flex; align-items: center;
          -webkit-tap-highlight-color: transparent;
        }
        .lp-social-link:hover { color: #b48c3c; }
        .lp-footer-copy {
          text-align: center; font-size: 0.62rem;
          color: rgba(240,236,228,0.3); letter-spacing: 0.04em;
          margin-bottom: 0.5rem;
        }
        .lp-footer-copy span { color: rgba(180,140,60,0.6); }

        /* Legal links */
        .lp-footer-legal {
          display: flex; align-items: center; justify-content: center;
          gap: 0.5rem; padding-top: 0.25rem;
        }
        .lp-footer-legal-link {
          font-size: 0.6rem; color: rgba(240,236,228,0.25);
          text-decoration: none; letter-spacing: 0.06em;
          transition: color 0.2s;
        }
        .lp-footer-legal-link:hover { color: #b48c3c; }
        .lp-footer-legal-dot {
          font-size: 0.6rem; color: rgba(240,236,228,0.15);
        }

        /* Dots */
        .lp-carousel-dots {
          display: flex; justify-content: center; gap: 0.45rem; padding: 0.5rem 0 0.2rem;
        }
        .lp-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: rgba(240,236,228,0.25);
          transition: background 0.4s ease, transform 0.4s ease, width 0.4s ease;
          cursor: pointer; border: none; padding: 0;
        }
        .lp-dot.active { background: #b48c3c; transform: scale(1.4); box-shadow: 0 0 6px rgba(180,140,60,0.6); }
        .lp-dot.light { background: rgba(255,255,255,0.35); }
        .lp-dot.light.active { background: #b48c3c; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim-1 { animation: fadeUp 0.55s ease forwards; }
        .anim-2 { animation: fadeUp 0.55s 0.08s ease both; }
        .anim-3 { animation: fadeUp 0.55s 0.16s ease both; }
        .anim-4 { animation: fadeUp 0.55s 0.24s ease both; }
        .anim-5 { animation: fadeUp 0.55s 0.32s ease both; }
        .anim-6 { animation: fadeUp 0.55s 0.40s ease both; }

        /* ── Mobile ── */
        .lp-mobile {
          display: flex; flex-direction: column;
          min-height: 100vh; min-height: 100dvh;
          position: relative; z-index: 1;
        }
        .lp-mobile-inner {
          width: 100%; max-width: 480px; margin: 0 auto;
          display: flex; flex-direction: column; flex: 1; padding: 0 1.5rem;
        }
        .lp-header {
          display: flex; align-items: center; justify-content: space-between;
          padding-top: 1.375rem; padding-bottom: 0.875rem; flex-shrink: 0;
        }
        .lp-logo {
          display: flex; align-items: center; gap: 0.55rem; text-decoration: none;
        }
        .lp-logo-text {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.15rem; color: #f0ece4; letter-spacing: 0.12em;
        }
        .lp-logo-text span { color: #b48c3c; }
        .lp-eyebrow {
          font-size: 0.6rem; font-weight: 500;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: rgba(180,140,60,0.75);
        }
        .lp-hero { flex-shrink: 0; padding-bottom: 1rem; }
        .lp-headline {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(1.75rem, 5vw, 2.25rem);
          font-weight: 300; line-height: 1.1;
          color: #f0ece4; margin-bottom: 0.45rem; letter-spacing: -0.01em;
        }
        .lp-headline em { font-style: italic; color: #b48c3c; }
        .lp-subtext {
          font-size: 0.82rem; font-weight: 300;
          color: rgba(240,236,228,0.55); line-height: 1.55;
        }
        .lp-mobile-carousel {
          flex-shrink: 0; margin-left: -1.5rem; margin-right: -1.5rem; position: relative;
        }
        .lp-mobile-carousel-track {
          width: 100%; aspect-ratio: 16 / 9;
          position: relative; overflow: hidden; background: #111;
        }
        .lp-mobile-carousel-track::after {
          content: ''; position: absolute;
          bottom: 0; left: 0; right: 0; height: 30%;
          background: linear-gradient(to bottom, transparent, #0a0a0a);
          z-index: 2; pointer-events: none;
        }
        .lp-mobile-carousel-slide {
          position: absolute; inset: 0; opacity: 0;
          transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .lp-mobile-carousel-slide.active { opacity: 1; }
        .lp-login {
          flex: 1; display: flex; flex-direction: column;
          justify-content: center; padding-top: 0.875rem; min-height: 0;
        }
        .lp-mobile .lp-card-title { font-size: 1.75rem; color: #f0ece4; }
        .lp-mobile .lp-card-subtitle {
          font-size: 0.82rem; color: rgba(240,236,228,0.55); margin-bottom: 1.25rem;
        }
        .lp-mobile .lp-google-btn { font-size: 0.88rem; padding: 0.875rem 1.25rem; }

        @media (min-width: 1024px) {
          .lp-desktop { display: block; }
          .lp-mobile  { display: none; }
        }
        @media (max-height: 680px) and (max-width: 1023px) {
          .lp-subtext { display: none; }
          .lp-mobile .lp-card-subtitle { margin-bottom: 0.75rem; }
        }
        @media (max-height: 480px) and (max-width: 1023px) {
          .lp-mobile-carousel { display: none; }
          .lp-subtext { display: none; }
        }
      `}</style>

      <div className="lp-root">

        {/* ── DESKTOP ── */}
        <div className="lp-desktop">
          <div className="lp-left">
            <div className="lp-left-carousel">
              {CAROUSEL_IMAGES.map((src, i) => (
                <div key={src} className={`lp-left-carousel-slide${i === activeSlide && !transitioning ? " active" : ""}`}>
                  <Image src={src} alt={`Event venue ${i + 1}`} fill style={{ objectFit: "cover" }} priority={i === 0} sizes="58vw" />
                </div>
              ))}
              {dotsJSX(true)}
            </div>
            <div className="lp-left-brand anim-1">
              <div className="lp-left-eyebrow">The Command Center</div>
              <h1 className="lp-left-headline">Every great event<br />begins with <em>precision.</em></h1>
              <div className="lp-left-features">
                {FEATURES.map(f => (
                  <div className="lp-left-feature" key={f.label}>
                    <div className="lp-left-feature-dot" />
                    <span><strong>{f.label}</strong> — {f.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lp-right">
            <div className="lp-right-top">
              <a href="/" className="lp-right-logo anim-1" aria-label="EventFlow home">
                <Image src="/eflogo.png" alt="EventFlow" width={36} height={36} priority style={{ objectFit: "contain" }} />
                <span className="lp-right-logo-text">Event<span>Flow</span></span>
              </a>
              <div className="anim-2">
                <h2 className="lp-card-title">Planner Login</h2>
                <p className="lp-card-subtitle">Sign in to access your command center and manage your events.</p>
              </div>
              <div className="lp-divider anim-3">
                <div className="lp-divider-line" />
                <span className="lp-divider-text">Continue with</span>
                <div className="lp-divider-line" />
              </div>
              <div className="anim-4">
                {googleBtn}
                <div className="lp-trust">
                  <div className="lp-trust-item"><div className="lp-trust-dot" />Secure</div>
                  <div className="lp-trust-item"><div className="lp-trust-dot" />No spam</div>
                  <div className="lp-trust-item"><div className="lp-trust-dot" />Free to start</div>
                </div>
              </div>
            </div>
            <div className="anim-5">{footerJSX}</div>
          </div>
        </div>

        {/* ── MOBILE ── */}
        <div className="lp-mobile">
          <div className="lp-mobile-inner">
            <header className="lp-header anim-1">
              <a href="/" className="lp-logo" aria-label="EventFlow home">
                <Image src="/eflogo.png" alt="EventFlow" width={28} height={28} priority style={{ objectFit: "contain" }} />
                <span className="lp-logo-text">Event<span>Flow</span></span>
              </a>
              <span className="lp-eyebrow">The Command Center</span>
            </header>

            <div className="lp-hero anim-2">
              <h1 className="lp-headline">Every great event<br />begins with <em>precision.</em></h1>
              <p className="lp-subtext">The complete operations platform for Nigerian event planners.</p>
            </div>

            <div className="lp-mobile-carousel anim-3">
              <div className="lp-mobile-carousel-track">
                {CAROUSEL_IMAGES.map((src, i) => (
                  <div key={src} className={`lp-mobile-carousel-slide${i === activeSlide && !transitioning ? " active" : ""}`}>
                    <Image src={src} alt={`Event venue ${i + 1}`} fill style={{ objectFit: "cover" }} priority={i === 0} sizes="100vw" />
                  </div>
                ))}
              </div>
              {dotsJSX()}
            </div>

            <div className="lp-login anim-4">
              <h2 className="lp-card-title">Planner Login</h2>
              <p className="lp-card-subtitle">Sign in to access your command center.</p>
              <div className="lp-divider">
                <div className="lp-divider-line" />
                <span className="lp-divider-text">Continue with</span>
                <div className="lp-divider-line" />
              </div>
              {googleBtn}
              <div className="lp-trust">
                <div className="lp-trust-item"><div className="lp-trust-dot" />Secure</div>
                <div className="lp-trust-item"><div className="lp-trust-dot" />No spam</div>
                <div className="lp-trust-item"><div className="lp-trust-dot" />Free to start</div>
              </div>
            </div>

            <div className="anim-5">{footerJSX}</div>
          </div>
        </div>

      </div>
    </>
  )
}
