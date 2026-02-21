// ─────────────────────────────────────────────
// src/lib/prisma.ts
// Exports a single shared PrismaClient instance.
// Without this, Next.js hot reload would create
// hundreds of connections in development and
// exhaust the database connection pool.
// ─────────────────────────────────────────────

import { PrismaClient } from "@prisma/client"

// Extend the Node.js global object to hold
// our Prisma instance across hot reloads
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??    // reuse existing instance if it exists
  new PrismaClient({
    log: ["query"],            // logs all DB queries in the terminal (dev only)
  })

// In development, save the instance to global
// so it survives Next.js hot module reloads.
// In production this block is skipped — each
// serverless function gets its own instance.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}