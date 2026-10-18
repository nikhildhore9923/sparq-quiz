import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import { useContext, useState, useEffect } from 'react'
import { AuthContext } from './AuthContext'
import Home from './pages/Home'
import HostCreate from './pages/HostCreate'
import HostRoom from './pages/HostRoom'
import PlayerJoin from './pages/PlayerJoin'
import PlayerRoom from './pages/PlayerRoom'
import Login from './pages/Login'
import { Zap, LogOut, LogIn, Sun, Moon } from 'lucide-react'

function App() {
  const { username, logout } = useContext(AuthContext)
  const navigate = useNavigate()

  // Theme state: read saved preference, fallback to system preference, default to dark
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('sparq_theme')
    if (saved === 'light' || saved === 'dark') return saved
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light'
    }
    return 'dark'
  })

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.classList.remove('light-theme', 'dark-theme')
    document.documentElement.classList.add(`${theme}-theme`)
  }, [theme])

  // React to OS system theme changes if user hasn't explicitly set a preference
  useEffect(() => {
    if (!window.matchMedia) return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemChange = (e) => {
      const saved = localStorage.getItem('sparq_theme')
      if (!saved) {
        setTheme(e.matches ? 'dark' : 'light')
      }
    }
    mediaQuery.addEventListener('change', handleSystemChange)
    return () => mediaQuery.removeEventListener('change', handleSystemChange)
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    localStorage.setItem('sparq_theme', nextTheme)
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="layout-wrapper">
      <header className="global-header">
        <Link to="/" style={{ textDecoration: 'none' }}>
          <div className="logo-container">
            <Zap size={24} fill="currentColor" />
            <span className="logo-text">Sparq</span>
          </div>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {username ? (
            <>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>
                Host: <span style={{ color: 'var(--accent)' }}>{username}</span>
              </span>
              <button className="btn btn-ghost" onClick={handleLogout} style={{ padding: '6px 12px', fontSize: 13 }}>
                <LogOut size={14} /> Logout
              </button>
            </>
          ) : (
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 13 }}>
                <LogIn size={14} /> Host Login
              </button>
            </Link>
          )}
        </div>
      </header>

      <main className="content-area">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/host" element={<HostCreate />} />
          <Route path="/host/:roomCode" element={<HostRoom />} />
          <Route path="/join" element={<PlayerJoin />} />
          <Route path="/play/:roomCode" element={<PlayerRoom />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
