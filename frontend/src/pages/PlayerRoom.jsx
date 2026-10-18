import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { socket } from '../socket'
import { 
  playTickSound, 
  playUrgentTickSound, 
  playCorrectSound, 
  playWrongSound, 
  playEndSound, 
  playVictorySound 
} from '../utils/sounds'
import { Zap, Timer, Trophy, Flame, CheckCircle2, XCircle, ArrowRight, Crown } from 'lucide-react'

const OPTION_LETTERS = ['A', 'B', 'C', 'D']
const OPTION_SHAPES = {
  A: '▲',
  B: '◆',
  C: '●',
  D: '■'
}
const OPTION_CLASSES = {
  A: 'opt-a',
  B: 'opt-b',
  C: 'opt-c',
  D: 'opt-d'
}

function PlayerRoom() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  
  const [phase, setPhase] = useState('lobby') // lobby | question | answered | ended | finished
  const [question, setQuestion] = useState(null)
  const [selected, setSelected] = useState(null)
  const [lastResult, setLastResult] = useState(null)
  const [score, setScore] = useState(0)
  const [name, setName] = useState('')
  const [timeLeft, setTimeLeft] = useState(0)
  const [totalTime, setTotalTime] = useState(20)
  const [finalLeaderboard, setFinalLeaderboard] = useState([])
  const [myRank, setMyRank] = useState(null)
  
  const timerInterval = useRef(null)

  useEffect(() => {
    const token = localStorage.getItem(`quiz_token_${roomCode}`)
    const savedName = localStorage.getItem(`quiz_name_${roomCode}`)
    setName(savedName || 'Player')

    if (token) {
      // Reconnection path: server hands back current score and state
      socket.emit('player:rejoin', { roomCode, token }, (res) => {
        if (res.error) return
        setScore(res.score)
        if (res.roomStatus === 'finished') {
          setPhase('finished')
        } else if (res.currentQuestion) {
          setPhase('waiting-for-next')
        } else {
          setPhase('lobby')
        }
      })
    }

    socket.on('quiz:started', () => {
      setPhase('question')
      playTickSound()
    })

    socket.on('question:show', (q) => {
      setQuestion(q)
      setSelected(null)
      setLastResult(null)
      setPhase('question')
      setTotalTime(q.timeLimit || 20)
      playTickSound()
    })

    socket.on('question:ended', (result) => {
      setPhase('ended')
      setLastResult((prev) => {
        const isCorrect = prev ? prev.selected === result.correctOption : false
        if (isCorrect) {
          playCorrectSound()
        } else {
          playWrongSound()
        }
        return { 
          ...prev, 
          correctOption: result.correctOption,
          isCorrect: prev ? prev.isCorrect : isCorrect 
        }
      })
    })

    socket.on('leaderboard:update', ({ leaderboard }) => {
      const idx = leaderboard.findIndex((p) => p.name === savedName)
      setMyRank(idx >= 0 ? idx + 1 : null)
    })

    socket.on('quiz:finished', ({ finalLeaderboard }) => {
      setFinalLeaderboard(finalLeaderboard)
      setPhase('finished')
      playVictorySound()
    })

    return () => {
      socket.off('quiz:started')
      socket.off('question:show')
      socket.off('question:ended')
      socket.off('leaderboard:update')
      socket.off('quiz:finished')
      clearInterval(timerInterval.current)
    }
  }, [roomCode])

  // Countdown display driven by server deadline timestamp
  useEffect(() => {
    if (!question || phase !== 'question') return
    clearInterval(timerInterval.current)
    
    timerInterval.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((question.deadline - Date.now()) / 1000))
      setTimeLeft(remaining)
      
      // Play urgent sound when time is short
      if (remaining <= 5 && remaining > 0) {
        playUrgentTickSound()
      }
      
      if (remaining === 0) {
        clearInterval(timerInterval.current)
      }
    }, 250)

    return () => clearInterval(timerInterval.current)
  }, [question, phase])

  const submitAnswer = (letter) => {
    if (selected || !question || phase !== 'question') return
    setSelected(letter)
    playTickSound()

    socket.emit(
      'player:submitAnswer',
      { roomCode, questionId: question.questionId, selectedOption: letter },
      (res) => {
        if (res.error) return
        setScore((s) => s + res.points)
        setLastResult({ 
          selected: letter, 
          isCorrect: res.isCorrect, 
          points: res.points, 
          streak: res.streak 
        })
        setPhase('answered')
      }
    )
  }

  const timeProgressPct = totalTime > 0 ? Math.max(0, Math.min(100, (timeLeft / totalTime) * 100)) : 0

  return (
    <div className="app slide-in">
      {/* 1. LOBBY & WAITING PHASES */}
      {(phase === 'lobby' || phase === 'waiting-for-next') && (
        <div className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div 
            style={{ 
              width: 80, 
              height: 80, 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, var(--accent) 0%, #3b82f6 100%)', 
              color: '#ffffff', 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: 32,
              fontWeight: 700,
              boxShadow: '0 0 25px var(--accent-glow)',
              marginBottom: 20
            }}
          >
            {name ? name.charAt(0).toUpperCase() : 'P'}
          </div>

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 8 }}>
            You're in, <span style={{ color: 'var(--accent)' }}>{name}</span>!
          </h2>

          <div style={{ display: 'inline-block', margin: '8px 0 20px' }}>
            <span style={{ 
              fontFamily: 'var(--font-mono)', 
              fontSize: 14, 
              padding: '6px 16px', 
              borderRadius: 'var(--radius-full)', 
              background: 'var(--input-bg)',
              border: '1px solid var(--panel-border)',
              letterSpacing: '0.1em'
            }}>
              ROOM PIN: <strong>{roomCode}</strong>
            </span>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: 16, maxWidth: 380, margin: '0 auto 24px' }}>
            {phase === 'lobby' 
              ? 'Keep your eyes on the host screen. The quiz will launch momentarily!'
              : 'Question in progress! You will automatically join on the next question.'}
          </p>

          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: 8, 
            background: 'var(--input-bg)', 
            padding: '10px 20px', 
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--panel-border)'
          }}>
            <Trophy size={18} color="#f59e0b" />
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Current Score:</span>
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--text-primary)' }}>{score} pts</strong>
          </div>
        </div>
      )}

      {/* 2. QUESTION & ANSWERED & ENDED PHASES */}
      {question && (phase === 'question' || phase === 'answered' || phase === 'ended') && (
        <div className="panel">
          {/* Header Bar */}
          <div className="quiz-header-bar">
            <span className="quiz-progress-badge">
              QUESTION {question.questionNumber} OF {question.totalQuestions}
            </span>
            <span className="quiz-score-badge">
              <Zap size={16} fill="currentColor" /> {score} pts
            </span>
          </div>

          {/* Countdown Timer with Progress Track */}
          {phase === 'question' && (
            <div className="timer-container">
              <div className={`timer-pill ${timeLeft <= 5 ? 'urgent' : ''}`}>
                <Timer size={20} />
                <span>{timeLeft}s</span>
              </div>
              <div className="timer-progress-track">
                <div 
                  className={`timer-progress-bar ${timeLeft <= 5 ? 'urgent' : ''}`}
                  style={{ width: `${timeProgressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Question Text */}
          <div className="question-live-text">
            {question.questionText}
          </div>

          {/* 4-Color Competitive Options */}
          <div className="option-buttons">
            {OPTION_LETTERS.map((letter) => {
              const optCls = OPTION_CLASSES[letter]
              let cls = `option-btn ${optCls}`
              
              if (phase === 'ended' && lastResult) {
                if (letter === lastResult.correctOption) {
                  cls += ' correct'
                } else if (letter === selected) {
                  cls += ' incorrect'
                }
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
                  <span className={`option-badge ${optCls}`}>
                    {OPTION_SHAPES[letter]}
                  </span>
                  <span className="option-text-content">
                    {question.options[letter]}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Answered State Feedback */}
          {phase === 'answered' && (
            <div className="answer-feedback-card" style={{ background: 'var(--input-bg)', border: '1px solid var(--accent)' }}>
              <div className="feedback-headline" style={{ color: 'var(--accent)' }}>
                <span>🎯 Answer Locked In!</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                Waiting for the timer to expire and other players to finish…
              </p>
            </div>
          )}

          {/* Question Ended State Feedback */}
          {phase === 'ended' && lastResult && (
            <div className={`answer-feedback-card ${lastResult.isCorrect ? 'correct' : 'incorrect'}`}>
              <div className="feedback-headline">
                {lastResult.isCorrect ? (
                  <>
                    <CheckCircle2 size={24} />
                    <span>Brilliant! You got it right!</span>
                  </>
                ) : (
                  <>
                    <XCircle size={24} />
                    <span>Not quite! See correct answer above</span>
                  </>
                )}
              </div>

              {lastResult.isCorrect && (
                <div>
                  <strong style={{ fontSize: 18 }}>+{lastResult.points} Points</strong>
                  {lastResult.streak > 1 && (
                    <div>
                      <span className="streak-flame-badge">
                        <Flame size={16} /> {lastResult.streak}x Streak Multiplier Applied!
                      </span>
                    </div>
                  )}
                </div>
              )}

              {myRank && (
                <p style={{ marginTop: 10, fontSize: 14, fontWeight: 600 }}>
                  Current Standing: <strong>#{myRank}</strong> on the Leaderboard
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. FINAL FINISHED STATE & PODIUM */}
      {phase === 'finished' && (
        <div className="panel slide-in" style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 16 }}>
            <span style={{ 
              background: 'rgba(245, 158, 11, 0.2)', 
              color: '#f59e0b', 
              padding: '6px 16px', 
              borderRadius: 'var(--radius-full)', 
              fontWeight: 700, 
              fontSize: 13,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}>
              <Trophy size={16} /> QUIZ COMPLETE
            </span>
          </div>

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 8 }}>
            Final Showdown
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16, marginBottom: 28 }}>
            Your Final Score: <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 20 }}>{score} pts</strong>
            {myRank && ` • Rank #${myRank}`}
          </p>

          {/* 3-Place Podium if at least 1 player */}
          {finalLeaderboard.length > 0 && (
            <div className="podium-container">
              {/* 2nd Place */}
              {finalLeaderboard[1] && (
                <div className="podium-column podium-rank-2">
                  <div className="podium-avatar">2</div>
                  <div className="podium-name">{finalLeaderboard[1].name}</div>
                  <div className="podium-score">{finalLeaderboard[1].score}</div>
                  <div className="podium-block">2</div>
                </div>
              )}

              {/* 1st Place */}
              {finalLeaderboard[0] && (
                <div className="podium-column podium-rank-1">
                  <Crown size={28} className="podium-crown" />
                  <div className="podium-avatar">1</div>
                  <div className="podium-name">{finalLeaderboard[0].name}</div>
                  <div className="podium-score">{finalLeaderboard[0].score}</div>
                  <div className="podium-block">1</div>
                </div>
              )}

              {/* 3rd Place */}
              {finalLeaderboard[2] && (
                <div className="podium-column podium-rank-3">
                  <div className="podium-avatar">3</div>
                  <div className="podium-name">{finalLeaderboard[2].name}</div>
                  <div className="podium-score">{finalLeaderboard[2].score}</div>
                  <div className="podium-block">3</div>
                </div>
              )}
            </div>
          )}

          {/* Full Leaderboard List */}
          <div style={{ marginTop: 32, textAlign: 'left' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 12 }}>
              Scoreboard
            </h3>
            {finalLeaderboard.map((p, i) => (
              <div 
                className={`leaderboard-row ${i === 0 ? 'rank-1' : ''}`} 
                key={p.name + i}
                style={{ 
                  borderColor: p.name === name ? 'var(--accent)' : undefined,
                  background: p.name === name ? 'var(--accent-light)' : undefined
                }}
              >
                <span className="leaderboard-rank">#{i + 1}</span>
                <span className="leaderboard-name">
                  {p.name} {p.name === name && <span style={{ fontSize: 12, color: 'var(--accent)' }}>(You)</span>}
                </span>
                <span className="leaderboard-score">{p.score} pts</span>
              </div>
            ))}
          </div>

          <button 
            className="btn btn-primary btn-block btn-lg" 
            onClick={() => navigate('/')} 
            style={{ marginTop: 28 }}
          >
            Back to Home <ArrowRight size={20} />
          </button>
        </div>
      )}
    </div>
  )
}

export default PlayerRoom
