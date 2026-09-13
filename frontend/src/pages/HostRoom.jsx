import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { socket } from '../socket'

function HostRoom() {
  const { roomCode } = useParams()
  const [phase, setPhase] = useState('lobby') // lobby | question | ended | finished
  const [participantCount, setParticipantCount] = useState(0)
  const [question, setQuestion] = useState(null)
  const [optionCounts, setOptionCounts] = useState({ A: 0, B: 0, C: 0, D: 0 })
  const [questionResult, setQuestionResult] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [finalStats, setFinalStats] = useState(null)

  useEffect(() => {
    // If the host refreshed the page, socket.id changed - rejoin the room
    // so we keep receiving broadcasts for it.
    socket.emit('host:joinRoom', { roomCode }, () => {})

    socket.on('lobby:update', ({ participantCount }) => setParticipantCount(participantCount))

    socket.on('quiz:started', () => setPhase('question'))

    socket.on('question:show', (q) => {
      setQuestion(q)
      setQuestionResult(null)
      setOptionCounts({ A: 0, B: 0, C: 0, D: 0 })
      setPhase('question')
    })

    socket.on('results:tally', ({ optionCounts }) => setOptionCounts(optionCounts))

    socket.on('question:ended', (result) => {
      setQuestionResult(result)
      setPhase('ended')
    })

    socket.on('leaderboard:update', ({ leaderboard }) => setLeaderboard(leaderboard))

    socket.on('quiz:finished', ({ finalLeaderboard, perQuestionStats }) => {
      setLeaderboard(finalLeaderboard)
      setFinalStats(perQuestionStats)
      setPhase('finished')
    })

    return () => {
      socket.off('lobby:update')
      socket.off('quiz:started')
      socket.off('question:show')
      socket.off('results:tally')
      socket.off('question:ended')
      socket.off('leaderboard:update')
      socket.off('quiz:finished')
    }
  }, [roomCode])

  const startQuiz = () => socket.emit('host:startQuiz', { roomCode })
  const nextQuestion = () => socket.emit('host:nextQuestion', { roomCode })

  const totalVotes = Object.values(optionCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="app wide">
      {phase === 'lobby' && (
        <div className="panel room-code-display">
          <p className="center-text">Share this code with participants</p>
          <div className="room-code-big">{roomCode}</div>
          <div className="stat-inline" style={{ marginTop: 20 }}>
            <div className="stat-inline-item">
              <div className="stat-inline-value">{participantCount}</div>
              <div className="stat-inline-label">Joined</div>
            </div>
          </div>
          <button
            className="btn btn-primary btn-lg"
            onClick={startQuiz}
            disabled={participantCount === 0}
            style={{ marginTop: 10 }}
          >
            {participantCount === 0 ? 'Waiting for participants…' : 'Start Quiz'}
          </button>
        </div>
      )}

      {phase === 'question' && question && (
        <div className="panel">
          <p className="center-text">
            Question {question.questionNumber} of {question.totalQuestions}
          </p>
          <div className="question-live-text">{question.questionText}</div>

          {['A', 'B', 'C', 'D'].map((letter) => (
            <div className="tally-row" key={letter}>
              <span className="option-letter">{letter}</span>
              <div className="tally-track">
                <div
                  className="tally-fill"
                  style={{ width: totalVotes ? `${(optionCounts[letter] / totalVotes) * 100}%` : '0%' }}
                />
              </div>
              <span className="tally-count">{optionCounts[letter]}</span>
            </div>
          ))}
          <p className="center-text" style={{ marginTop: 12 }}>{totalVotes} answer(s) submitted</p>
        </div>
      )}

      {phase === 'ended' && questionResult && (
        <div className="panel">
          <p className="center-text">Correct answer: <strong>{questionResult.correctOption}</strong></p>
          {['A', 'B', 'C', 'D'].map((letter) => (
            <div className="tally-row" key={letter}>
              <span className="option-letter">{letter}</span>
              <div className="tally-track">
                <div
                  className={`tally-fill ${letter === questionResult.correctOption ? 'correct-fill' : ''}`}
                  style={{
                    width: questionResult.totalAnswered
                      ? `${(questionResult.optionCounts[letter] / questionResult.totalAnswered) * 100}%`
                      : '0%',
                  }}
                />
              </div>
              <span className="tally-count">{questionResult.optionCounts[letter]}</span>
            </div>
          ))}
          
          {questionResult.fastestResponder && (
            <div style={{ marginTop: 24, padding: 12, backgroundColor: 'rgba(139, 92, 246, 0.1)', borderRadius: 8, border: '1px solid var(--accent)' }}>
              <p className="center-text" style={{ margin: 0 }}>
                ⚡ Fastest correct answer: <strong>{questionResult.fastestResponder.name}</strong> ({(questionResult.fastestResponder.time / 1000).toFixed(2)}s)
              </p>
            </div>
          )}

          <button className="btn btn-primary btn-block btn-lg" onClick={nextQuestion} style={{ marginTop: 16 }}>
            Next Question
          </button>
        </div>
      )}

      {(phase === 'ended' || phase === 'question') && leaderboard.length > 0 && (
        <div className="panel">
          <h2 className="panel-title">Leaderboard</h2>
          {leaderboard.slice(0, 5).map((p, i) => (
            <div className={`leaderboard-row rank-${i + 1}`} key={p.name + i}>
              <span className="leaderboard-rank">#{i + 1}</span>
              <span className="leaderboard-name">{p.name}</span>
              <span className="leaderboard-score">{p.score}</span>
            </div>
          ))}
        </div>
      )}

      {phase === 'finished' && (
        <>
          <div className="panel">
            <h2 className="panel-title">🏆 Final Leaderboard</h2>
            {leaderboard.map((p, i) => (
              <div className={`leaderboard-row rank-${i + 1}`} key={p.name + i}>
                <span className="leaderboard-rank">#{i + 1}</span>
                <span className="leaderboard-name">{p.name}</span>
                <span className="leaderboard-score">{p.score}</span>
              </div>
            ))}
          </div>

          <div className="panel">
            <h2 className="panel-title">Question Analytics</h2>
            {finalStats.map((q, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <p style={{ fontWeight: 600, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{i + 1}. {q.questionText}</span>
                  <span style={{ 
                    fontSize: 12, 
                    padding: '2px 8px', 
                    borderRadius: 12, 
                    backgroundColor: q.difficulty === 'Hard' ? 'var(--incorrect-bg)' : q.difficulty === 'Easy' ? 'var(--correct-bg)' : 'rgba(245, 158, 11, 0.1)',
                    color: q.difficulty === 'Hard' ? 'var(--incorrect)' : q.difficulty === 'Easy' ? 'var(--correct)' : 'var(--warn)'
                  }}>{q.difficulty}</span>
                </p>
                <p className="center-text" style={{ textAlign: 'left' }}>
                  {q.accuracyPct}% correct · avg response {(q.avgResponseMs / 1000).toFixed(1)}s · {q.totalAnswered} answered
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default HostRoom
