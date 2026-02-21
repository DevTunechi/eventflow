// ─────────────────────────────────────────────
// src/app/layout.tsx
// Root layout — wraps every page in the app.
// AuthProvider goes here so auth state is
// available everywhere without prop drilling.
// ─────────────────────────────────────────────

import type { Metadata } from "next"
import "./globals.css"
import { AuthProvider } from "@/context/AuthContext"
import { Toaster } from "sonner"

// Tab title and meta description for the app
export const metadata: Metadata = {
  title: "EventFlow — The Command Center",
  description: "Premium event management for Nigerian planners",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {/* AuthProvider makes useAuth() available
            to every page and component below */}
        <AuthProvider>
          {children}

          {/* Sonner toast notifications — styled to
              match the EventFlow dark gold aesthetic */}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#1a1a1a",
                border: "1px solid rgba(180,140,60,0.2)",
                color: "#f0ece4",
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
