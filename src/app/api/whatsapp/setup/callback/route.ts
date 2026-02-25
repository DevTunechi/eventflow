// ─────────────────────────────────────────────
// src/app/api/whatsapp/setup/callback/route.ts
//
// Handles Meta OAuth redirect after planner
// completes the Embedded Signup flow.
//
// Flow:
//   1. Meta redirects to this URL with ?code=
//   2. We exchange code for a user access token
//   3. We get the WABA and phone number details
//   4. We save everything encrypted to the User
//   5. We close the popup with a success page
//
// Required env vars:
//   NEXT_PUBLIC_META_APP_ID
//   META_APP_SECRET        (server-side only, never expose)
//   NEXT_PUBLIC_APP_URL
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-server"
import { encrypt } from "@/lib/whatsapp"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get("code")
  const error = searchParams.get("error")

  // Meta denied access or user cancelled
  if (error || !code) {
    return new NextResponse(closePopupHtml("error", "Connection cancelled."), {
      headers: { "Content-Type": "text/html" },
    })
  }

  try {
    const session = await auth()
    if (!session?.email) {
      return new NextResponse(closePopupHtml("error", "Session expired. Please log in again."), {
        headers: { "Content-Type": "text/html" },
      })
    }

    const appId     = process.env.NEXT_PUBLIC_META_APP_ID ?? ""
    const appSecret = process.env.META_APP_SECRET ?? ""
    const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? ""

    if (!appId || !appSecret) {
      return new NextResponse(closePopupHtml("error", "App not configured. Contact support."), {
        headers: { "Content-Type": "text/html" },
      })
    }

    // ── Step 1: Exchange code for access token ─

    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token` +
      `?client_id=${appId}` +
      `&client_secret=${appSecret}` +
      `&redirect_uri=${encodeURIComponent(`${appUrl}/api/whatsapp/setup/callback`)}` +
      `&code=${code}`
    )

    if (!tokenRes.ok) {
      const err = await tokenRes.json()
      console.error("Token exchange failed:", err)
      return new NextResponse(closePopupHtml("error", "Failed to connect. Please try again."), {
        headers: { "Content-Type": "text/html" },
      })
    }

    const tokenData = await tokenRes.json()
    const userAccessToken = tokenData.access_token

    // ── Step 2: Get WABA and phone number ──────

    // Fetch WhatsApp Business Accounts linked to this user
    const wabaRes = await fetch(
      `https://graph.facebook.com/v19.0/me/businesses?fields=whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}&access_token=${userAccessToken}`
    )

    let wabaId        = ""
    let phoneNumberId = ""
    let displayPhone  = ""
    let displayName   = ""
    let businessName  = ""

    if (wabaRes.ok) {
      const wabaData = await wabaRes.json()
      // Get first WABA
      const firstBusiness = wabaData?.data?.[0]
      businessName = firstBusiness?.name ?? ""
      const firstWaba = firstBusiness?.whatsapp_business_accounts?.data?.[0]
      if (firstWaba) {
        wabaId = firstWaba.id ?? ""
        const firstPhone = firstWaba.phone_numbers?.data?.[0]
        if (firstPhone) {
          phoneNumberId = firstPhone.id ?? ""
          displayPhone  = firstPhone.display_phone_number ?? ""
          displayName   = firstPhone.verified_name ?? ""
        }
      }
    }

    // Fallback: fetch phone number ID directly
    if (!phoneNumberId) {
      const phoneRes = await fetch(
        `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${userAccessToken}`
      )
      if (phoneRes.ok) {
        const phoneData = await phoneRes.json()
        displayName = phoneData.name ?? ""
      }
    }

    // ── Step 3: Save to User record ───────────

    const planner = await prisma.user.findUnique({
      where:  { email: session.email },
      select: { id: true },
    })

    if (!planner) {
      return new NextResponse(closePopupHtml("error", "User not found."), {
        headers: { "Content-Type": "text/html" },
      })
    }

    const encryptedToken = encrypt(userAccessToken)

    await (prisma.user as any).update({
      where: { id: planner.id },
      data: {
        waAccessToken:   encryptedToken,
        waPhoneNumberId: phoneNumberId || null,
        waWabaId:        wabaId        || null,
        waDisplayName:   displayName   || null,
        waPhoneNumber:   displayPhone  || null,
        waBusinessName:  businessName  || null,
        waConnectedAt:   new Date(),
      },
    })

    // ── Step 4: Close popup with success ──────

    return new NextResponse(closePopupHtml("success", displayName || "Your business"), {
      headers: { "Content-Type": "text/html" },
    })

  } catch (err) {
    console.error("WhatsApp callback error:", err)
    return new NextResponse(closePopupHtml("error", "Something went wrong. Please try again."), {
      headers: { "Content-Type": "text/html" },
    })
  }
}

// ── HTML that closes the popup ────────────────
// The parent window polls for popup.closed and
// then re-checks /api/whatsapp/status.

function closePopupHtml(status: "success" | "error", message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>EventFlow — WhatsApp Setup</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'DM Sans', system-ui, sans-serif;
      background: #0a0a0a; color: #f0ece4;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 2rem; text-align: center;
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    .title { font-size: 1.25rem; font-weight: 400; margin-bottom: 0.5rem; }
    .sub { font-size: 0.875rem; color: rgba(240,236,228,0.5); line-height: 1.6; }
    .closing { font-size: 0.75rem; color: rgba(240,236,228,0.3); margin-top: 1.5rem; }
  </style>
</head>
<body>
  <div>
    <div class="icon">${status === "success" ? "✅" : "❌"}</div>
    <div class="title">${status === "success" ? "Connected!" : "Connection failed"}</div>
    <div class="sub">${message}${status === "success" ? "<br>You can close this window." : "<br>Please close this window and try again."}</div>
    <div class="closing">This window will close automatically…</div>
  </div>
  <script>
    // Auto-close after 2 seconds
    setTimeout(() => window.close(), 2000);
  </script>
</body>
</html>`
}