// ─────────────────────────────────────────────
// src/lib/auth-server.ts
//
// Server-side auth helper for API routes.
//
// Strategy (in order of precedence):
//   1. Read ef-session cookie (set after login)
//   2. Read Authorization: Bearer header (for
//      future API clients / mobile)
//
// The ef-session cookie is a base64-encoded
// JSON object set by AuthContext after a
// successful Google sign-in.
// ─────────────────────────────────────────────

import { cookies, headers } from "next/headers"

interface Session {
  email: string
  uid:   string
  name:  string
}

export async function auth(): Promise<Session | null> {
  try {
    // ── 1. Try the session cookie first ───────
    const cookieStore   = await cookies()
    const sessionCookie = cookieStore.get("ef-session")

    if (sessionCookie?.value) {
      try {
        const session = JSON.parse(
          Buffer.from(sessionCookie.value, "base64").toString("utf-8")
        ) as Session

        // Validate it has the required fields
        if (session?.email && session?.uid) return session
      } catch {
        // Cookie was malformed — fall through to header check
      }
    }

    // ── 2. Try Authorization header ───────────
    // Useful when the cookie hasn't been set yet
    // (e.g. first load after deploy, or API clients)
    const headerStore = await headers()
    const authHeader  = headerStore.get("authorization")

    if (authHeader?.startsWith("Bearer ")) {
      try {
        // The bearer token is our same base64 session payload
        // (set by the client on authenticated requests)
        const token   = authHeader.slice(7)
        const session = JSON.parse(
          Buffer.from(token, "base64").toString("utf-8")
        ) as Session

        if (session?.email && session?.uid) return session
      } catch {
        // Invalid bearer token
      }
    }

    return null

  } catch {
    return null
  }
}