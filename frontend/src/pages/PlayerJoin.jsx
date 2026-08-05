import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '../socket'

function PlayerJoin() {
  const navigate = useNavigate()
  const [roomCode, setRoomCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)

  const handleJoin = () => {
    setError('')
    if (!roomCode.trim() || !name.trim()) return setError('Enter both a room code and your name.')

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
    <div className="app">
      <div className="brand-header">
        <div className="brand-mark">⚡ Sparq</div>
        <span className="brand-sub">join a live quiz</span>
      </div>

      <div className="panel">
        <div className="field">
          <label>Room code</label>
          <input
            className="room-code-input"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            placeholder="ABCXYZ"
            maxLength={6}
          />
        </div>
        <div className="field">
          <label>Your name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya" />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="btn btn-primary btn-block btn-lg" onClick={handleJoin} disabled={joining}>
          {joining ? 'Joining…' : 'Join Quiz'}
        </button>
      </div>
    </div>
  )
}

export default PlayerJoin
