import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import { useContext, useState, useEffect } from 'react'
import { AuthContext } from './AuthContext'
import Home from './pages/Home'
import HostCreate from './pages/HostCreate'
import HostRoom from './pages/HostRoom'
import PlayerJoin from './pages/PlayerJoin'
import PlayerRoom from './pages/PlayerRoom'
import Login from './pages/Login'
import { Zap, LogOut, LogIn, Sun, Moon, Volume2, VolumeX, ShieldCheck } from 'lucide-react'
import { isSoundMuted, toggleSound } from './utils/sounds'

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

  // Sound preference state
  const [muted, setMuted] = useState(isSoundMuted())

  useEffect(() => {
    const handleSoundChange = (e) => {
      setMuted(e.detail.muted)
    }
    window.addEventListener('sparq:sound-change', handleSoundChange)
    return () => window.removeEventListener('sparq:sound-change', handleSoundChange)
  }, [])

  const handleToggleSound = () => {
    const next = toggleSound()
    setMuted(next)
  }

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
            <div className="logo-icon-wrap">
              <Zap size={20} fill="currentColor" />
            </div>
            <span className="logo-text">Sparq<span>.</span></span>
          </div>
        </Link>
        
        <div className="header-controls">
          <button
            className="icon-btn-round"
            onClick={handleToggleSound}
            title={muted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
            aria-label="Toggle Sound"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <button
            className="icon-btn-round"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {username ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: 13, 
                  color: 'var(--text-secondary)', 
                  fontWeight: 600,
                  background: 'var(--input-bg)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--panel-border)'
                }}
              >
                <ShieldCheck size={14} color="var(--accent)" />
                <span style={{ color: 'var(--accent)' }}>{username}</span>
              </div>
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={handleLogout} 
                title="Sign out of host account"
              >
                <LogOut size={14} /> Logout
              </button>
            </div>
          ) : (
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <button className="btn btn-ghost btn-sm">
                <LogIn size={14} /> Host Portal
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

      <footer style={{ 
        textAlign: 'center', 
        padding: '24px 20px', 
        fontSize: '13px', 
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--header-border)',
        marginTop: 'auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            backgroundColor: 'var(--correct)',
            display: 'inline-block',
            boxShadow: '0 0 8px var(--correct)' 
          }}></span>
          <span>Sparq Real-Time Quiz Engine Active</span>
        </div>
        <p>Ultra-low latency multiplayer trivia • Powered by WebSockets</p>
      </footer>
    </div>
  )
}

export default App
