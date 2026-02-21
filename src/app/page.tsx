"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    setLoading(true)
    await signIn("google", { callbackUrl: "/dashboard" })
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          background-color: #0a0a0a;
          display: flex;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
          position: relative;
        }

        /* Ambient background */
        .login-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 20% 50%, rgba(180, 140, 60, 0.07) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 80% 20%, rgba(180, 140, 60, 0.05) 0%, transparent 50%);
          pointer-events: none;
          z-index: 0;
        }

        /* Grain overlay */
        .login-root::after {
          content: '';
          position: fixed;
          inset: -200%;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
          opacity: 0.025;
          pointer-events: none;
          z-index: 0;
        }

        /* Left panel */
        .left-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 3rem;
          position: relative;
          z-index: 1;
          border-right: 1px solid rgba(180, 140, 60, 0.1);
        }

        .left-panel-inner {
          display: flex;
          flex-direction: column;
          justify-content: center;
          flex: 1;
          max-width: 520px;
        }

        .eyebrow {
          font-family: 'DM Sans', sans-serif;
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

        .eyebrow::before {
          content: '';
          display: block;
          width: 2rem;
          height: 1px;
          background: #b48c3c;
          opacity: 0.6;
        }

        .headline {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(3rem, 5vw, 4.5rem);
          font-weight: 300;
          line-height: 1.05;
          color: #f0ece4;
          margin-bottom: 1.5rem;
          letter-spacing: -0.01em;
        }

        .headline em {
          font-style: italic;
          color: #b48c3c;
        }

        .subtext {
          font-size: 0.9rem;
          font-weight: 300;
          color: rgba(240, 236, 228, 0.45);
          line-height: 1.7;
          max-width: 380px;
        }

        /* Decorative vertical line */
        .deco-line {
          position: absolute;
          right: 3rem;
          top: 50%;
          transform: translateY(-50%);
          width: 1px;
          height: 120px;
          background: linear-gradient(to bottom, transparent, rgba(180, 140, 60, 0.3), transparent);
        }

        /* Feature list */
        .features {
          margin-top: 3rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .feature-item {
          display: flex;
          align-items: flex-start;
          gap: 0.875rem;
        }

        .feature-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #b48c3c;
          margin-top: 0.45rem;
          flex-shrink: 0;
        }

        .feature-text {
          font-size: 0.8rem;
          color: rgba(240, 236, 228, 0.4);
          font-weight: 300;
          line-height: 1.5;
        }

        .feature-text strong {
          color: rgba(240, 236, 228, 0.7);
          font-weight: 400;
        }

        /* Footer */
        .left-footer {
          font-size: 0.7rem;
          color: rgba(240, 236, 228, 0.2);
          letter-spacing: 0.05em;
        }

        /* Right panel */
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

        .login-card {
          width: 100%;
          max-width: 360px;
        }

        /* Logo mark */
        .logo-mark {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 3rem;
        }

        .logo-icon {
          width: 36px;
          height: 36px;
          border: 1px solid rgba(180, 140, 60, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .logo-icon::before {
          content: '';
          position: absolute;
          inset: 3px;
          border: 1px solid rgba(180, 140, 60, 0.2);
        }

        .logo-icon svg {
          width: 14px;
          height: 14px;
          color: #b48c3c;
        }

        .logo-text {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.25rem;
          font-weight: 400;
          color: #f0ece4;
          letter-spacing: 0.05em;
        }

        .logo-text span {
          color: #b48c3c;
        }

        /* Card header */
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
          color: rgba(240, 236, 228, 0.4);
          font-weight: 300;
          margin-bottom: 2.5rem;
          line-height: 1.6;
        }

        /* Divider */
        .divider {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .divider-line {
          flex: 1;
          height: 1px;
          background: rgba(180, 140, 60, 0.15);
        }

        .divider-text {
          font-size: 0.65rem;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(240, 236, 228, 0.25);
        }

        /* Google button */
        .google-btn {
          width: 100%;
          padding: 0.875rem 1.5rem;
          background: transparent;
          border: 1px solid rgba(180, 140, 60, 0.25);
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
        }

        .google-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(180, 140, 60, 0.08), transparent);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .google-btn:hover::before {
          opacity: 1;
        }

        .google-btn:hover {
          border-color: rgba(180, 140, 60, 0.5);
          transform: translateY(-1px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(180, 140, 60, 0.1);
        }

        .google-btn:active {
          transform: translateY(0);
        }

        .google-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .google-btn-icon {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        /* Loading spinner */
        .spinner {
          width: 16px;
          height: 16px;
          border: 1.5px solid rgba(180, 140, 60, 0.3);
          border-top-color: #b48c3c;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Trust badges */
        .trust-row {
          margin-top: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
        }

        .trust-item {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.65rem;
          color: rgba(240, 236, 228, 0.25);
          letter-spacing: 0.05em;
        }

        .trust-dot {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: rgba(180, 140, 60, 0.3);
        }

        /* Entrance animation */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .anim-1 { animation: fadeUp 0.6s ease forwards; }
        .anim-2 { animation: fadeUp 0.6s 0.1s ease both; }
        .anim-3 { animation: fadeUp 0.6s 0.2s ease both; }
        .anim-4 { animation: fadeUp 0.6s 0.3s ease both; }
        .anim-5 { animation: fadeUp 0.6s 0.4s ease both; }

        /* Responsive */
        @media (max-width: 768px) {
          .left-panel { display: none; }
          .right-panel { width: 100%; padding: 2rem 1.5rem; }
        }
      `}</style>

      <div className="login-root">
        {/* Left Panel */}
        <div className="left-panel">
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem", color: "rgba(240,236,228,0.3)", letterSpacing: "0.1em" }}>
            EF
          </div>

          <div className="left-panel-inner">
            <div className="eyebrow anim-1">The Command Center</div>
            <h1 className="headline anim-2">
              Every great event<br />begins with <em>precision.</em>
            </h1>
            <p className="subtext anim-3">
              EventFlow gives Nigerian event planners a complete operations platform — from guest management to real-time catering tallies.
            </p>

            <div className="features anim-4">
              {[
                { label: "Zero gatecrasher entry", desc: "QR-based verification in under 3 seconds" },
                { label: "Precision catering", desc: "Exact meal counts before the event begins" },
                { label: "Vendor coordination", desc: "No more endless WhatsApp groups" },
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
            © {new Date().getFullYear()} EventFlow · Powered by Dev Tunechi 
          </div>
        </div>

        {/* Right Panel */}
        <div className="right-panel">
          <div className="login-card">
            {/* Logo */}
            <div className="logo-mark anim-1">
              <div className="logo-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="logo-text">Event<span>Flow</span></span>
            </div>

            {/* Heading */}
            <div className="anim-2">
              <h2 className="card-title">Planner Login</h2>
              <p className="card-subtitle">
                Sign in to access your command center and manage your events.
              </p>
            </div>

            {/* Divider */}
            <div className="divider anim-3">
              <div className="divider-line" />
              <span className="divider-text">Continue with</span>
              <div className="divider-line" />
            </div>

            {/* Google Button */}
            <div className="anim-4">
              <button
                className="google-btn"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                {loading ? (
                  <div className="spinner" />
                ) : (
                  <svg className="google-btn-icon" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                {loading ? "Signing you in…" : "Continue with Google"}
              </button>
            </div>

            {/* Trust */}
            <div className="trust-row anim-5">
              <div className="trust-item">
                <div className="trust-dot" />
                Secure
              </div>
              <div className="trust-item">
                <div className="trust-dot" />
                No spam
              </div>
              <div className="trust-item">
                <div className="trust-dot" />
                Free to start
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
