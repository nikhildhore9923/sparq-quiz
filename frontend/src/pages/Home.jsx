import { useNavigate } from 'react-router-dom'

function Home() {
  const navigate = useNavigate()

  return (
    <div className="app">
      <div className="brand-header">
        <div className="brand-mark">⚡ Sparq</div>
        <span className="brand-sub">live quiz, real time</span>
      </div>

      <div className="choice-grid">
        <div className="choice-card" onClick={() => navigate('/host/create')}>
          <div className="choice-icon">🎛️</div>
          <div className="choice-title">Host a Quiz</div>
        </div>
        <div className="choice-card" onClick={() => navigate('/join')}>
          <div className="choice-icon">📱</div>
          <div className="choice-title">Join a Quiz</div>
        </div>
      </div>
    </div>
  )
}

export default Home
