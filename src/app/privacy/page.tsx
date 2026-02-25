"use client"

import Link from "next/link"
import Image from "next/image"

export default function PrivacyPolicyPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .pp-root {
          min-height: 100vh;
          background: #0a0a0a;
          font-family: 'DM Sans', sans-serif;
          color: #f0ece4;
        }
        .pp-root::before {
          content: ''; position: fixed; inset: 0;
          background: radial-gradient(ellipse 80% 60% at 20% 30%, rgba(180,140,60,0.05) 0%, transparent 60%);
          pointer-events: none; z-index: 0;
        }

        .pp-nav {
          position: relative; z-index: 1;
          border-bottom: 1px solid rgba(180,140,60,0.1);
          padding: 1.25rem 2rem;
          display: flex; align-items: center; gap: 0.7rem;
          text-decoration: none; width: fit-content;
        }
        .pp-nav-logo {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.2rem; color: #f0ece4; letter-spacing: 0.14em;
        }
        .pp-nav-logo span { color: #b48c3c; }

        .pp-container {
          max-width: 680px;
          margin: 0 auto;
          padding: 4rem 2rem 6rem;
          position: relative; z-index: 1;
        }

        .pp-eyebrow {
          font-size: 0.62rem; font-weight: 500;
          letter-spacing: 0.3em; text-transform: uppercase;
          color: #b48c3c; margin-bottom: 1rem;
          display: flex; align-items: center; gap: 0.75rem;
        }
        .pp-eyebrow::before {
          content: ''; width: 2rem; height: 1px;
          background: #b48c3c; opacity: 0.6;
        }

        .pp-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(2rem, 4vw, 2.75rem);
          font-weight: 300; line-height: 1.1;
          color: #f0ece4; margin-bottom: 0.5rem;
          letter-spacing: -0.01em;
        }

        .pp-updated {
          font-size: 0.72rem; color: rgba(240,236,228,0.3);
          margin-bottom: 3rem; padding-bottom: 2rem;
          border-bottom: 1px solid rgba(180,140,60,0.1);
        }

        .pp-section { margin-bottom: 2.25rem; }

        .pp-section-title {
          font-size: 0.63rem; font-weight: 500;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: #b48c3c; margin-bottom: 0.875rem;
        }

        .pp-body {
          font-size: 0.875rem;
          color: rgba(240,236,228,0.65);
          line-height: 1.85; font-weight: 300;
        }
        .pp-body + .pp-body { margin-top: 0.875rem; }
        .pp-body strong { color: #e8e0d0; font-weight: 500; }
        .pp-body a { color: #b48c3c; text-decoration: none; }
        .pp-body a:hover { text-decoration: underline; }

        .pp-list {
          margin-top: 0.625rem;
          display: flex; flex-direction: column; gap: 0.5rem;
        }
        .pp-list li {
          font-size: 0.875rem;
          color: rgba(240,236,228,0.65);
          line-height: 1.75; font-weight: 300;
          list-style: none; position: relative;
          padding-left: 1.125rem;
        }
        .pp-list li::before {
          content: '';
          position: absolute; left: 0; top: 0.65rem;
          width: 4px; height: 4px; border-radius: 50%;
          background: rgba(180,140,60,0.5);
        }

        .pp-divider {
          height: 1px;
          background: rgba(180,140,60,0.08);
          margin: 2.25rem 0;
        }

        .pp-callout {
          padding: 1.375rem 1.5rem;
          border: 1px solid rgba(180,140,60,0.15);
          border-radius: 8px;
          background: rgba(180,140,60,0.03);
        }

        .pp-back {
          display: inline-flex; align-items: center; gap: 0.4rem;
          font-size: 0.75rem; color: rgba(240,236,228,0.35);
          text-decoration: none; margin-top: 3rem;
          transition: color 0.2s;
        }
        .pp-back:hover { color: #b48c3c; }
      `}</style>

      <div className="pp-root">
        <Link href="/login" className="pp-nav">
          <Image src="/eflogo.png" alt="EventFlow" width={28} height={28} style={{ objectFit: "contain" }} />
          <span className="pp-nav-logo">Event<span>Flow</span></span>
        </Link>

        <div className="pp-container">
          <div className="pp-eyebrow">Legal</div>
          <h1 className="pp-title">Privacy Policy</h1>
          <p className="pp-updated">Last updated: February 2026</p>

          <div className="pp-section">
            <div className="pp-section-title">Who We Are</div>
            <p className="pp-body">
              EventFlow is a Nigerian event management platform built for professional event planners. We handle the operational side of events — guest lists, RSVP flows, QR-based entry, table assignments, vendor coordination, and catering logistics. This policy explains what data we collect from planners and their guests, why we collect it, and how it's handled. We've written it to be read, not skimmed past.
            </p>
          </div>

          <div className="pp-divider" />

          <div className="pp-section">
            <div className="pp-section-title">Data We Collect</div>
            <p className="pp-body">We work with two types of people — event planners and their guests. Here's what we collect from each.</p>

            <p className="pp-body" style={{ marginTop: "1.125rem" }}><strong>From planners:</strong></p>
            <ul className="pp-list">
              <li>Your name, email address, and profile photo — collected when you sign in with Google</li>
              <li>Event details you create: names, dates, venue info, guest tiers, seating configurations, and menu items</li>
              <li>Vendor and usher information you add to your events — names, phone numbers, and roles</li>
              <li>WhatsApp Business credentials — if you connect your Meta account, your access token is stored encrypted (AES-256-GCM) and never exposed through any API response</li>
              <li>Invitation card files — uploaded directly to your own Google Drive. We store only the resulting URL, not the file itself</li>
            </ul>

            <p className="pp-body" style={{ marginTop: "1.125rem" }}><strong>From guests (collected during RSVP):</strong></p>
            <ul className="pp-list">
              <li>First name, last name, phone number, and email address</li>
              <li>Meal preferences — only for guests in pre-order tiers (VIP, Family, Special Guests). General guests order on the day</li>
              <li>Phone verification status — if the planner has enabled OTP verification for their event</li>
              <li>Check-in status and timestamp — recorded when a guest scans their QR code at the gate</li>
              <li>Tribute messages — optional notes guests choose to leave for the host during registration</li>
            </ul>
          </div>

          <div className="pp-divider" />

          <div className="pp-section">
            <div className="pp-section-title">Why We Collect It</div>
            <p className="pp-body">Everything we collect has a direct purpose in running a smooth, secure event. Specifically:</p>
            <ul className="pp-list">
              <li>Guest names and phone numbers are used to generate unique, single-use QR codes that prevent gate crashing and duplicate entries</li>
              <li>Meal preferences are aggregated into exact counts sent to the caterer — no names, just numbers per dish</li>
              <li>Check-in data gives the planner a live headcount and flags any guests who haven't arrived by the time reserved seats are due to be released</li>
              <li>Vendor contact details power the private vendor portal — each vendor gets a unique link to their own section of the event</li>
              <li>WhatsApp credentials are used to send guests their personalised RSVP link and QR code on your behalf</li>
            </ul>
          </div>

          <div className="pp-divider" />

          <div className="pp-section">
            <div className="pp-section-title">What Vendors Can See</div>
            <p className="pp-body">
              Vendors on EventFlow — caterers, security, photographers, DJs, and others — access a private portal linked to their specific event. <strong>Vendors never see guest names, phone numbers, or any personal details.</strong> They see headcounts, meal tallies (caterers only), and check-in progress numbers. This isn't a setting that can be toggled — it's built into how the platform works.
            </p>
          </div>

          <div className="pp-divider" />

          <div className="pp-section">
            <div className="pp-section-title">Data Storage & Security</div>
            <ul className="pp-list">
              <li>All data lives in a PostgreSQL database hosted on Neon — a serverless Postgres provider with encryption at rest and in transit</li>
              <li>Invitation cards are stored in the planner's own Google Drive. EventFlow holds only the shareable URL returned after upload</li>
              <li>WhatsApp access tokens are encrypted with AES-256-GCM before being written to the database. No part of the raw token is ever returned through any API</li>
              <li>All platform routes require authentication via a session token. Unauthenticated requests are rejected before any data is touched</li>
              <li>We do not sell, rent, or share your data or your guests' data with third parties for advertising or marketing purposes</li>
            </ul>
          </div>

          <div className="pp-divider" />

          <div className="pp-section">
            <div className="pp-section-title">WhatsApp & Meta</div>
            <p className="pp-body">
              If you connect your WhatsApp Business account through our settings page, EventFlow uses the Meta Cloud API to send messages to your guests — personalised RSVP links and QR codes — on your behalf. We do not store message content, only the delivery status and timestamp per guest. You can disconnect your WhatsApp Business credentials at any time from the Settings page, and your encrypted token is deleted immediately.
            </p>
          </div>

          <div className="pp-divider" />

          <div className="pp-section">
            <div className="pp-section-title">Guest Data Deletion</div>
            <p className="pp-body">
              Guests who have submitted an RSVP can request removal of their personal data by contacting the planner directly or by visiting our{" "}
              <Link href="/data-deletion" style={{ color: "#b48c3c", textDecoration: "none" }}>data deletion page</Link>.
              {" "}Verified deletion requests are processed within 14 days. Check-in records tied to completed events may be retained briefly for audit purposes before being purged.
            </p>
          </div>

          <div className="pp-divider" />

          <div className="pp-section">
            <div className="pp-section-title">Cookies</div>
            <p className="pp-body">
              EventFlow uses a single session cookie — <strong>ef-session</strong> — to keep planners logged in. It contains your user ID, email, and display name in base64-encoded form and expires after 7 days. We do not use advertising cookies, analytics trackers, or third-party tracking scripts of any kind.
            </p>
          </div>

          <div className="pp-divider" />

          <div className="pp-section">
            <div className="pp-section-title">Changes to This Policy</div>
            <p className="pp-body">
              If we make meaningful changes to this policy, we'll update the date at the top and notify planners by email where appropriate. Carrying on using EventFlow after an update means you're okay with the revised terms.
            </p>
          </div>

          <div className="pp-divider" />

          <div className="pp-callout">
            <div className="pp-section-title" style={{ marginBottom: "0.625rem" }}>Questions?</div>
            <p className="pp-body">
              Reach us at <a href="mailto:privacy@eventflowng.com">privacy@eventflowng.com</a>. We aim to respond within 2 business days.
            </p>
          </div>

          <Link href="/login" className="pp-back">← Back to login</Link>
        </div>
      </div>
    </>
  )
}
