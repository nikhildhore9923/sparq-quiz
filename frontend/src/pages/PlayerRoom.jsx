import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { socket } from '../socket'

function PlayerRoom() {
  const { roomCode } = useParams()
  const [phase, setPhase] = useState('lobby') // lobby | question | answered | ended | finished
  const [question, setQuestion] = useState(null)
  const [selected, setSelected] = useState(null)
  const [lastResult, setLastResult] = useState(null)
  const [score, setScore] = useState(0)
  const [name, setName] = useState('')
  const [timeLeft, setTimeLeft] = useState(0)
  const [finalLeaderboard, setFinalLeaderboard] = useState([])
  const [myRank, setMyRank] = useState(null)
  const timerInterval = useRef(null)

  useEffect(() => {
    const token = localStorage.getItem(`quiz_token_${roomCode}`)
    const savedName = localStorage.getItem(`quiz_name_${roomCode}`)
    setName(savedName || '')

    if (token) {
      // Reconnection path: this handles both a normal page refresh and a
      // dropped mobile connection - either way, the server hands back our
      // current score and, if a question is live right now, the question
      // itself, so we resume mid-quiz instead of getting stuck.
      socket.emit('player:rejoin', { roomCode, token }, (res) => {
        if (res.error) return
        setScore(res.score)
        if (res.roomStatus === 'finished') setPhase('finished')
        else if (res.currentQuestion) setPhase('waiting-for-next') // question exists but we don't have its text without question:show
        else setPhase('lobby')
      })
    }

    socket.on('quiz:started', () => setPhase('question'))

    socket.on('question:show', (q) => {
      setQuestion(q)
      setSelected(null)
      setLastResult(null)
      setPhase('question')
    })

    socket.on('question:ended', (result) => {
      setPhase('ended')
      setLastResult((prev) => ({ ...prev, correctOption: result.correctOption }))
    })

    socket.on('leaderboard:update', ({ leaderboard }) => {
      const idx = leaderboard.findIndex((p) => p.name === savedName)
      setMyRank(idx >= 0 ? idx + 1 : null)
    })

    socket.on('quiz:finished', ({ finalLeaderboard }) => {
      setFinalLeaderboard(finalLeaderboard)
      setPhase('finished')
    })

    return () => {
      socket.off('quiz:started')
      socket.off('question:show')
      socket.off('question:ended')
      socket.off('leaderboard:update')
      socket.off('quiz:finished')
    }
  }, [roomCode])

  // Countdown display, driven by the server's deadline timestamp - not our
  // own clock's guess - so it stays accurate even if this device's clock drifts.
  useEffect(() => {
    if (!question || phase !== 'question') return
    clearInterval(timerInterval.current)
    timerInterval.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((question.deadline - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0) clearInterval(timerInterval.current)
    }, 200)
    return () => clearInterval(timerInterval.current)
  }, [question, phase])

  const submitAnswer = (letter) => {
    if (selected || !question) return
    setSelected(letter)
    socket.emit(
      'player:submitAnswer',
      { roomCode, questionId: question.questionId, selectedOption: letter },
      (res) => {
        if (res.error) return
        setScore((s) => s + res.points)
        setLastResult({ selected: letter, isCorrect: res.isCorrect, points: res.points })
        setPhase('answered')
      }
    )
  }

  return (
    <div className="app">
      <div className="brand-header">
        <div className="brand-mark">⚡ Sparq</div>
        <span className="brand-sub">{name}</span>
      </div>

      {(phase === 'lobby' || phase === 'waiting-for-next') && (
        <div className="panel">
          <p className="center-text">Waiting for the host to start the quiz…</p>
          <p className="center-text" style={{ marginTop: 8 }}>Your score so far: <strong>{score}</strong></p>
        </div>
      )}

      {question && (phase === 'question' || phase === 'answered' || phase === 'ended') && (
        <div className="panel">
          <p className="center-text">
            Question {question.questionNumber} of {question.totalQuestions}
          </p>

          {phase === 'question' && (
            <div className={`timer-ring ${timeLeft <= 5 ? 'urgent' : ''}`}>{timeLeft}s</div>
          )}

          <div className="question-live-text">{question.questionText}</div>

          <div className="option-buttons">
            {['A', 'B', 'C', 'D'].map((letter) => {
              let cls = 'option-btn'
              if (phase === 'ended' && lastResult) {
                if (letter === lastResult.correctOption) cls += ' correct'
                else if (letter === selected) cls += ' incorrect'
              } else if (selected === letter) {
                cls += ' selected'
              }
              return (
                <button
                  key={letter}
                  className={cls}
                  disabled={!!selected || phase !== 'question'}
                  onClick={() => submitAnswer(letter)}
                >
                  <span className="option-letter">{letter}</span>
                  {question.options[letter]}
                </button>
              )
            })}
          </div>

          {phase === 'answered' && (
            <p className="center-text" style={{ marginTop: 16 }}>
              {lastResult.isCorrect ? `Correct! +${lastResult.points} points` : 'Waiting for other players…'}
            </p>
          )}

          {phase === 'ended' && lastResult && (
            <p className="center-text" style={{ marginTop: 16 }}>
              {lastResult.isCorrect ? `You got it right! +${lastResult.points} points` : 'Not quite - see the correct answer above.'}
              {myRank && ` · You're rank #${myRank}`}
            </p>
          )}

          <p className="center-text" style={{ marginTop: 12 }}>Total score: <strong>{score}</strong></p>
        </div>
      )}

      {phase === 'finished' && (
        <div className="panel">
          <h2 className="panel-title">🏁 Quiz finished!</h2>
          <p className="center-text" style={{ marginBottom: 16 }}>Your final score: <strong>{score}</strong></p>
          {finalLeaderboard.map((p, i) => (
            <div className={`leaderboard-row rank-${i + 1}`} key={p.name + i}>
              <span className="leaderboard-rank">#{i + 1}</span>
              <span className="leaderboard-name">{p.name}</span>
              <span className="leaderboard-score">{p.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PlayerRoom
