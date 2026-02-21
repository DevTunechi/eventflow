// ─────────────────────────────────────────────
// src/context/AuthContext.tsx
// Global auth state for the entire app.
// Wraps Firebase's onAuthStateChanged so any
// component can access the current user,
// sign in, or sign out via useAuth().
// ─────────────────────────────────────────────

"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react"
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth"
import { auth, googleProvider } from "@/lib/firebase"
import { useRouter } from "next/navigation"

// Shape of the context value every consumer gets
interface AuthContextType {
  user: User | null       // null = not signed in
  loading: boolean        // true while Firebase checks session
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

// Create context with safe defaults (used if
// a component is rendered outside the provider)
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
})

// ── Provider ──────────────────────────────────
// Wrap the entire app with this in layout.tsx
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true) // start true — waiting on Firebase
  const router                = useRouter()

  useEffect(() => {
    // Firebase calls this immediately with the
    // cached session, then again on any auth change
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)   // null if signed out
      setLoading(false)       // we now know the auth state
    })

    // Clean up the listener when the component unmounts
    return () => unsubscribe()
  }, [])

  // ── Google Sign-In ───────────────────────────
  const signInWithGoogle = async () => {
    try {
      // Opens Google account picker popup
      const result = await signInWithPopup(auth, googleProvider)
      const firebaseUser = result.user

      // Sync the Firebase user into our Neon
      // PostgreSQL database via our API route
      await fetch("/api/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid:   firebaseUser.uid,
          name:  firebaseUser.displayName,
          email: firebaseUser.email,
          image: firebaseUser.photoURL,
        }),
      })

      // Store a lightweight session cookie so server-side
      // API routes can identify the current user without
      // needing the Firebase Admin SDK
      const sessionData = {
        uid:   firebaseUser.uid,
        email: firebaseUser.email,
        name:  firebaseUser.displayName,
      }
      const encoded = btoa(JSON.stringify(sessionData))
      // 7-day expiry, SameSite=Lax for security
      document.cookie = `ef-session=${encoded}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`

      // Redirect to dashboard after successful sign-in
      router.push("/dashboard")
    } catch (error) {
      console.error("Google sign-in error:", error)
    }
  }

  // ── Sign Out ─────────────────────────────────
  const signOut = async () => {
    // Clear the session cookie on sign-out
    document.cookie = "ef-session=; path=/; max-age=0"
    await firebaseSignOut(auth) // clears Firebase session
    router.push("/login")       // send back to login page
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────
// Usage anywhere in the app:
// const { user, signInWithGoogle, signOut } = useAuth()
export const useAuth = () => useContext(AuthContext)
