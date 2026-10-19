import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  PlaySquare, 
  Users, 
  Zap, 
  Sparkles, 
  Flame, 
  BarChart3, 
  ArrowRight, 
  Timer, 
  Crown, 
  Radio, 
  CheckCircle2, 
  ShieldCheck,
  Smartphone
} from 'lucide-react'

function Home() {
  const navigate = useNavigate()
  const [quickPin, setQuickPin] = useState('')

  const handleQuickJoin = (e) => {
    e.preventDefault()
    if (!quickPin.trim()) return
    navigate(`/join?code=${quickPin.trim().toUpperCase()}`)
  }

  return (
    <div className="app wide slide-in">
      {/* 1. Hero Two-Column Layout with Live Simulator */}
      <section className="hero-two-column">
        {/* Left Column: Headline, Subtitle, Quick-Join Bar */}
        <div>
          <div className="hero-pill">
            <Zap size={14} fill="currentColor" />
            <span>REAL-TIME MULTIPLAYER TRIVIA ENGINE</span>
          </div>
          
          <h1 className="hero-title">
            Where Quick Wit Meets <span className="gradient-text">Instant Glory.</span>
          </h1>
          
          <p className="hero-subtitle">
            Host live game shows with sub-50ms WebSocket synchronization, Groq AI-generated questions, 
            dynamic streak multipliers, and instant stadium podium fanfare.
          </p>

          {/* Quick PIN Join Bar */}
          <form onSubmit={handleQuickJoin} className="quick-pin-wrapper">
            <input
              type="text"
              className="quick-pin-input"
              placeholder="ENTER 6-CHAR PIN"
              maxLength={6}
              value={quickPin}
              onChange={(e) => setQuickPin(e.target.value.toUpperCase())}
            />
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={!quickPin.trim()}
            >
              Join Game <ArrowRight size={18} />
            </button>
          </form>

          {/* Quick Action Badges */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button 
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/host')}
              style={{ gap: 6 }}
            >
              <PlaySquare size={15} color="var(--accent)" /> Host Live Quiz
            </button>
            <button 
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/join')}
              style={{ gap: 6 }}
            >
              <Smartphone size={15} color="var(--correct)" /> Join on Mobile
            </button>
            <button 
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/login')}
              style={{ gap: 6 }}
            >
              <ShieldCheck size={15} color="#3b82f6" /> Host Portal
            </button>
          </div>
        </div>

        {/* Right Column: Live Interactive Game Arena Simulator Card */}
        <div className="hero-sim-card">
          <div className="sim-header">
            <span style={{ 
              fontFamily: 'var(--font-mono)', 
              fontSize: 12, 
              fontWeight: 700, 
              color: 'var(--text-secondary)',
              background: 'var(--input-bg)',
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--panel-border)'
            }}>
              LIVE QUESTION 3 OF 5
            </span>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6, 
              color: '#f59e0b', 
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 700
            }}>
              <Timer size={15} /> 12s Remaining
            </div>
          </div>

          <div className="sim-question-text">
            Which celestial body in our solar system boasts the tallest known planetary mountain (Olympus Mons)?
          </div>

          {/* 4 Competitive Options with Live Tallies */}
          <div className="sim-options-grid">
            <div className="sim-option-pill active" style={{ background: 'var(--opt-a-bg)', borderColor: 'var(--opt-a-border)', color: 'var(--text-primary)' }}>
              <span><strong style={{ color: 'var(--opt-a)' }}>▲ A:</strong> Mars</span>
              <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--correct)' }}>68% ✓</strong>
            </div>
            <div className="sim-option-pill" style={{ background: 'var(--opt-b-bg)', borderColor: 'var(--opt-b-border)', color: 'var(--text-primary)' }}>
              <span><strong style={{ color: 'var(--opt-b)' }}>◆ B:</strong> Venus</span>
              <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.7 }}>16%</span>
            </div>
            <div className="sim-option-pill" style={{ background: 'var(--opt-c-bg)', borderColor: 'var(--opt-c-border)', color: 'var(--text-primary)' }}>
              <span><strong style={{ color: 'var(--opt-c)' }}>● C:</strong> Jupiter</span>
              <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.7 }}>9%</span>
            </div>
            <div className="sim-option-pill" style={{ background: 'var(--opt-d-bg)', borderColor: 'var(--opt-d-border)', color: 'var(--text-primary)' }}>
              <span><strong style={{ color: 'var(--opt-d)' }}>■ D:</strong> Mercury</span>
              <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.7 }}>7%</span>
            </div>
          </div>

          {/* Live Response Spotlight */}
          <div style={{ 
            background: 'var(--input-bg)', 
            padding: '10px 14px', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--panel-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              <strong>84 of 92</strong> players answered
            </span>
            <span style={{ color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Flame size={14} /> Fastest: Priya in 1.18s
            </span>
          </div>
        </div>
      </section>

      {/* 2. Metric Stat Cards Bar (SmartAttend-grade precision telemetry) */}
      <section className="metric-grid">
        <div className="metric-card">
          <div className="metric-icon-box purple">
            <Radio size={24} />
          </div>
          <div className="metric-info">
            <div className="metric-value">&lt; 50ms</div>
            <div className="metric-label">WebSocket Latency</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box blue">
            <Sparkles size={24} />
          </div>
          <div className="metric-info">
            <div className="metric-value">Groq AI</div>
            <div className="metric-label">Instant Question Engine</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box orange">
            <Flame size={24} />
          </div>
          <div className="metric-info">
            <div className="metric-value">Up to 4x</div>
            <div className="metric-label">Streak Multipliers</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box green">
            <BarChart3 size={24} />
          </div>
          <div className="metric-info">
            <div className="metric-value">100% Live</div>
            <div className="metric-label">Real-Time Tallies</div>
          </div>
        </div>
      </section>

      {/* 3. Hero Action Cards (Host Arena vs Player Console) */}
      <section className="hero-cards-grid" style={{ marginTop: 20 }}>
        <div 
          className="hero-action-card host-card" 
          onClick={() => navigate('/host')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/host')}
        >
          <div>
            <div className="card-top-icon" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              <PlaySquare size={30} />
            </div>
            <span className="card-badge" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              Host & Present
            </span>
            <h2 className="card-title">Host a Live Quiz</h2>
            <p className="card-desc">
              Generate trivia on any topic with AI or build custom rounds with rich time limits. 
              Project questions onto the big screen with instant audience tallies.
            </p>
          </div>
          <div className="card-footer-cta">
            <span>Open Quiz Studio</span>
            <ArrowRight size={18} />
          </div>
        </div>

        <div 
          className="hero-action-card join-card" 
          onClick={() => navigate('/join')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/join')}
        >
          <div>
            <div className="card-top-icon" style={{ background: 'var(--correct-bg)', color: 'var(--correct)' }}>
              <Users size={30} />
            </div>
            <span className="card-badge" style={{ background: 'var(--correct-bg)', color: 'var(--correct)' }}>
              Contestant
            </span>
            <h2 className="card-title">Join as Player</h2>
            <p className="card-desc">
              Jump in from any smartphone, tablet, or browser. 
              Answer fast with 4-color buzzers to stack speed bonuses and climb the podium.
            </p>
          </div>
          <div className="card-footer-cta" style={{ color: 'var(--correct)' }}>
            <span>Enter Player Lobby</span>
            <ArrowRight size={18} />
          </div>
        </div>
      </section>

      {/* 4. 3-Step Tournament Workflow */}
      <section className="features-section">
        <div className="features-header">
          <h3>How Sparq Delivers Unmatched Competition</h3>
          <p className="center-text">Three frictionless steps from idea to champion celebration.</p>
        </div>

        <div className="features-grid">
          <div className="feature-item">
            <div className="feature-icon-wrap">
              <Sparkles size={22} />
            </div>
            <h4>1. AI Question Synthesis</h4>
            <p>Pick any subject — from JavaScript to World Capitals — to instantly generate balanced, 4-option questions.</p>
          </div>

          <div className="feature-item">
            <div className="feature-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
              <Zap size={22} />
            </div>
            <h4>2. Zero-Install Instant Play</h4>
            <p>Players join simply by scanning a QR code or entering a 6-digit PIN on any smartphone or browser.</p>
          </div>

          <div className="feature-item">
            <div className="feature-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              <Crown size={22} />
            </div>
            <h4>3. Grand Podium Fanfare</h4>
            <p>Celebrate top performers on a 3-tier Kahoot-style podium with synthesized audio fanfares and analytics.</p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home
