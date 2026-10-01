import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthContext';
import { ArrowRight, Lock, User } from 'lucide-react';

function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      
      const res = await fetch(`${serverUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      
      if (data.success) {
        login(data.token, data.username);
        navigate('/');
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app slide-in">
      <button 
        className="btn btn-ghost" 
        onClick={() => navigate('/')} 
        style={{ marginBottom: 16, padding: '8px 0', color: 'var(--text-secondary)' }}
      >
        ← Back to Home
      </button>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, marginBottom: 8, color: 'var(--accent)' }}>
          Sparq Security
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          {isRegister ? 'Create a secure host account' : 'Sign in to access your private Quiz Bank'}
        </p>
      </div>

      <div className="panel" style={{ maxWidth: 400, margin: '0 auto' }}>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={16} /> Username
            </label>
            <input 
              type="text" 
              required 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              className="base-input"
              placeholder="e.g. HostMaster"
            />
          </div>
          
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={16} /> Password
            </label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="base-input"
              placeholder="••••••••"
            />
          </div>

          {error && <div className="error-text" style={{ marginBottom: 20 }}>{error}</div>}

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? 'Authenticating...' : (isRegister ? 'Create Account' : 'Sign In')} <ArrowRight size={20} />
          </button>
        </form>

        <p className="center-text" style={{ marginTop: 24, fontSize: 14 }}>
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <span 
            style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
            onClick={() => setIsRegister(!isRegister)}
          >
            {isRegister ? 'Sign In' : 'Register Here'}
          </span>
        </p>
      </div>
    </div>
  );
}

export default Login;
