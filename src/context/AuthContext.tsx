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
import Cookies from "js-cookie"

interface AuthContextType {
  user:              User | null
  loading:           boolean
  sessionToken:      string | null
  signInWithGoogle:  () => Promise<void>
  signOut:           () => Promise<void>
}

const buildSession = (firebaseUser: User): string => {
  const payload = {
    uid:   firebaseUser.uid,
    email: firebaseUser.email ?? "",
    name:  firebaseUser.displayName ?? "",
  }
  const encoded  = btoa(JSON.stringify(payload))
  const isSecure = location.protocol === "https:"
  document.cookie = `ef-session=${encoded}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${isSecure ? "; Secure" : ""}`
  localStorage.setItem("ef-session", encoded)
  return encoded
}

const clearSession = () => {
  document.cookie = "ef-session=; path=/; max-age=0"
  localStorage.removeItem("ef-session")
  // Clear plan cookie on sign-out so gate shows again on next login
  Cookies.remove("ef-plan")
}

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
    const stored = localStorage.getItem("ef-session")
    if (stored) setSessionToken(stored)

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const token = buildSession(firebaseUser)
        setSessionToken(token)
      } else {
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

      // Sync user into DB
      await fetch("/api/auth/sync", {
        method:  "POST",
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

      // Fetch plan and set cookie so middleware knows
      // whether to redirect to /pricing or let through
      try {
        const res  = await fetch("/api/user/plan", {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        const plan = data.plan ?? "free"
        // "pro" users go straight through
        // "free" users hit the pricing gate (cookie not set / set to "free")
        if (plan === "pro") {
          Cookies.set("ef-plan", "pro", { expires: 1 })
        }
        // Free users: don't set the cookie — middleware will redirect to /pricing
      } catch {
        // If plan fetch fails, don't block login
      }

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