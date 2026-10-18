import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { socket } from '../socket'
import { QRCodeCanvas } from 'qrcode.react'
import { playJoinSound, playTickSound, playEndSound, playVictorySound } from '../utils/sounds'
import { 
  Users, 
  Copy, 
  Check, 
  ArrowRight, 
  Zap, 
  Trophy, 
  Crown, 
  BarChart3, 
  Clock, 
  Share2,
  RefreshCw 
} from 'lucide-react'

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

function HostRoom() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  
  const [phase, setPhase] = useState('lobby') // lobby | question | ended | finished
  const [participantCount, setParticipantCount] = useState(0)
  const [participants, setParticipants] = useState([])
  const [question, setQuestion] = useState(null)
  const [optionCounts, setOptionCounts] = useState({ A: 0, B: 0, C: 0, D: 0 })
  const [globalAccuracy, setGlobalAccuracy] = useState(0)
  const [questionResult, setQuestionResult] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [finalStats, setFinalStats] = useState(null)
  const [toastMessage, setToastMessage] = useState('')

  const hostToken = sessionStorage.getItem(`hostToken_${roomCode}`) || ''

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 2500)
  }

  useEffect(() => {
    // Rejoin the room with host authorization token
    socket.emit('host:joinRoom', { roomCode, hostToken }, (res) => {
      if (res && res.error) {
        console.warn('Host join warning:', res.error)
      }
    })

    socket.on('participantJoined', (data) => {
      setParticipantCount(data.count)
      if (data.name) {
        setParticipants((prev) => prev.includes(data.name) ? prev : [...prev, data.name])
      }
      playJoinSound()
    })

    socket.on('lobby:update', ({ participantCount, participants: pList }) => {
      setParticipantCount(participantCount)
      if (pList && Array.isArray(pList)) {
        setParticipants(pList)
      }
      playJoinSound()
    })

    socket.on('quiz:started', () => {
      setPhase('question')
      playTickSound()
    })

    socket.on('question:show', (q) => {
      setQuestion(q)
      setQuestionResult(null)
      setOptionCounts({ A: 0, B: 0, C: 0, D: 0 })
      setGlobalAccuracy(0)
      setPhase('question')
      playTickSound()
    })

    socket.on('results:tally', ({ optionCounts, globalAccuracy }) => {
      setOptionCounts(optionCounts)
      if (globalAccuracy !== undefined) setGlobalAccuracy(globalAccuracy)
    })

    socket.on('question:ended', (result) => {
      setQuestionResult(result)
      setPhase('ended')
      playEndSound()
    })

    socket.on('leaderboard:update', ({ leaderboard }) => setLeaderboard(leaderboard))

    socket.on('quiz:finished', ({ finalLeaderboard, perQuestionStats }) => {
      setLeaderboard(finalLeaderboard)
      setFinalStats(perQuestionStats)
      setPhase('finished')
      playVictorySound()
    })

    return () => {
      socket.off('participantJoined')
      socket.off('lobby:update')
      socket.off('quiz:started')
      socket.off('question:show')
      socket.off('results:tally')
      socket.off('question:ended')
      socket.off('leaderboard:update')
      socket.off('quiz:finished')
    }
  }, [roomCode, hostToken])

  const startQuiz = () => socket.emit('host:startQuiz', { roomCode, hostToken })
  const nextQuestion = () => socket.emit('host:nextQuestion', { roomCode, hostToken })

  const totalVotes = Object.values(optionCounts).reduce((a, b) => a + b, 0)
  const joinUrl = `${window.location.origin}/join?code=${roomCode}`

  const copyPin = () => {
    navigator.clipboard.writeText(roomCode)
    showToast(`Copied PIN: ${roomCode}`)
  }

  const copyUrl = () => {
    navigator.clipboard.writeText(joinUrl)
    showToast('Copied Join URL to clipboard!')
  }

  return (
    <div className="app wide slide-in">
      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="toast-container">
          <div className="toast">
            <Check size={18} color="var(--correct)" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* 1. LOBBY PHASE */}
      {phase === 'lobby' && (
        <div className="panel" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ 
              background: 'var(--accent-light)', 
              color: 'var(--accent)', 
              padding: '6px 16px', 
              borderRadius: 'var(--radius-full)', 
              fontWeight: 700, 
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.08em'
            }}>
              GAME LOBBY READY
            </span>
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, marginBottom: 6 }}>
            Join the Quiz!
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16, marginBottom: 28 }}>
            Scan the QR code or enter the Room PIN at <strong>{window.location.host}</strong>
          </p>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            flexWrap: 'wrap', 
            gap: 40,
            marginBottom: 36
          }}>
            {/* Big PIN Display */}
            <div style={{ 
              background: 'var(--input-bg)', 
              padding: '24px 32px', 
              borderRadius: 'var(--radius-xl)',
              border: '2px solid var(--panel-border)',
              boxShadow: 'var(--shadow-md)'
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
                ROOM PIN
              </span>
              <div className="room-code-big">{roomCode}</div>
              
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={copyPin}>
                  <Copy size={14} /> Copy PIN
                </button>
                <button className="btn btn-ghost btn-sm" onClick={copyUrl}>
                  <Share2 size={14} /> Copy Link
                </button>
              </div>
            </div>

            {/* QR Code Container */}
            <div style={{ 
              background: '#ffffff', 
              padding: '16px', 
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              <QRCodeCanvas value={joinUrl} size={150} level="M" />
              <span style={{ color: '#0f172a', fontSize: 11, fontWeight: 700, marginTop: 8 }}>
                SCAN WITH PHONE
              </span>
            </div>
          </div>

          {/* Connected Participants Counter */}
          <div style={{ maxWidth: 440, margin: '0 auto 28px' }}>
            <div className="stat-inline">
              <div className="stat-inline-item">
                <div className="stat-inline-value" style={{ color: participantCount > 0 ? 'var(--correct)' : 'var(--text-secondary)' }}>
                  {participantCount}
                </div>
                <div className="stat-inline-label">
                  <Users size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                  Players Joined
                </div>
              </div>
            </div>

            {/* Participant Chips Grid */}
            {participants.length > 0 && (
              <div className="participant-chips-grid">
                {participants.map((name, i) => (
                  <span className="participant-chip" key={name + i}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--correct)' }}></span>
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            className="btn btn-primary btn-lg"
            onClick={startQuiz}
            disabled={participantCount === 0}
            style={{ minWidth: 260 }}
          >
            {participantCount === 0 ? 'Waiting for players to join…' : `Start Quiz (${participantCount} Players)`} 
            <ArrowRight size={20} />
          </button>
        </div>
      )}

      {/* 2. QUESTION ACTIVE PHASE */}
      {phase === 'question' && question && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span className="quiz-progress-badge">
              QUESTION {question.questionNumber} OF {question.totalQuestions}
            </span>
            {question.mode && (
              <span style={{ 
                fontSize: 12, 
                padding: '4px 12px', 
                borderRadius: 'var(--radius-full)', 
                backgroundColor: 'var(--accent-light)', 
                color: 'var(--accent)', 
                fontWeight: 700 
              }}>
                {question.mode} Mode
              </span>
            )}
          </div>

          <h2 className="question-live-text" style={{ fontSize: 32, marginBottom: 36 }}>
            {question.questionText}
          </h2>

          {/* Live Tally Bars */}
          <div style={{ marginBottom: 28 }}>
            {OPTION_LETTERS.map((letter) => {
              const count = optionCounts[letter] || 0
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
              const optCls = OPTION_CLASSES[letter]

              return (
                <div className="tally-row" key={letter}>
                  <span className={`option-badge ${optCls}`} style={{ width: 34, height: 34, fontSize: 14 }}>
                    {OPTION_SHAPES[letter]}
                  </span>
                  <div className="tally-track">
                    <div
                      className={`tally-fill ${optCls}`}
                      style={{ width: `${pct}%` }}
                    >
                      {pct > 12 && <span>{pct}%</span>}
                    </div>
                  </div>
                  <span className="tally-count">{count}</span>
                </div>
              )
            })}
          </div>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '14px 20px', 
            background: 'var(--input-bg)', 
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--panel-border)'
          }}>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              <strong>{totalVotes}</strong> of <strong>{participantCount}</strong> players responded
            </span>
            {totalVotes > 0 && (
              <span style={{ color: 'var(--correct)', fontWeight: 700, fontSize: 14 }}>
                Live Accuracy: {globalAccuracy}%
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3. QUESTION ENDED PHASE */}
      {phase === 'ended' && questionResult && (
        <div className="panel slide-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span className="quiz-progress-badge">
              QUESTION {question.questionNumber} RESULT
            </span>
            <span style={{ 
              fontSize: 13, 
              padding: '4px 12px', 
              borderRadius: 'var(--radius-full)', 
              background: 'var(--correct-bg)', 
              color: 'var(--correct)', 
              fontWeight: 700 
            }}>
              Correct Answer: {questionResult.correctOption} ({OPTION_SHAPES[questionResult.correctOption]})
            </span>
          </div>

          <h2 className="question-live-text" style={{ fontSize: 26, marginBottom: 28 }}>
            {question ? question.questionText : 'Question Review'}
          </h2>

          {/* Results Breakdown */}
          {OPTION_LETTERS.map((letter) => {
            const count = questionResult.optionCounts[letter] || 0
            const total = questionResult.totalAnswered || 1
            const pct = Math.round((count / total) * 100)
            const isCorrect = letter === questionResult.correctOption
            const optCls = OPTION_CLASSES[letter]

            return (
              <div className="tally-row" key={letter}>
                <span className={`option-badge ${optCls}`} style={{ width: 34, height: 34, fontSize: 14 }}>
                  {OPTION_SHAPES[letter]}
                </span>
                <div className="tally-track">
                  <div
                    className={`tally-fill ${isCorrect ? 'correct-fill' : optCls}`}
                    style={{ width: `${pct}%`, opacity: isCorrect ? 1 : 0.6 }}
                  >
                    {pct > 10 && <span>{pct}%</span>}
                  </div>
                </div>
                <span className="tally-count" style={{ color: isCorrect ? 'var(--correct)' : undefined }}>
                  {count}
                </span>
              </div>
            )
          })}

          {/* Fastest Responder Spotlight */}
          {questionResult.fastestResponder && (
            <div className="fastest-spotlight">
              <Zap size={20} fill="#f59e0b" color="#f59e0b" />
              <span>
                Fastest correct answer: <strong>{questionResult.fastestResponder.name}</strong> in{' '}
                <strong>{(questionResult.fastestResponder.time / 1000).toFixed(2)}s</strong>
              </span>
            </div>
          )}

          {/* Live Top 5 Leaderboard */}
          {leaderboard.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 12 }}>
                Current Top Standings
              </h3>
              {leaderboard.slice(0, 5).map((p, i) => (
                <div className={`leaderboard-row ${i === 0 ? 'rank-1' : ''}`} key={p.name + i}>
                  <span className="leaderboard-rank">#{i + 1}</span>
                  <span className="leaderboard-name">{p.name}</span>
                  <span className="leaderboard-score">{p.score} pts</span>
                </div>
              ))}
            </div>
          )}

          <button 
            className="btn btn-primary btn-block btn-lg" 
            onClick={nextQuestion} 
            style={{ marginTop: 28 }}
          >
            {question && question.questionNumber === question.totalQuestions 
              ? 'Finish Quiz & Reveal Winners 🏆' 
              : 'Next Question →'}
          </button>
        </div>
      )}

      {/* 4. FINAL FINISHED PHASE */}
      {phase === 'finished' && (
        <>
          <div className="panel slide-in" style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ 
                background: 'rgba(245, 158, 11, 0.2)', 
                color: '#f59e0b', 
                padding: '6px 18px', 
                borderRadius: 'var(--radius-full)', 
                fontWeight: 700, 
                fontSize: 14,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}>
                <Trophy size={18} /> TOURNAMENT CHAMPIONS
              </span>
            </div>

            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, marginBottom: 12 }}>
              The Grand Podium
            </h1>

            {/* Podium for Top 3 */}
            {leaderboard.length > 0 && (
              <div className="podium-container">
                {/* 2nd Place */}
                {leaderboard[1] && (
                  <div className="podium-column podium-rank-2">
                    <div className="podium-avatar">2</div>
                    <div className="podium-name">{leaderboard[1].name}</div>
                    <div className="podium-score">{leaderboard[1].score} pts</div>
                    <div className="podium-block">2</div>
                  </div>
                )}

                {/* 1st Place */}
                {leaderboard[0] && (
                  <div className="podium-column podium-rank-1">
                    <Crown size={30} className="podium-crown" />
                    <div className="podium-avatar">1</div>
                    <div className="podium-name">{leaderboard[0].name}</div>
                    <div className="podium-score">{leaderboard[0].score} pts</div>
                    <div className="podium-block">1</div>
                  </div>
                )}

                {/* 3rd Place */}
                {leaderboard[2] && (
                  <div className="podium-column podium-rank-3">
                    <div className="podium-avatar">3</div>
                    <div className="podium-name">{leaderboard[2].name}</div>
                    <div className="podium-score">{leaderboard[2].score} pts</div>
                    <div className="podium-block">3</div>
                  </div>
                )}
              </div>
            )}

            {/* Full Final Leaderboard */}
            <div style={{ marginTop: 32, textAlign: 'left' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 14 }}>
                Final Scoreboard ({leaderboard.length} Contestants)
              </h3>
              {leaderboard.map((p, i) => (
                <div className={`leaderboard-row ${i === 0 ? 'rank-1' : ''}`} key={p.name + i}>
                  <span className="leaderboard-rank">#{i + 1}</span>
                  <span className="leaderboard-name">{p.name}</span>
                  <span className="leaderboard-score">{p.score} pts</span>
                </div>
              ))}
            </div>

            <button 
              className="btn btn-primary btn-lg" 
              onClick={() => navigate('/host')} 
              style={{ marginTop: 28 }}
            >
              <RefreshCw size={18} /> Host Another Quiz
            </button>
          </div>

          {/* Question Analytics Card */}
          {finalStats && finalStats.length > 0 && (
            <div className="panel slide-in">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <BarChart3 size={20} color="var(--accent)" />
                <h2 className="panel-title" style={{ margin: 0 }}>
                  Question Performance Analytics
                </h2>
              </div>

              {finalStats.map((q, i) => (
                <div 
                  key={i} 
                  style={{ 
                    padding: '16px', 
                    borderRadius: 'var(--radius-md)', 
                    background: 'var(--input-bg)', 
                    border: '1px solid var(--panel-border)',
                    marginBottom: 12 
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
                      {i + 1}. {q.questionText}
                    </span>
                    <span style={{ 
                      fontSize: 12, 
                      padding: '3px 10px', 
                      borderRadius: 'var(--radius-full)', 
                      backgroundColor: q.difficulty === 'Hard' ? 'var(--incorrect-bg)' : q.difficulty === 'Easy' ? 'var(--correct-bg)' : 'var(--warn-bg)',
                      color: q.difficulty === 'Hard' ? 'var(--incorrect)' : q.difficulty === 'Easy' ? 'var(--correct)' : 'var(--warn)',
                      fontWeight: 700,
                      flexShrink: 0
                    }}>
                      {q.difficulty}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <span><strong>{q.accuracyPct}%</strong> accuracy</span>
                    <span>•</span>
                    <span>avg response <strong>{(q.avgResponseMs / 1000).toFixed(1)}s</strong></span>
                    <span>•</span>
                    <span><strong>{q.totalAnswered}</strong> answered</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default HostRoom
