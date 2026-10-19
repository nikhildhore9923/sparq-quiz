import { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../AuthContext'
import { ArrowRight, Lock, User, Eye, EyeOff, ShieldCheck, AlertCircle, Zap } from 'lucide-react'

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
        navigate('/')
      } else {
        setError(data.error || 'Authentication failed. Please check your credentials.')
      }
    } catch (err) {
      setError('Could not connect to authentication server. Please check your network.')
    } finally {
      setLoading(false)
    }
  }

  // Quick Demo Autofill Helper
  const fillDemoCredentials = () => {
    setUsername('HostMaster')
    setPassword('Password123!')
    setError('')
  }

  return (
    <div className="app slide-in">
      <button 
        className="btn btn-ghost btn-sm" 
        onClick={() => navigate('/')} 
        style={{ marginBottom: 20, padding: '6px 12px' }}
      >
        ← Back to Home
      </button>

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div 
          style={{ 
            width: 44, 
            height: 44, 
            borderRadius: '12px', 
            background: 'var(--accent-light)', 
            color: 'var(--accent)', 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: 12
          }}
        >
          <ShieldCheck size={24} />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
          Host Portal
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          {isRegister 
            ? 'Create a secure host account to save your private Quiz Bank' 
            : 'Sign in to access your private templates and saved quiz banks'}
        </p>
      </div>

      <div className="panel" style={{ maxWidth: 400, margin: '0 auto' }}>
        {/* Segmented Control Switcher */}
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            background: 'var(--input-bg)', 
            padding: 3, 
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
              <User size={14} /> Username
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
                  right: 10,
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
            {isRegister && (
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5 }}>
                Must be at least 6 characters
              </p>
            )}
          </div>

          {error && (
            <div className="error-text" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary btn-block btn-lg" 
            disabled={loading || !username.trim() || !password}
            style={{ marginTop: 6 }}
          >
            {loading ? 'Authenticating…' : (isRegister ? 'Create Account' : 'Sign In')} 
            <ArrowRight size={17} />
          </button>
        </form>

        {/* Quick Demo Autofill Pill */}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button
            type="button"
            onClick={fillDemoCredentials}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Zap size={12} color="var(--accent)" /> Autofill demo credentials
          </button>
        </div>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--panel-border)', textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
          {isRegister ? (
            <p>
              Already have an account?{' '}
              <span 
                style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => { setIsRegister(false); setError(''); }}
              >
                Sign in
              </span>
            </p>
          ) : (
            <p>
              Don't have an account?{' '}
              <span 
                style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => { setIsRegister(true); setError(''); }}
              >
                Register here
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
