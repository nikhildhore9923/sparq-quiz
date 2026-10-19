import { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../AuthContext'
import { 
  ArrowRight, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  AlertCircle, 
  Zap, 
  Sparkles, 
  Flame, 
  Users, 
  Radio
} from 'lucide-react'

function Login() {
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useContext(AuthContext)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    setError('')

    if (isRegister && password.length < 6) {
      return setError('Password must be at least 6 characters.')
    }

    setLoading(true)

    try {
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login'
      
      const res = await fetch(`${serverUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      })
      
      const data = await res.json()
      
      if (data.success) {
        login(data.token, data.username)
        navigate('/host')
      } else {
        // If demo host doesn't exist yet on registration endpoint, attempt registration then login
        setError(data.error || 'Authentication failed. Please check your credentials.')
      }
    } catch (err) {
      setError('Could not connect to authentication server. Please check your network.')
    } finally {
      setLoading(false)
    }
  }

  // Demonstration Access Handlers (SmartAttend feature)
  const handleHostDemo = async () => {
    setError('')
    setLoading(true)
    const demoUser = 'HostMaster'
    const demoPass = 'Password123!'
    setUsername(demoUser)
    setPassword(demoPass)

    try {
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'
      // Try login first
      let res = await fetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: demoUser, password: demoPass })
      })
      let data = await res.json()

      // If user doesn't exist yet, auto-register then login
      if (!data.success) {
        res = await fetch(`${serverUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: demoUser, password: demoPass })
        })
        data = await res.json()
      }

      if (data.success) {
        login(data.token, data.username)
        navigate('/host')
      } else {
        setError(data.error || 'Demo access initialization failed.')
      }
    } catch (err) {
      setError('Could not connect to demo server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="full-bleed slide-in">
      <div style={{ maxWidth: 1060, margin: '16px auto 8px' }}>
        <button 
          className="btn btn-ghost btn-sm" 
          onClick={() => navigate('/')} 
          style={{ padding: '6px 12px' }}
        >
          ← Back to Arena Home
        </button>
      </div>

      <div className="auth-split-wrapper">
        {/* Left Side: Rich Showcase & Live Simulation (SmartAttend-grade) */}
        <div className="auth-showcase-side">
          <div className="auth-showcase-content">
            <div className="hero-pill" style={{ marginBottom: 16 }}>
              <Zap size={14} fill="currentColor" />
              <span>HOST COMMAND PORTAL • ZERO LATENCY</span>
            </div>

            <h1 className="auth-showcase-title">
              Turn Any Crowd into an <span className="gradient-text">Electrifying Showdown.</span>
            </h1>

            <p className="auth-showcase-desc">
              Sparq powers live interactive game shows with sub-50ms WebSocket latency, 
              AI-crafted trivia sets, dynamic streak multipliers, and instant stadium podium fanfare.
            </p>

            <div className="auth-feature-list">
              <div className="auth-feature-row">
                <div className="auth-feature-icon">
                  <Radio size={20} />
                </div>
                <div className="auth-feature-text">
                  <h4>Sub-50ms WebSocket Synchronization</h4>
                  <p>Real-time timer sync, instant buzzer lock-in, and audience tally updates with zero jitter.</p>
                </div>
              </div>

              <div className="auth-feature-row">
                <div className="auth-feature-icon" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.12)' }}>
                  <Sparkles size={20} />
                </div>
                <div className="auth-feature-text">
                  <h4>Groq AI Trivia Engine</h4>
                  <p>Instantly generate balanced 4-option trivia on any topic with custom timers and difficulty ratings.</p>
                </div>
              </div>

              <div className="auth-feature-row">
                <div className="auth-feature-icon" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.12)' }}>
                  <ShieldCheck size={20} />
                </div>
                <div className="auth-feature-text">
                  <h4>Host Cryptographic Authorization</h4>
                  <p>Token-guarded host events, isolated room privileges, and private cloud Quiz Bank storage.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Mini Live Arena Simulation Badge at Bottom */}
          <div 
            style={{ 
              marginTop: 32, 
              padding: '14px 18px', 
              borderRadius: 'var(--radius-lg)', 
              background: 'var(--input-bg)',
              border: '1px solid var(--panel-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'relative',
              zIndex: 2
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ 
                width: 8, 
                height: 8, 
                borderRadius: '50%', 
                backgroundColor: 'var(--correct)',
                boxShadow: '0 0 10px var(--correct)' 
              }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Live Arena: Cosmic Showdown
              </span>
            </div>
            <span style={{ 
              fontSize: 12, 
              fontWeight: 700, 
              color: '#f59e0b',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4 
            }}>
              <Flame size={14} /> 4x Streak Bonus Active
            </span>
          </div>
        </div>

        {/* Right Side: Clean High-Grade Auth Card */}
        <div className="auth-card-side">
          <div style={{ maxWidth: 360, width: '100%', margin: '0 auto' }}>
            <div className="auth-header-badge">
              <ShieldCheck size={28} />
            </div>

            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, marginBottom: 6 }}>
              {isRegister ? 'Create Host Account' : 'Host Sign In'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
              {isRegister 
                ? 'Sign up to build quizzes, generate with AI, and save templates' 
                : 'Enter your host credentials to access your Quiz Bank'}
            </p>

            {/* Segmented Control Switcher */}
            <div 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                background: 'var(--input-bg)', 
                padding: 4, 
                borderRadius: 'var(--radius-md)', 
                marginBottom: 20,
                border: '1px solid var(--panel-border)'
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={() => { setIsRegister(false); setError(''); }}
                style={{ 
                  background: !isRegister ? 'var(--accent)' : 'transparent', 
                  color: !isRegister ? '#ffffff' : 'var(--text-secondary)',
                  boxShadow: !isRegister ? 'var(--shadow-sm)' : 'none',
                  padding: '7px 12px',
                  fontSize: 13
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => { setIsRegister(true); setError(''); }}
                style={{ 
                  background: isRegister ? 'var(--accent)' : 'transparent', 
                  color: isRegister ? '#ffffff' : 'var(--text-secondary)',
                  boxShadow: isRegister ? 'var(--shadow-sm)' : 'none',
                  padding: '7px 12px',
                  fontSize: 13
                }}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User size={14} /> Host Username
                </label>
                <input 
                  type="text" 
                  required 
                  autoFocus
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  className="base-input"
                  placeholder="e.g. HostMaster"
                />
              </div>
              
              <div className="field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Lock size={14} /> Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    required 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="base-input"
                    placeholder={isRegister ? 'At least 6 characters' : '••••••••'}
                    style={{ paddingRight: 42 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 4
                    }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="error-text" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary btn-block btn-lg" 
                disabled={loading || !username.trim() || !password}
                style={{ marginTop: 6 }}
              >
                {loading ? 'Authenticating…' : (isRegister ? 'Create Account & Enter' : 'Sign In to Console')} 
                <ArrowRight size={18} />
              </button>
            </form>

            {/* Demonstration Access Section (SmartAttend Feature for instant testing) */}
            <div className="demo-access-box">
              <div className="demo-access-title">Instant Demonstration Access</div>
              <div className="demo-btn-group">
                <button 
                  type="button" 
                  className="demo-btn"
                  onClick={handleHostDemo}
                  disabled={loading}
                >
                  <Zap size={15} color="var(--accent)" /> Host Demo
                </button>
                <button 
                  type="button" 
                  className="demo-btn"
                  onClick={() => navigate('/join')}
                >
                  <Users size={15} color="var(--correct)" /> Player Demo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
