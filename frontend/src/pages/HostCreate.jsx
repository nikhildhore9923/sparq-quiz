import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '../socket'

const emptyQuestion = () => ({
  questionText: '',
  options: ['', '', '', ''],
  correctOption: 'A',
  timeLimit: 20,
})

function HostCreate() {
  const navigate = useNavigate()
  const [hostName, setHostName] = useState('')
  const [questions, setQuestions] = useState([emptyQuestion()])
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  const updateQuestion = (index, patch) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)))
  }

  const updateOption = (qIndex, optIndex, value) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q
        const options = [...q.options]
        options[optIndex] = value
        return { ...q, options }
      })
    )
  }

  const addQuestion = () => setQuestions((prev) => [...prev, emptyQuestion()])
  const removeQuestion = (index) => setQuestions((prev) => prev.filter((_, i) => i !== index))

  const handleCreate = async () => {
    setError('')
    if (!hostName.trim()) return setError('Enter your name.')
    for (const q of questions) {
      if (!q.questionText.trim() || q.options.some((o) => !o.trim())) {
        return setError('Every question needs text and all 4 options filled in.')
      }
    }

    setCreating(true)
    try {
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
      const res = await fetch(`${serverUrl}/api/quiz/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName, questions })
      })
      const data = await res.json()
      
      setCreating(false)
      if (!data.success) {
        if (data.errors) return setError(data.errors.map(e => e.message).join(', '));
        return setError(data.error || 'Failed to create room')
      }
      
      sessionStorage.setItem('hostRoomCode', data.roomCode)
      navigate(`/host/${data.roomCode}`)
    } catch (err) {
      setCreating(false)
      setError('Could not connect to server')
    }
  }

  return (
    <div className="app wide">
      <div className="brand-header">
        <div className="brand-mark">⚡ Sparq</div>
        <span className="brand-sub">build your quiz</span>
      </div>

      <div className="panel">
        <div className="field">
          <label>Your name (shown to participants)</label>
          <input value={hostName} onChange={(e) => setHostName(e.target.value)} placeholder="e.g. Nikhil" />
        </div>
      </div>

      {questions.map((q, qIndex) => (
        <div className="question-card" key={qIndex}>
          <div className="question-card-header">
            <span className="question-number">QUESTION {qIndex + 1}</span>
            {questions.length > 1 && (
              <button className="btn btn-ghost" onClick={() => removeQuestion(qIndex)}>
                Remove
              </button>
            )}
          </div>

          <div className="field">
            <input
              placeholder="Question text"
              value={q.questionText}
              onChange={(e) => updateQuestion(qIndex, { questionText: e.target.value })}
            />
          </div>

          {['A', 'B', 'C', 'D'].map((letter, optIndex) => (
            <div className="option-row" key={letter}>
              <input
                type="radio"
                name={`correct-${qIndex}`}
                checked={q.correctOption === letter}
                onChange={() => updateQuestion(qIndex, { correctOption: letter })}
                title="Mark as correct answer"
              />
              <input
                type="text"
                placeholder={`Option ${letter}`}
                value={q.options[optIndex]}
                onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
              />
            </div>
          ))}

          <div className="field" style={{ marginTop: 10 }}>
            <label>Time limit (seconds)</label>
            <input
              type="number"
              min="5"
              max="120"
              value={q.timeLimit}
              onChange={(e) => updateQuestion(qIndex, { timeLimit: parseInt(e.target.value) || 20 })}
              style={{ width: 100 }}
            />
          </div>
        </div>
      ))}

      <button className="btn btn-ghost btn-block" onClick={addQuestion} style={{ marginBottom: 20 }}>
        + Add another question
      </button>

      {error && <p className="error-text">{error}</p>}

      <button className="btn btn-primary btn-block btn-lg" onClick={handleCreate} disabled={creating}>
        {creating ? 'Creating room…' : 'Create Room'}
      </button>
    </div>
  )
}

export default HostCreate
