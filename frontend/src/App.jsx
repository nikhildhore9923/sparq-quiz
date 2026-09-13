import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Moon, Sun, Zap } from 'lucide-react'
import Home from './pages/Home'
import HostCreate from './pages/HostCreate'
import HostRoom from './pages/HostRoom'
import PlayerJoin from './pages/PlayerJoin'
import PlayerRoom from './pages/PlayerRoom'

function Layout({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('sparq_theme') || 'dark')
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('sparq_theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark')

  return (
    <div className="layout-wrapper">
      <div className="global-header">
        <div className="logo-container">
          <Zap className="logo-icon" size={24} />
          <span className="logo-text">Sparq</span>
        </div>
        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
      <main className="content-area slide-in">
        {children}
      </main>
    </div>
  )
}

function App() {
  const location = useLocation();

  return (
    <Layout key={location.pathname}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/host/create" element={<HostCreate />} />
        <Route path="/host/:roomCode" element={<HostRoom />} />
        <Route path="/join" element={<PlayerJoin />} />
        <Route path="/play/:roomCode" element={<PlayerRoom />} />
      </Routes>
    </Layout>
  )
}

export default App
