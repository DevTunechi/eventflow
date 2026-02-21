// ─────────────────────────────────────────────
// src/app/(auth)/login/page.tsx
// The first screen a planner sees.
// Two-panel layout: brand story left,
// Google sign-in right. Fully responsive.
// ─────────────────────────────────────────────

"use client"

import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function LoginPage() {
  // Pull auth state and the sign-in function
  // from our global AuthContext
  const { user, loading, signInWithGoogle } = useAuth()
  const router = useRouter()

  // If the user is already signed in (returning
  // visitor with active session), skip login
  // and go straight to the dashboard
  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard")
    }
  }, [user, loading, router])

  // While Firebase is checking the session,
  // show a minimal gold spinner on black
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{
          width: 20,
          height: 20,
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
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }

        /* ── Root container ── */
        .login-root {
          min-height: 100vh;
          min-height: 100dvh; /* 100dvh fixes Safari mobile address bar */
          background-color: #0a0a0a;
          display: flex;
          font-family: 'DM Sans', sans-serif;
          overflow-x: hidden;
          position: relative;
        }

        /* Warm gold ambient glow — two radial
           gradients layered for depth */
        .login-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 20% 50%, rgba(180,140,60,0.07) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 80% 20%, rgba(180,140,60,0.05) 0%, transparent 50%);
          pointer-events: none;
          z-index: 0;
        }

        /* Subtle film grain overlay for texture */
        .login-root::after {
          content: '';
          position: fixed;
          inset: -200%;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
          opacity: 0.025;
          pointer-events: none;
          z-index: 0;
        }

        /* ── LEFT PANEL — brand story ── */
        .left-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 3rem;
          position: relative;
          z-index: 1;
          /* Subtle gold separator line */
          border-right: 1px solid rgba(180,140,60,0.1);
        }

        .left-panel-inner {
          display: flex;
          flex-direction: column;
          justify-content: center;
          flex: 1;
          max-width: 520px;
        }

        /* Small all-caps label above headline */
        .eyebrow {
          font-size: 0.65rem;
          font-weight: 500;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: #b48c3c;
          margin-bottom: 2rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        /* Short gold line before eyebrow text */
        .eyebrow::before {
          content: '';
          display: block;
          width: 2rem;
          height: 1px;
          background: #b48c3c;
          opacity: 0.6;
          flex-shrink: 0;
        }

        /* Main editorial headline — Cormorant serif
           clamp() scales fluidly between breakpoints */
        .headline {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(2.5rem, 4vw, 4.5rem);
          font-weight: 300;
          line-height: 1.05;
          color: #f0ece4;
          margin-bottom: 1.5rem;
          letter-spacing: -0.01em;
        }

        /* Italic gold emphasis word in headline */
        .headline em { font-style: italic; color: #b48c3c; }

        .subtext {
          font-size: 0.9rem;
          font-weight: 300;
          color: rgba(240,236,228,0.45);
          line-height: 1.7;
          max-width: 380px;
        }

        /* Three feature bullets below subtext */
        .features { margin-top: 3rem; display: flex; flex-direction: column; gap: 1rem; }
        .feature-item { display: flex; align-items: flex-start; gap: 0.875rem; }

        /* Small gold dot acting as bullet */
        .feature-dot {
          width: 4px; height: 4px;
          border-radius: 50%;
          background: #b48c3c;
          margin-top: 0.45rem;
          flex-shrink: 0;
        }

        .feature-text { font-size: 0.8rem; color: rgba(240,236,228,0.4); font-weight: 300; line-height: 1.5; }
        .feature-text strong { color: rgba(240,236,228,0.7); font-weight: 400; }

        /* Copyright line at very bottom of left panel */
        .left-footer { font-size: 0.7rem; color: rgba(240,236,228,0.2); letter-spacing: 0.05em; }

        /* ── RIGHT PANEL — login form ── */
        .right-panel {
          width: 480px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 3rem;
          position: relative;
          z-index: 1;
        }

        /* Login card — constrained max width */
        .login-card { width: 100%; max-width: 360px; }

        /* Logo lockup: EF mark + wordmark */
        .logo-mark { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 3rem; }

        /* The actual .png logo from /public */
        .logo-img { width: 36px; height: 36px; object-fit: contain; }

        .logo-text {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.25rem;
          font-weight: 400;
          color: #f0ece4;
          letter-spacing: 0.05em;
        }

        /* "Flow" in gold to split the wordmark */
        .logo-text span { color: #b48c3c; }

        .card-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.875rem;
          font-weight: 300;
          color: #f0ece4;
          margin-bottom: 0.5rem;
          letter-spacing: -0.01em;
        }

        .card-subtitle {
          font-size: 0.8rem;
          color: rgba(240,236,228,0.4);
          font-weight: 300;
          margin-bottom: 2.5rem;
          line-height: 1.6;
        }

        /* "Continue with" divider row */
        .divider { display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; }
        .divider-line { flex: 1; height: 1px; background: rgba(180,140,60,0.15); }
        .divider-text {
          font-size: 0.65rem;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(240,236,228,0.25);
          white-space: nowrap;
        }

        /* ── Google sign-in button ── */
        .google-btn {
          width: 100%;
          padding: 0.875rem 1.5rem;
          background: transparent;
          border: 1px solid rgba(180,140,60,0.25);
          color: #f0ece4;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.875rem;
          font-weight: 400;
          letter-spacing: 0.02em;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.875rem;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          -webkit-tap-highlight-color: transparent; /* removes iOS blue flash on tap */
          touch-action: manipulation;               /* removes 300ms tap delay on mobile */
        }

        /* Hover shimmer overlay */
        .google-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(180,140,60,0.08), transparent);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .google-btn:hover::before { opacity: 1; }

        /* Hover lift — only on devices with a pointer
           (mouse). Skipped on touch to avoid sticky hover */
        @media (hover: hover) {
          .google-btn:hover {
            border-color: rgba(180,140,60,0.5);
            transform: translateY(-1px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(180,140,60,0.1);
          }
          .google-btn:active { transform: translateY(0); }
        }

        /* Touch device press state instead */
        @media (hover: none) {
          .google-btn:active {
            background: rgba(180,140,60,0.08);
            border-color: rgba(180,140,60,0.5);
          }
        }

        .google-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .google-btn-icon { width: 18px; height: 18px; flex-shrink: 0; }

        /* Small trust signals below the button */
        .trust-row {
          margin-top: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          flex-wrap: wrap; /* wraps on very small screens */
        }

        .trust-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.65rem; color: rgba(240,236,228,0.25); letter-spacing: 0.05em; }
        .trust-dot { width: 3px; height: 3px; border-radius: 50%; background: rgba(180,140,60,0.3); flex-shrink: 0; }

        /* ── Entrance animations ── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Each element staggers in 100ms after the last */
        .anim-1 { animation: fadeUp 0.6s ease forwards; }
        .anim-2 { animation: fadeUp 0.6s 0.1s ease both; }
        .anim-3 { animation: fadeUp 0.6s 0.2s ease both; }
        .anim-4 { animation: fadeUp 0.6s 0.3s ease both; }
        .anim-5 { animation: fadeUp 0.6s 0.4s ease both; }

        /* ── RESPONSIVE BREAKPOINTS ── */

        /* Tablet landscape — tighten padding */
        @media (max-width: 1024px) {
          .left-panel { padding: 2rem; }
          .right-panel { width: 420px; padding: 2rem; }
        }

        /* Tablet portrait — stack panels vertically */
        @media (max-width: 768px) {
          .login-root { flex-direction: column; }
          .left-panel {
            border-right: none;
            border-bottom: 1px solid rgba(180,140,60,0.1);
            padding: 2.5rem 1.5rem 2rem;
            flex: none; /* don't stretch, just natural height */
          }
          .left-panel-inner { max-width: 100%; }
          .headline { font-size: clamp(2rem, 7vw, 3rem); }
          .features { margin-top: 1.5rem; gap: 0.75rem; }
          .left-footer { display: none; } /* not needed when stacked */
          .right-panel { width: 100%; padding: 2.5rem 1.5rem; flex: none; }
          .login-card { max-width: 100%; }
          .logo-mark { margin-bottom: 2rem; }
        }

        /* Mobile — simplify further */
        @media (max-width: 480px) {
          .left-panel { padding: 2rem 1.25rem 1.75rem; }
          .eyebrow { font-size: 0.6rem; margin-bottom: 1.25rem; }
          .headline { font-size: clamp(1.75rem, 8vw, 2.5rem); margin-bottom: 1rem; }
          .subtext { font-size: 0.825rem; }
          .features { display: none; } /* hidden on small screens to save space */
          .right-panel { padding: 2rem 1.25rem 3rem; }
          .card-title { font-size: 1.625rem; }
          .card-subtitle { font-size: 0.775rem; margin-bottom: 2rem; }
          .google-btn { padding: 1rem 1.25rem; font-size: 0.9rem; }
          .trust-row { gap: 1rem; margin-top: 1.5rem; }
        }

        /* Very small screens (older budget Androids) */
        @media (max-width: 360px) {
          .left-panel { padding: 1.5rem 1rem 1.25rem; }
          .right-panel { padding: 1.75rem 1rem 2.5rem; }
          .headline { font-size: 1.625rem; }
        }

        /* Tall phones (iPhone Pro Max, etc.)
           add extra breathing room top and bottom */
        @media (max-width: 480px) and (min-height: 800px) {
          .right-panel { padding-top: 3rem; padding-bottom: 4rem; }
        }
      `}</style>

      <div className="login-root">

        {/* ── LEFT PANEL ── */}
        <div className="left-panel">

          {/* Top-left EF monogram — subtle brand anchor */}
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.1rem",
            color: "rgba(240,236,228,0.3)",
            letterSpacing: "0.1em"
          }}>
            EF
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

            {/* Three key selling points */}
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

        {/* ── RIGHT PANEL ── */}
        <div className="right-panel">
          <div className="login-card">

            {/* Logo: PNG from /public + wordmark */}
            <div className="logo-mark anim-1">
              <img
                src="/eflogo.png"
                alt="EventFlow logo"
                className="logo-img"
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

            {/* Decorative divider with label */}
            <div className="divider anim-3">
              <div className="divider-line" />
              <span className="divider-text">Continue with</span>
              <div className="divider-line" />
            </div>

            {/* Google sign-in — triggers Firebase popup */}
            <div className="anim-4">
              <button className="google-btn" onClick={signInWithGoogle}>
                {/* Official Google G logo SVG */}
                <svg className="google-btn-icon" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84z" />
                </svg>
                Continue with Google
              </button>
            </div>

            {/* Trust signals — reassure first-time planners */}
            <div className="trust-row anim-5">
              <div className="trust-item"><div className="trust-dot" />Secure</div>
              <div className="trust-item"><div className="trust-dot" />No spam</div>
              <div className="trust-item"><div className="trust-dot" />Free to start</div>
            </div>

          </div>
        </div>

      </div>
    </>
  )
}
