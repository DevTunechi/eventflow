// ─────────────────────────────────────────────
// src/context/AuthContext.tsx
// ─────────────────────────────────────────────

"use client"

import {
  createContext, useContext, useEffect,
  useState, ReactNode,
} from "react"
import {
  User, onAuthStateChanged,
  signInWithPopup, signOut as firebaseSignOut,
} from "firebase/auth"
import { auth, googleProvider } from "@/lib/firebase"
import { useRouter } from "next/navigation"

interface AuthContextType {
  user:              User | null
  loading:           boolean
  sessionToken:      string | null   // base64 session for API calls
  signInWithGoogle:  () => Promise<void>
  signOut:           () => Promise<void>
}

// ── Helper: build + store session ─────────────
const buildSession = (firebaseUser: User): string => {
  const payload = {
    uid:   firebaseUser.uid,
    email: firebaseUser.email ?? "",
    name:  firebaseUser.displayName ?? "",
  }
  const encoded = btoa(JSON.stringify(payload))
  // Cookie — server-side API routes read this
  document.cookie = `ef-session=${encoded}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
  // localStorage — so we can restore token on page reload
  localStorage.setItem("ef-session", encoded)
  return encoded
}

const clearSession = () => {
  document.cookie = "ef-session=; path=/; max-age=0"
  localStorage.removeItem("ef-session")
}

// ── Context ────────────────────────────────────
const AuthContext = createContext<AuthContextType>({
  user: null, loading: true, sessionToken: null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,         setUser]         = useState<User | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // On mount, restore token from localStorage so API calls
    // work immediately without waiting for Firebase to resolve
    const stored = localStorage.getItem("ef-session")
    if (stored) setSessionToken(stored)

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        // Refresh the session token whenever Firebase confirms auth
        const token = buildSession(firebaseUser)
        setSessionToken(token)
      } else {
        // User signed out — clear everything
        clearSession()
        setSessionToken(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    try {
      const result       = await signInWithPopup(auth, googleProvider)
      const firebaseUser = result.user

      // Sync user into Neon DB
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

      const token = buildSession(firebaseUser)
      setSessionToken(token)
      router.push("/dashboard")
    } catch (error) {
      console.error("Google sign-in error:", error)
    }
  }

  const signOut = async () => {
    clearSession()
    setSessionToken(null)
    await firebaseSignOut(auth)
    router.push("/login")
  }

  return (
    <AuthContext.Provider value={{ user, loading, sessionToken, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
