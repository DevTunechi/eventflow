// ─────────────────────────────────────────────
// src/lib/auth-server.ts
//
// Server-side auth helper for API routes.
// Reads the Firebase user token from the
// request cookies and returns the user's
// email so API routes can scope data correctly.
//
// NOTE: For now this uses a simplified approach
// reading from a session cookie we'll set on
// the client after sign-in. Full Firebase Admin
// SDK verification can be added later.
// ─────────────────────────────────────────────

import { cookies } from "next/headers"

interface Session {
  email: string
  uid:   string
  name:  string
}

// Called in API route handlers to get the
// current authenticated user's basic info
export async function auth(): Promise<Session | null> {
  try {
    const cookieStore = await cookies()

    // We store user info in a cookie after sign-in
    // (set in AuthContext after successful Google login)
    const sessionCookie = cookieStore.get("ef-session")

    if (!sessionCookie?.value) return null

    // Parse the JSON session we stored
    const session = JSON.parse(
      Buffer.from(sessionCookie.value, "base64").toString("utf-8")
    ) as Session

    return session
  } catch {
    return null
  }
}