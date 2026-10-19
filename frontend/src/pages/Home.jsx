import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlaySquare, Users, Zap, Sparkles, Flame, BarChart3, ArrowRight } from 'lucide-react'

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
      {/* Hero Header */}
      <section className="hero-section">
        <div className="hero-pill">
          <Zap size={13} fill="currentColor" />
          <span>REAL-TIME MULTIPLAYER TRIVIA</span>
        </div>
        
        <h1 className="hero-title">
          Turn Knowledge into an <span className="title-highlight">Electrifying Showdown.</span>
        </h1>
        
        <p className="hero-subtitle">
          Host interactive live quizzes with sub-50ms WebSocket latency, AI-crafted trivia, 
          dynamic streak multipliers, and instant podium fanfare.
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
            Join Game <ArrowRight size={17} />
          </button>
        </form>
      </section>

      {/* Choice Cards (Hero Split) */}
      <div className="hero-cards-grid">
        <div 
          className="hero-action-card host-card" 
          onClick={() => navigate('/host')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/host')}
        >
          <div>
            <div className="card-top-icon" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              <PlaySquare size={26} />
            </div>
            <span className="card-badge" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              Host & Present
            </span>
            <h2 className="card-title">Host a Live Quiz</h2>
            <p className="card-desc">
              Create custom trivia or generate questions in seconds with AI. 
              Project live questions onto the big screen with instant vote tallies.
            </p>
          </div>
          <div className="card-footer-cta">
            <span>Create Game Room</span>
            <ArrowRight size={16} />
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
              <Users size={26} />
            </div>
            <span className="card-badge" style={{ background: 'var(--correct-bg)', color: 'var(--correct)' }}>
              Contestant
            </span>
            <h2 className="card-title">Join as Player</h2>
            <p className="card-desc">
              Hop in from any mobile device, tablet, or laptop. 
              Answer fast to claim speed bonuses, build streaks, and climb the podium.
            </p>
          </div>
          <div className="card-footer-cta" style={{ color: 'var(--correct)' }}>
            <span>Enter Lobby</span>
            <ArrowRight size={16} />
          </div>
        </div>
      </div>

      {/* Feature Showcase Grid */}
      <section className="features-section">
        <div className="features-header">
          <h3>Engineered for High-Energy Competition</h3>
          <p className="center-text">Everything you need to deliver an unforgettable game show experience.</p>
        </div>

        <div className="features-grid">
          <div className="feature-item">
            <div className="feature-icon-wrap">
              <Zap size={20} />
            </div>
            <h4>Sub-50ms Latency</h4>
            <p>Direct WebSocket sync ensures every buzzer, timer tick, and vote registers with zero lag.</p>
          </div>

          <div className="feature-item">
            <div className="feature-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
              <Sparkles size={20} />
            </div>
            <h4>AI Quiz Generation</h4>
            <p>Type any topic to automatically generate balanced, 4-option trivia questions with Groq AI.</p>
          </div>

          <div className="feature-item">
            <div className="feature-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
              <Flame size={20} />
            </div>
            <h4>Dynamic Streaks</h4>
            <p>Score multipliers reward sustained accuracy and lightning-fast reaction speeds.</p>
          </div>

          <div className="feature-item">
            <div className="feature-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              <BarChart3 size={20} />
            </div>
            <h4>Live Audience Tallies</h4>
            <p>Real-time vote distribution graphs and question-by-question difficulty analytics.</p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home
