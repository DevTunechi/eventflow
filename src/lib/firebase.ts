// ─────────────────────────────────────────────
// src/lib/firebase.ts
// Initialises Firebase app and exports the
// auth instance + Google provider for use
// throughout the app.
// ─────────────────────────────────────────────

import { initializeApp, getApps } from "firebase/app"
import { getAuth, GoogleAuthProvider } from "firebase/auth"

// Pull all config values from .env
// All must be prefixed NEXT_PUBLIC_ to be
// accessible in the browser (Next.js rule)
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Prevent duplicate app initialisation in
// Next.js dev mode (hot reload runs this twice)
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0]

// The main auth instance used for sign in/out
export const auth = getAuth(app)

// Google provider — configured to always show
// the account picker (even if already signed in)
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: "select_account" })