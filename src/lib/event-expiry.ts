// ─────────────────────────────────────────────
// FILE: src/lib/event-expiry.ts
//
// Shared expiry helpers used by vendor and
// usher portal API routes.
//
// Rules:
//   - Links are ACTIVE from creation through
//     event day and 24 hours after eventDate.
//   - After that window they return 410 Gone.
//   - Vendors get a feedback window during the
//     24hr post-event period.
//   - Ushers just see an "event ended" screen.
// ─────────────────────────────────────────────

// How many hours after the event date links stay active
export const PORTAL_EXPIRY_HOURS = 24

// ── isPortalExpired ───────────────────────────
// Returns true if now is more than PORTAL_EXPIRY_HOURS
// after the event date.
//
// eventDate: the Event.eventDate DateTime from the DB
export function isPortalExpired(eventDate: Date): boolean {
  const expiresAt = new Date(eventDate)
  expiresAt.setHours(expiresAt.getHours() + PORTAL_EXPIRY_HOURS)
  return new Date() > expiresAt
}

// ── isInFeedbackWindow ────────────────────────
// Returns true if we're currently in the post-event
// feedback window — i.e. after the event but before expiry.
// This is when vendors can submit their feedback.
//
// eventDate: the Event.eventDate DateTime from the DB
export function isInFeedbackWindow(eventDate: Date): boolean {
  const now = new Date()
  const eventEnd = new Date(eventDate)
  // Treat event as ending at eventDate (start of day)
  // Feedback window = eventDate to eventDate + 24hrs
  return now >= eventEnd && !isPortalExpired(eventDate)
}

// ── getExpiryInfo ─────────────────────────────
// Returns a summary object for the portal response.
// The frontend uses this to decide which screen to show.
export function getExpiryInfo(eventDate: Date): {
  isExpired:        boolean
  isInFeedbackWindow: boolean
  expiresAt:        string  // ISO string — shown to vendor
} {
  const expiresAt = new Date(eventDate)
  expiresAt.setHours(expiresAt.getHours() + PORTAL_EXPIRY_HOURS)

  return {
    isExpired:          isPortalExpired(eventDate),
    isInFeedbackWindow: isInFeedbackWindow(eventDate),
    expiresAt:          expiresAt.toISOString(),
  }
}