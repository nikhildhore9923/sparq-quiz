import { useNavigate } from 'react-router-dom'
import { PlaySquare, Users } from 'lucide-react'

function Home() {
  const navigate = useNavigate()

  return (
    <div className="app">
      <div className="choice-grid">
        <div className="choice-card" onClick={() => navigate('/host/create')}>
          <div className="choice-icon"><PlaySquare size={40} color="var(--accent)" /></div>
          <div className="choice-title">Host a Quiz</div>
        </div>
        <div className="choice-card" onClick={() => navigate('/join')}>
          <div className="choice-icon"><Users size={40} color="var(--accent)" /></div>
          <div className="choice-title">Join a Quiz</div>
        </div>
      </div>
    </div>
  )
}

export default Home
