import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, Trash2, ArrowRight, Save, Download, GripVertical } from 'lucide-react'

const emptyQuestion = () => ({
  questionText: '',
  options: ['', '', '', ''],
  correctOption: 'A',
  timeLimit: 20,
})

function HostCreate() {
  const navigate = useNavigate()
  const [hostName, setHostName] = useState('')
  const [mode, setMode] = useState('Classic')
  const [topic, setTopic] = useState('')
  const [numQuestions, setNumQuestions] = useState(5)
  const [generating, setGenerating] = useState(false)
  const [questions, setQuestions] = useState([emptyQuestion()])
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [savedQuizzes, setSavedQuizzes] = useState([])
  
  // Custom Modal State
  const [modalConfig, setModalConfig] = useState({ isOpen: false, type: '', title: '', value: '', onConfirm: null })
  
  // Drag and Drop State
  const [draggedItem, setDraggedItem] = useState(null)

  useEffect(() => {
    fetchSavedQuizzes()
  }, [])

  const fetchSavedQuizzes = async () => {
    try {
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
      const res = await fetch(`${serverUrl}/api/quiz/bank/load`)
      const data = await res.json()
      if (data.success) setSavedQuizzes(data.quizzes)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveToBank = () => {
    setModalConfig({
      isOpen: true,
      type: 'prompt',
      title: 'Save Quiz Template',
      value: '',
      onConfirm: async (title) => {
        if (!title.trim()) return
        try {
          const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
          const res = await fetch(`${serverUrl}/api/quiz/bank/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, questions })
          })
          const data = await res.json()
          if (data.success) {
            setModalConfig({ isOpen: true, type: 'alert', title: 'Quiz saved successfully!', onConfirm: null })
            fetchSavedQuizzes()
          } else {
            setModalConfig({ isOpen: true, type: 'alert', title: 'Error: ' + data.error, onConfirm: null })
          }
        } catch (e) {
          setModalConfig({ isOpen: true, type: 'alert', title: 'Failed to save to bank. Is the server running?', onConfirm: null })
        }
      }
    })
  }

  const handleLoadFromBank = (quiz) => {
    if (!quiz) return;
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: `Load "${quiz.title}"?`,
      onConfirm: () => {
        setQuestions(quiz.questions)
      }
    })
  }

  const handleGenerate = async () => {
    if (!topic.trim()) return setError('Enter a topic to generate questions.')
    setError('')
    setGenerating(true)
    try {
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
      const res = await fetch(`${serverUrl}/api/quiz/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, numQuestions })
      })
      const data = await res.json()
      if (data.success && data.questions) {
        setQuestions(data.questions)
      } else {
        setError(data.error || 'Failed to generate questions')
      }
    } catch (err) {
      setError('Could not connect to AI generator')
    }
    setGenerating(false)
  }

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

  const handleDragStart = (e, qIndex, optIndex) => {
    setDraggedItem({ qIndex, optIndex })
    // e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e) => {
    e.preventDefault() // necessary to allow dropping
  }

  const handleDrop = (e, targetQIndex, targetOptIndex) => {
    e.preventDefault()
    if (!draggedItem) return
    if (draggedItem.qIndex !== targetQIndex) return // Only reorder within the same question
    if (draggedItem.optIndex === targetOptIndex) return

    setQuestions(prev => {
      return prev.map((q, i) => {
        if (i !== targetQIndex) return q
        
        const newOptions = [...q.options]
        const draggedValue = newOptions[draggedItem.optIndex]
        const targetValue = newOptions[targetOptIndex]
        
        newOptions[draggedItem.optIndex] = targetValue
        newOptions[targetOptIndex] = draggedValue

        // Update correctOption letter if it was swapped
        const letters = ['A', 'B', 'C', 'D']
        const correctIndex = letters.indexOf(q.correctOption)
        let newCorrectOption = q.correctOption

        if (correctIndex === draggedItem.optIndex) {
          newCorrectOption = letters[targetOptIndex]
        } else if (correctIndex === targetOptIndex) {
          newCorrectOption = letters[draggedItem.optIndex]
        }

        return { ...q, options: newOptions, correctOption: newCorrectOption }
      })
    })
    setDraggedItem(null)
  }

  const addQuestion = () => setQuestions((prev) => [...prev, emptyQuestion()])
  const removeQuestion = (index) => setQuestions((prev) => prev.filter((_, i) => i !== index))

  const handleCreate = async () => {
    setError('')
    if (!hostName.trim()) return setError('Enter your name.')
    
    const formattedQuestions = questions.map(q => ({
      ...q,
      timeLimit: parseInt(q.timeLimit) || 20
    }))

    for (const q of formattedQuestions) {
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
        body: JSON.stringify({ hostName, mode, questions: formattedQuestions })
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
      {/* Quiz Bank Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)' }}>Create Quiz</h1>
        <div style={{ display: 'flex', gap: 12 }}>
          {savedQuizzes.length > 0 && (
            <select className="base-input" onChange={(e) => handleLoadFromBank(savedQuizzes[e.target.value])} style={{ padding: '8px 12px', width: 'auto' }}>
              <option value="">Load from Bank...</option>
              {savedQuizzes.map((q, i) => <option key={q.id} value={i}>{q.title}</option>)}
            </select>
          )}
          <button className="btn btn-ghost" onClick={handleSaveToBank}>
            <Save size={16} /> Save to Bank
          </button>
        </div>
      </div>

      <div className="panel" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px' }}>
          <h2 className="panel-title">Quiz Details</h2>
          <div className="field">
            <label>Your Name (shown to participants)</label>
            <input value={hostName} onChange={(e) => setHostName(e.target.value)} placeholder="e.g. Nikhil" className="base-input" />
          </div>
          
          {/* Feature 2: Premium Game Modes UI */}
          <div className="field">
            <label>Game Mode</label>
            <div className="mode-cards-grid">
              {[
                { id: 'Classic', icon: '🎯', desc: 'Standard rules and timing.' },
                { id: 'Rapid Fire', icon: '⚡', desc: 'Half time, double pressure.' },
                { id: 'Survival', icon: '💀', desc: 'One wrong answer = eliminated.' }
              ].map(m => (
                <div 
                  key={m.id} 
                  className={`mode-card ${mode === m.id ? 'active' : ''}`}
                  onClick={() => setMode(m.id)}
                >
                  <div className="mode-card-icon">{m.icon}</div>
                  <div className="mode-card-title">{m.id}</div>
                  <div className="mode-card-desc">{m.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Feature 1: Dynamic AI Generator */}
        <div style={{ flex: '1 1 300px', background: 'var(--bg-secondary)', padding: '20px', borderRadius: 'var(--radius-md)' }}>
          <h3 style={{ marginTop: 0, fontFamily: 'var(--font-display)' }}>✨ Auto-Generate with AI</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Instantly generate trivia questions!</p>
          <div className="field">
            <label>Topic</label>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. JavaScript Basics" className="base-input" />
          </div>
          <div className="field" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label>Count (Max 20)</label>
              <input type="number" min="1" max="20" value={numQuestions} onChange={(e) => setNumQuestions(e.target.value)} className="base-input" />
            </div>
            <button className="btn btn-primary" onClick={handleGenerate} disabled={generating} style={{ height: '49px' }}>
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
      </div>

      {questions.map((q, qIndex) => (
        <div className="question-card" key={qIndex}>
          <div className="question-card-header">
            <span className="question-number">QUESTION {qIndex + 1}</span>
            {questions.length > 1 && (
              <button className="btn btn-ghost" onClick={() => removeQuestion(qIndex)} style={{ padding: '8px 12px', color: 'var(--incorrect)' }}>
                <Trash2 size={16} />
              </button>
            )}
          </div>

          <div className="field">
            <input
              className="base-input"
              placeholder="Question text"
              value={q.questionText}
              onChange={(e) => updateQuestion(qIndex, { questionText: e.target.value })}
            />
          </div>

          <div className="options-drag-container">
            {['A', 'B', 'C', 'D'].map((letter, optIndex) => (
              <div 
                className="option-row draggable-option" 
                key={letter}
                draggable
                onDragStart={(e) => handleDragStart(e, qIndex, optIndex)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, qIndex, optIndex)}
              >
                <div className="drag-handle"><GripVertical size={16} /></div>
                <input
                  type="radio"
                  name={`correct-${qIndex}`}
                  checked={q.correctOption === letter}
                  onChange={() => updateQuestion(qIndex, { correctOption: letter })}
                  title="Mark as correct answer"
                  className="correct-radio"
                />
                <input
                  type="text"
                  className="base-input"
                  placeholder={`Option ${letter}`}
                  value={q.options[optIndex]}
                  onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
                  style={{ 
                    borderColor: q.correctOption === letter ? 'var(--correct)' : 'var(--panel-border)',
                    boxShadow: q.correctOption === letter ? '0 0 0 1px var(--correct)' : 'none'
                  }}
                />
              </div>
            ))}
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <label>Time limit (seconds)</label>
            <input
              type="number"
              min="5"
              max="120"
              className="base-input"
              value={q.timeLimit}
              onChange={(e) => updateQuestion(qIndex, { timeLimit: e.target.value })}
              style={{ width: 120 }}
            />
          </div>
        </div>
      ))}

      <button className="btn btn-ghost btn-block" onClick={addQuestion} style={{ marginBottom: 24, borderStyle: 'dashed' }}>
        <PlusCircle size={18} /> Add another question
      </button>

      {error && <p className="error-text">{error}</p>}

      <button className="btn btn-primary btn-block btn-lg" onClick={handleCreate} disabled={creating}>
        {creating ? 'Creating room…' : 'Create Room'} <ArrowRight size={20} />
      </button>

      {/* Custom Modal Overlay */}
      {modalConfig.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginTop: 0 }}>{modalConfig.title}</h3>
            {modalConfig.type === 'prompt' && (
              <input
                className="base-input"
                autoFocus
                value={modalConfig.value}
                onChange={(e) => setModalConfig({ ...modalConfig, value: e.target.value })}
                placeholder="Type here..."
                style={{ marginBottom: 16 }}
              />
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              {modalConfig.type !== 'alert' && (
                <button className="btn btn-ghost" onClick={() => setModalConfig({ isOpen: false, type: '', title: '', value: '', onConfirm: null })}>
                  Cancel
                </button>
              )}
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  if (modalConfig.onConfirm) modalConfig.onConfirm(modalConfig.value)
                  if (modalConfig.type !== 'prompt' || modalConfig.value.trim()) {
                    setModalConfig({ isOpen: false, type: '', title: '', value: '', onConfirm: null })
                  }
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HostCreate
