// src/app/(dashboard)/layout.tsx
"use client"

import { useState, useEffect, createContext, useContext } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import Cookies from "js-cookie"

interface ThemeContextType {
  theme: "dark" | "light"
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
})

export const useTheme = () => useContext(ThemeContext)

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/events",
    label: "Events",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    href: "/checkin",
    label: "Check-in",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    href: "/pricing",
    label: "Pricing",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("ef-session") ?? "" : ""
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth()
  const pathname = usePathname()
  const router   = useRouter()

  const [collapsed,    setCollapsed]    = useState(false)
  const [drawerOpen,   setDrawerOpen]   = useState(false)
  const [theme,        setTheme]        = useState<"dark" | "light">("dark")
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  useEffect(() => {
    const savedCollapsed = localStorage.getItem("ef-sidebar-collapsed")
    const savedTheme     = localStorage.getItem("ef-theme") as "dark" | "light"
    if (savedCollapsed) setCollapsed(savedCollapsed === "true")
    if (savedTheme)     setTheme(savedTheme)
  }, [])

  useEffect(() => {
    if (!user) router.push("/login")
  }, [user, router])

  // Sync plan cookie from DB on every dashboard load
  // Ensures paid subscribers aren't bounced to pricing on refresh
  useEffect(() => {
    if (!user) return
    const existingCookie = Cookies.get("ef-plan")
    fetch("/api/payments/billing", { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        const plan = d.plan ?? "free"
        if (plan === "starter" || plan === "pro") {
          Cookies.set("ef-plan", plan, { expires: 365, path: "/" })
        } else if (!existingCookie) {
          Cookies.set("ef-plan", "free-acknowledged", { expires: 365, path: "/" })
        }
      })
      .catch(() => {})
  }, [user])

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem("ef-sidebar-collapsed", String(next))
  }

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    localStorage.setItem("ef-theme", next)
  }

  useEffect(() => { setDrawerOpen(false) }, [pathname])

  const currentNav = NAV_ITEMS.find(n =>
    n.href === pathname || (n.href !== "/dashboard" && pathname.startsWith(n.href))
  )
  const pageTitle = currentNav?.label ?? "Dashboard"

  if (!user) return null

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Cormorant+Garamond:ital,wght@0,300;0,400&family=DM+Sans:wght@300;400;500&display=swap');

          .ef-dashboard *, .ef-dashboard *::before, .ef-dashboard *::after {
            box-sizing: border-box;
          }
          html, body { height: 100%; margin: 0; padding: 0; }

          .ef-dashboard {
            --bg:           #0a0a0a;
            --bg-2:         #111111;
            --bg-3:         #1a1a1a;
            --border:       rgba(180,140,60,0.12);
            --border-hover: rgba(180,140,60,0.3);
            --gold:         #b48c3c;
            --gold-dim:     rgba(180,140,60,0.15);
            --text:         #f0ece4;
            --text-2:       rgba(240,236,228,0.55);
            --text-3:       rgba(240,236,228,0.25);
            --sidebar-w:    240px;
            --sidebar-collapsed-w: 64px;
            --topbar-h:     56px;
            font-family: 'DM Sans', sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            min-height: 100dvh;
          }

          .ef-dashboard.light {
            --bg:           #f7f5f1;
            --bg-2:         #ffffff;
            --bg-3:         #eeebe4;
            --border:       rgba(180,140,60,0.18);
            --border-hover: rgba(180,140,60,0.45);
            --gold:         #9a7530;
            --gold-dim:     rgba(180,140,60,0.1);
            --text:         #1a1612;
            --text-2:       rgba(26,22,18,0.55);
            --text-3:       rgba(26,22,18,0.3);
          }

          .ef-layout {
            display: flex;
            min-height: 100vh;
            min-height: 100dvh;
          }

          .ef-sidebar {
            width: var(--sidebar-w);
            flex-shrink: 0;
            background: var(--bg-2);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            position: fixed;
            top: 0; left: 0; bottom: 0;
            z-index: 50;
            transition: width 0.25s ease;
            overflow: hidden;
          }
          .ef-sidebar.collapsed { width: var(--sidebar-collapsed-w); }

          .ef-sidebar-logo {
            height: var(--topbar-h);
            display: flex; align-items: center;
            padding: 0 1rem;
            border-bottom: 1px solid var(--border);
            gap: 0.625rem; flex-shrink: 0;
            overflow: hidden; white-space: nowrap;
            text-decoration: none;
          }

          .ef-sidebar-wordmark {
            font-family: 'Bebas Neue', sans-serif;
            font-size: 1.05rem; letter-spacing: 0.12em;
            color: var(--text); transition: opacity 0.2s ease;
          }
          .ef-sidebar-wordmark span { color: var(--gold); }
          .ef-sidebar.collapsed .ef-sidebar-wordmark { opacity: 0; pointer-events: none; }

          .ef-nav {
            flex: 1; padding: 1rem 0;
            display: flex; flex-direction: column; gap: 2px;
            overflow-y: auto; overflow-x: hidden;
          }

          .ef-nav-item {
            display: flex; align-items: center; gap: 0.75rem;
            padding: 0.625rem 1rem; margin: 0 0.5rem;
            border-radius: 6px; color: var(--text-2);
            text-decoration: none; font-size: 0.825rem;
            font-weight: 400; letter-spacing: 0.01em;
            transition: all 0.2s ease; white-space: nowrap;
            overflow: hidden; position: relative;
          }
          .ef-nav-item:hover { color: var(--text); background: var(--gold-dim); }
          .ef-nav-item.active { color: var(--gold); background: var(--gold-dim); }
          .ef-nav-item.active::before {
            content: ''; position: absolute;
            left: 0; top: 20%; bottom: 20%;
            width: 2px; background: var(--gold);
            border-radius: 0 2px 2px 0;
          }

          .ef-nav-icon { width: 18px; height: 18px; flex-shrink: 0; }
          .ef-sidebar.collapsed .ef-nav-label { opacity: 0; pointer-events: none; }

          .ef-sidebar-footer {
            padding: 0.75rem 0.5rem;
            border-top: 1px solid var(--border); flex-shrink: 0;
          }

          .ef-collapse-btn {
            width: 100%; display: flex; align-items: center; gap: 0.75rem;
            padding: 0.5rem 0.5rem; background: transparent; border: none;
            border-radius: 6px; color: var(--text-3); cursor: pointer;
            transition: all 0.2s ease; white-space: nowrap; overflow: hidden;
          }
          .ef-collapse-btn:hover { color: var(--text-2); background: var(--gold-dim); }
          .ef-collapse-icon { width: 18px; height: 18px; flex-shrink: 0; transition: transform 0.25s ease; }
          .ef-sidebar.collapsed .ef-collapse-icon { transform: rotate(180deg); }

          .ef-drawer-overlay {
            display: none; position: fixed; inset: 0;
            background: rgba(0,0,0,0.6); z-index: 40;
            backdrop-filter: blur(2px);
          }

          .ef-main {
            margin-left: var(--sidebar-w);
            flex: 1;
            min-width: 0;
            display: flex; flex-direction: column;
            min-height: 100vh;
            transition: margin-left 0.25s ease;
          }
          .ef-main.collapsed { margin-left: var(--sidebar-collapsed-w); }

          .ef-topbar {
            height: var(--topbar-h);
            background: var(--bg-2);
            border-bottom: 1px solid var(--border);
            display: flex; align-items: center;
            justify-content: space-between;
            padding: 0 1.5rem;
            position: sticky; top: 0; z-index: 30; flex-shrink: 0;
          }
          .ef-topbar-left { display: flex; align-items: center; gap: 1rem; }
          .ef-hamburger {
            display: none; background: transparent; border: none;
            color: var(--text-2); cursor: pointer;
            padding: 0.25rem; border-radius: 4px;
          }
          .ef-hamburger:hover { color: var(--text); }
          .ef-page-title {
            font-family: 'Cormorant Garamond', serif;
            font-size: 1.25rem; font-weight: 300;
            color: var(--text); letter-spacing: 0.01em;
          }
          .ef-topbar-right { display: flex; align-items: center; gap: 0.75rem; }

          .ef-theme-btn {
            width: 34px; height: 34px; border-radius: 50%;
            background: var(--bg-3); border: 1px solid var(--border);
            color: var(--text-2); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: all 0.2s ease;
          }
          .ef-theme-btn:hover { border-color: var(--border-hover); color: var(--gold); }
          .ef-theme-btn svg { width: 15px; height: 15px; }

          .ef-avatar-btn { position: relative; background: transparent; border: none; cursor: pointer; padding: 0; }
          .ef-avatar { width: 34px; height: 34px; border-radius: 50%; border: 1.5px solid var(--border); object-fit: cover; display: block; transition: border-color 0.2s ease; }
          .ef-avatar-btn:hover .ef-avatar { border-color: var(--gold); }
          .ef-avatar-fallback {
            width: 34px; height: 34px; border-radius: 50%;
            border: 1.5px solid var(--border); background: var(--gold-dim);
            display: flex; align-items: center; justify-content: center;
            font-family: 'Bebas Neue', sans-serif; font-size: 0.9rem;
            color: var(--gold); letter-spacing: 0.05em;
          }

          .ef-user-menu {
            position: absolute; top: calc(100% + 0.5rem); right: 0;
            background: var(--bg-2); border: 1px solid var(--border);
            border-radius: 8px; min-width: 200px; padding: 0.5rem;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3); z-index: 100;
            animation: fadeDown 0.15s ease;
          }
          @keyframes fadeDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }

          .ef-user-info { padding: 0.625rem 0.75rem 0.75rem; border-bottom: 1px solid var(--border); margin-bottom: 0.5rem; }
          .ef-user-name { font-size: 0.8rem; font-weight: 500; color: var(--text); margin-bottom: 0.2rem; }
          .ef-user-email { font-size: 0.7rem; color: var(--text-3); }

          .ef-menu-item {
            display: flex; align-items: center; gap: 0.625rem;
            padding: 0.5rem 0.75rem; border-radius: 5px;
            font-size: 0.8rem; color: var(--text-2); cursor: pointer;
            transition: all 0.15s ease; background: transparent;
            border: none; width: 100%; text-align: left; text-decoration: none;
          }
          .ef-menu-item:hover { background: var(--gold-dim); color: var(--text); }
          .ef-menu-item.danger:hover { background: rgba(220,60,60,0.1); color: #e05555; }
          .ef-menu-item svg { width: 14px; height: 14px; flex-shrink: 0; }
          .ef-menu-divider { height: 1px; background: var(--border); margin: 0.375rem 0; }

          .ef-content {
            flex: 1;
            min-width: 0;
            overflow-x: hidden;
            width: 100%;
            padding: 2rem;
            overflow-y: auto;
          }

          @media(max-width:1024px){ .ef-content { padding: 1.5rem; } }

          @media(max-width:768px) {
            .ef-sidebar {
              transform: translateX(-100%);
              transition: transform 0.25s ease, width 0.25s ease;
              width: var(--sidebar-w) !important;
              box-shadow: 4px 0 24px rgba(0,0,0,0.4);
            }
            .ef-sidebar.drawer-open { transform: translateX(0); }
            .ef-drawer-overlay.active { display: block; }
            .ef-main, .ef-main.collapsed { margin-left: 0; }
            .ef-hamburger { display: flex; }
            .ef-content { padding: 1rem; }
          }
        `}</style>

        <div className={`ef-dashboard ${theme}`}>
          <div className="ef-layout">

            <aside className={`ef-sidebar ${collapsed ? "collapsed" : ""} ${drawerOpen ? "drawer-open" : ""}`}>
              <Link href="/dashboard" className="ef-sidebar-logo">
                <Image src="/eflogo.png" alt="EventFlow" width={26} height={26} style={{ width:26, height:26, objectFit:"contain", flexShrink:0 }} />
                <span className="ef-sidebar-wordmark">Event<span>Flow</span></span>
              </Link>

              <nav className="ef-nav">
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href))
                  return (
                    <Link key={item.label} href={item.href} className={`ef-nav-item ${isActive ? "active" : ""}`} title={collapsed ? item.label : undefined}>
                      <span className="ef-nav-icon">{item.icon}</span>
                      <span className="ef-nav-label">{item.label}</span>
                    </Link>
                  )
                })}
              </nav>

              <div className="ef-sidebar-footer">
                <button className="ef-collapse-btn" onClick={toggleCollapse}>
                  <svg className="ef-collapse-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                  <span style={{ fontSize:"0.75rem", opacity:collapsed?0:1, transition:"opacity 0.2s" }}>Collapse</span>
                </button>
              </div>
            </aside>

            <div className={`ef-drawer-overlay ${drawerOpen ? "active" : ""}`} onClick={() => setDrawerOpen(false)} />

            <div className={`ef-main ${collapsed ? "collapsed" : ""}`}>
              <header className="ef-topbar">
                <div className="ef-topbar-left">
                  <button className="ef-hamburger" onClick={() => setDrawerOpen(prev => !prev)} aria-label="Open menu">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M3 12h18M3 6h18M3 18h18" />
                    </svg>
                  </button>
                  <h1 className="ef-page-title">{pageTitle}</h1>
                </div>

                <div className="ef-topbar-right">
                  <button className="ef-theme-btn" onClick={toggleTheme} aria-label="Toggle theme">
                    {theme === "dark" ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                    )}
                  </button>

                  <div style={{ position:"relative" }}>
                    <button className="ef-avatar-btn" onClick={() => setUserMenuOpen(prev => !prev)} aria-label="User menu">
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName ?? "User"} className="ef-avatar" />
                      ) : (
                        <div className="ef-avatar-fallback">{user?.displayName?.[0]?.toUpperCase() ?? "P"}</div>
                      )}
                    </button>

                    {userMenuOpen && (
                      <>
                        <div style={{ position:"fixed", inset:0, zIndex:99 }} onClick={() => setUserMenuOpen(false)} />
                        <div className="ef-user-menu">
                          <div className="ef-user-info">
                            <div className="ef-user-name">{user?.displayName ?? "Planner"}</div>
                            <div className="ef-user-email">{user?.email}</div>
                          </div>
                          <Link href="/settings" className="ef-menu-item" onClick={() => setUserMenuOpen(false)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="3" />
                              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                            Settings
                          </Link>
                          <div className="ef-menu-divider" />
                          <button className="ef-menu-item danger" onClick={() => { setUserMenuOpen(false); signOut() }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                            </svg>
                            Sign out
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </header>

              <main className="ef-content">
                {children}
              </main>
            </div>
          </div>
        </div>
      </>
    </ThemeContext.Provider>
  )
}
