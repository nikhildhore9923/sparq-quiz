import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LogIn, Dices, AlertCircle, Sparkles } from 'lucide-react'
import { socket } from '../socket'

const FUN_NICKNAMES = [
  'TurboCheetah', 'CosmicFalcon', 'QuantumOtter', 'PixelPanda', 
  'NeonTiger', 'AstroPenguin', 'Velociraptor', 'StarlightFox', 
  'HyperBadger', 'ElectricKoala', 'BlazePhoenix', 'GlitchWizard', 
  'CyberSamurai', 'RocketRaccoon', 'NovaKnight', 'ApexLynx'
]

function PlayerJoin() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const [roomCode, setRoomCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const codeFromUrl = params.get('code')
    if (codeFromUrl) {
      setRoomCode(codeFromUrl.toUpperCase())
    }
  }, [location])

  const generateRandomNickname = () => {
    const randomPick = FUN_NICKNAMES[Math.floor(Math.random() * FUN_NICKNAMES.length)]
    const suffix = Math.floor(Math.random() * 90 + 10) // 10-99
    setName(`${randomPick}${suffix}`)
  }

  const handleJoin = (e) => {
    if (e && e.preventDefault) e.preventDefault()
    setError('')
    if (!roomCode.trim() || !name.trim()) {
      return setError('Please enter both the 6-character room code and your nickname.')
    }

    const code = roomCode.trim().toUpperCase()
    setJoining(true)
    
    socket.emit('player:join', { roomCode: code, name: name.trim() }, (res) => {
      setJoining(false)
      if (res.error) return setError(res.error)
      localStorage.setItem(`quiz_token_${code}`, res.token)
      localStorage.setItem(`quiz_name_${code}`, name.trim())
      navigate(`/play/${code}`)
    })
  }

  return (
    <div className="app slide-in">
      <button 
        className="btn btn-ghost" 
        onClick={() => navigate('/')} 
        style={{ marginBottom: 20, padding: '8px 12px' }}
      >
        ← Back to Home
      </button>

      <div className="panel" style={{ maxWidth: 460, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div 
            style={{ 
              width: 50, 
              height: 50, 
              borderRadius: '50%', 
              background: 'var(--correct-bg)', 
              color: 'var(--correct)', 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              marginBottom: 12
            }}
          >
            <Sparkles size={26} />
          </div>
          <h2 className="panel-title" style={{ margin: 0, fontSize: 26 }}>Join Live Quiz</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 6 }}>
            Enter the host's Room PIN to jump into the action
          </p>
        </div>

        <form onSubmit={handleJoin}>
          <div className="field">
            <label style={{ textAlign: 'center' }}>ROOM PIN</label>
            <input
              className="room-code-input"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="ABCXYZ"
              maxLength={6}
              autoFocus={!roomCode}
            />
          </div>

          <div className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ margin: 0 }}>YOUR NICKNAME</label>
              <button
                type="button"
                onClick={generateRandomNickname}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Dices size={14} /> Randomize
              </button>
            </div>

            <div className="input-with-button">
              <input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="e.g. CosmicFalcon"
                className="base-input"
                maxLength={20}
                style={{ textAlign: 'center', fontSize: 18, fontWeight: 600 }}
              />
              <button
                type="button"
                className="dice-btn"
                onClick={generateRandomNickname}
                title="Generate fun random nickname"
              >
                <Dices size={18} />
              </button>
            </div>
          </div>

          {error && (
            <div className="error-text" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-success btn-block btn-lg" 
            disabled={joining || !roomCode.trim() || !name.trim()} 
            style={{ marginTop: 12 }}
          >
            {joining ? 'Entering Lobby…' : 'Enter Lobby'} <LogIn size={20} />
          </button>
        </form>
      </div>
    </div>
  )
}

export default PlayerJoin
