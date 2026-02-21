// src/app/page.tsx
// Root route — redirects to dashboard.
// If not authenticated, the dashboard layout
// will catch it and redirect to /login.

import { redirect } from "next/navigation"

export default function RootPage() {
  redirect("/dashboard")
}
