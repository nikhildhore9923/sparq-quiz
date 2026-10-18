import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../AuthContext'
import { 
  PlusCircle, 
  Trash2, 
  ArrowRight, 
  Save, 
  GripVertical, 
  Sparkles, 
  CheckCircle, 
  AlertCircle,
  HelpCircle,
  Clock
} from 'lucide-react'

const TOPIC_PRESETS = [
  '💻 JavaScript & Web Dev',
  '🌍 World Geography & Capitals',
  '🎬 Cinema & Hollywood',
  '🚀 Astronomy & Space',
  '⚔️ Ancient World History',
  '🧠 Brain Teasers & Logic'
]

const OPTION_LETTERS = ['A', 'B', 'C', 'D']
const OPTION_SHAPES = {
  A: '▲',
  B: '◆',
  C: '●',
  D: '■'
}
const OPTION_BADGE_CLASSES = {
  A: 'opt-a',
  B: 'opt-b',
  C: 'opt-c',
  D: 'opt-d'
}

const emptyQuestion = () => ({
  questionText: '',
  options: ['', '', '', ''],
  correctOption: 'A',
  timeLimit: 20,
})

function HostCreate() {
  const navigate = useNavigate()
  const { token, username } = useContext(AuthContext)
  
  const [hostName, setHostName] = useState(username || '')
  const [mode, setMode] = useState('Classic')
  const [topic, setTopic] = useState('')
  const [numQuestions, setNumQuestions] = useState(5)
  const [globalTimeLimit, setGlobalTimeLimit] = useState(20)
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
    if (!token) return
    try {
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'
      const res = await fetch(`${serverUrl}/api/quiz/bank/load`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) setSavedQuizzes(data.quizzes)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveToBank = () => {
    if (!token) {
      setModalConfig({ 
        isOpen: true, 
        type: 'alert', 
        title: 'Please log in to your Host Account to save quizzes to your private bank!', 
        onConfirm: null 
      })
      return
    }
    setModalConfig({
      isOpen: true,
      type: 'prompt',
      title: 'Save Quiz Template Title',
      value: topic || `Quiz by ${hostName || 'Host'}`,
      onConfirm: async (title) => {
        if (!title.trim()) return
        try {
          const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'
          const res = await fetch(`${serverUrl}/api/quiz/bank/save`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ title, questions })
          })
          const data = await res.json()
          if (data.success) {
            setModalConfig({ isOpen: true, type: 'alert', title: 'Quiz template saved successfully to your bank!', onConfirm: null })
            fetchSavedQuizzes()
          } else {
            setModalConfig({ isOpen: true, type: 'alert', title: 'Error: ' + data.error, onConfirm: null })
          }
        } catch (e) {
          setModalConfig({ isOpen: true, type: 'alert', title: 'Failed to save to bank. Check server connectivity.', onConfirm: null })
        }
      }
    })
  }

  const handleLoadFromBank = (quiz) => {
    if (!quiz) return
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: `Load "${quiz.title}"? This will replace current questions.`,
      onConfirm: () => {
        setQuestions(quiz.questions)
      }
    })
  }

  const handleGenerate = async (presetTopic) => {
    const topicToUse = presetTopic || topic
    if (!topicToUse.trim()) return setError('Please enter or select a topic to generate questions.')
    setError('')
    setGenerating(true)
    try {
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'
      const res = await fetch(`${serverUrl}/api/quiz/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          topic: topicToUse, 
          numQuestions: Number(numQuestions) || 5, 
          globalTimeLimit: Number(globalTimeLimit) || 20 
        })
      })
      const data = await res.json()
      if (data.success && data.questions) {
        setQuestions(data.questions)
        if (presetTopic) setTopic(presetTopic)
      } else {
        setError(data.error || 'Failed to generate questions with AI.')
      }
    } catch (err) {
      setError('Could not connect to AI quiz generator. Please check backend server.')
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
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e, targetQIndex, targetOptIndex) => {
    e.preventDefault()
    if (!draggedItem) return
    if (draggedItem.qIndex !== targetQIndex) return
    if (draggedItem.optIndex === targetOptIndex) return

    setQuestions(prev => {
      return prev.map((q, i) => {
        if (i !== targetQIndex) return q
        
        const newOptions = [...q.options]
        const draggedValue = newOptions[draggedItem.optIndex]
        const targetValue = newOptions[targetOptIndex]
        
        newOptions[draggedItem.optIndex] = targetValue
        newOptions[targetOptIndex] = draggedValue

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
    if (!hostName.trim()) return setError('Please enter your name as host.')
    
    const formattedQuestions = questions.map(q => ({
      ...q,
      timeLimit: parseInt(q.timeLimit) || 20
    }))

    for (let i = 0; i < formattedQuestions.length; i++) {
      const q = formattedQuestions[i]
      if (!q.questionText.trim()) {
        return setError(`Question ${i + 1} is missing question text.`)
      }
      if (q.options.some((o) => !o.trim())) {
        return setError(`Question ${i + 1} must have all 4 options filled out.`)
      }
    }

    setCreating(true)
    try {
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'
      const res = await fetch(`${serverUrl}/api/quiz/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: hostName.trim(), mode, questions: formattedQuestions })
      })
      const data = await res.json()
      
      setCreating(false)
      if (!data.success) {
        if (data.errors) return setError(data.errors.map(e => e.message).join(', '))
        return setError(data.error || 'Failed to create room')
      }
      
      sessionStorage.setItem('hostRoomCode', data.roomCode)
      if (data.hostToken) {
        sessionStorage.setItem(`hostToken_${data.roomCode}`, data.hostToken)
      }
      navigate(`/host/${data.roomCode}`)
    } catch (err) {
      setCreating(false)
      setError('Could not connect to server')
    }
  }

  return (
    <div className="app wide slide-in">
      <button 
        className="btn btn-ghost" 
        onClick={() => navigate('/')} 
        style={{ marginBottom: 20, padding: '8px 12px' }}
      >
        ← Back to Home
      </button>

      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 32 }}>Create Live Quiz</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
            Build custom questions or generate an entire trivia set with AI
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {savedQuizzes.length > 0 && (
            <select 
              className="base-input" 
              onChange={(e) => handleLoadFromBank(savedQuizzes[e.target.value])} 
              style={{ padding: '8px 14px', width: 'auto', fontSize: 13 }}
            >
              <option value="">Load from Bank…</option>
              {savedQuizzes.map((q, i) => (
                <option key={q.id || i} value={i}>{q.title}</option>
              ))}
            </select>
          )}
          <button className="btn btn-ghost btn-sm" onClick={handleSaveToBank} title="Save to private quiz bank">
            <Save size={15} /> Save to Bank
          </button>
        </div>
      </div>

      {/* Main Settings Panel */}
      <div className="panel" style={{ marginBottom: 28, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 32 }}>
        {/* Left Column: Host & Game Mode */}
        <div>
          <h2 className="panel-title" style={{ fontSize: 18, marginBottom: 16 }}>Quiz Configuration</h2>
          <div className="field">
            <label>Host Name (visible to players)</label>
            <input 
              value={hostName} 
              onChange={(e) => setHostName(e.target.value)} 
              placeholder="e.g. Professor Smith" 
              className="base-input" 
            />
          </div>
          
          <div className="field">
            <label>Game Mode</label>
            <div className="mode-cards-grid">
              {[
                { id: 'Classic', icon: '🎯', desc: 'Standard rules and timing with streak bonuses.' },
                { id: 'Rapid Fire', icon: '⚡', desc: 'Half time, high pressure, instant reactions.' },
                { id: 'Survival', icon: '💀', desc: 'Single elimination: one wrong answer knocks you out.' }
              ].map(m => (
                <div 
                  key={m.id} 
                  className={`mode-card ${mode === m.id ? 'active' : ''}`}
                  onClick={() => setMode(m.id)}
                >
                  <div className="mode-card-icon">{m.icon}</div>
                  <div>
                    <div className="mode-card-title">{m.id}</div>
                    <div className="mode-card-desc">{m.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: AI Generator */}
        <div style={{ background: 'var(--bg-secondary)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--panel-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Sparkles size={20} color="var(--accent)" />
            <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 18 }}>Instant AI Generator</h3>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Powered by Groq AI — generate tailored, 4-option trivia in seconds!
          </p>

          <div className="field">
            <label>Topic</label>
            <input 
              value={topic} 
              onChange={(e) => setTopic(e.target.value)} 
              placeholder="e.g. JavaScript, Space Exploration, World History" 
              className="base-input" 
            />
            {/* Topic Preset Chips */}
            <div className="topic-presets-container">
              {TOPIC_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p}
                  className="topic-chip"
                  onClick={() => handleGenerate(p)}
                  disabled={generating}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Time limit (sec)
              </label>
              <input 
                type="number" 
                min="5" 
                max="120" 
                value={globalTimeLimit} 
                onChange={(e) => setGlobalTimeLimit(e.target.value)} 
                className="base-input" 
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Question count
              </label>
              <input 
                type="number" 
                min="1" 
                max="15"
                value={numQuestions} 
                onChange={(e) => setNumQuestions(e.target.value)} 
                className="base-input" 
              />
            </div>
          </div>

          <button 
            type="button"
            className="btn btn-primary btn-block" 
            onClick={() => handleGenerate()} 
            disabled={generating || !topic.trim()}
          >
            {generating ? (
              <>
                <Sparkles size={16} className="slide-in" /> Generating Trivia…
              </>
            ) : (
              <>
                <Sparkles size={16} /> Generate Questions with AI
              </>
            )}
          </button>
        </div>
      </div>

      {/* Questions Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: 0 }}>
          Questions ({questions.length})
        </h2>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Click the radio button to select the correct answer
        </span>
      </div>

      {questions.map((q, qIndex) => (
        <div className="question-card slide-in" key={qIndex}>
          <div className="question-card-header">
            <span className="question-number">QUESTION {qIndex + 1}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                <Clock size={15} />
                <input
                  type="number"
                  min="5"
                  max="120"
                  className="base-input"
                  value={q.timeLimit}
                  onChange={(e) => updateQuestion(qIndex, { timeLimit: e.target.value })}
                  style={{ width: 70, padding: '4px 8px', textAlign: 'center', fontSize: 13 }}
                  title="Time limit in seconds"
                />
                <span>sec</span>
              </div>

              {questions.length > 1 && (
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => removeQuestion(qIndex)} 
                  style={{ color: 'var(--incorrect)' }}
                  title="Remove this question"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="field">
            <input
              className="base-input"
              placeholder={`Enter Question ${qIndex + 1} text…`}
              value={q.questionText}
              onChange={(e) => updateQuestion(qIndex, { questionText: e.target.value })}
              style={{ fontWeight: 600, fontSize: 16 }}
            />
          </div>

          {/* Option rows with drag and drop */}
          <div className="options-drag-container">
            {OPTION_LETTERS.map((letter, optIndex) => {
              const optCls = OPTION_BADGE_CLASSES[letter]
              const isCorrect = q.correctOption === letter

              return (
                <div 
                  className="option-row draggable-option" 
                  key={letter}
                  draggable
                  onDragStart={(e) => handleDragStart(e, qIndex, optIndex)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, qIndex, optIndex)}
                >
                  <div className="drag-handle" title="Drag to reorder options">
                    <GripVertical size={16} />
                  </div>

                  <span className={`option-badge ${optCls}`} style={{ width: 32, height: 32, fontSize: 14 }}>
                    {OPTION_SHAPES[letter]}
                  </span>

                  <input
                    type="text"
                    className="base-input"
                    placeholder={`Option ${letter} text`}
                    value={q.options[optIndex]}
                    onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
                    style={{ 
                      flex: 1,
                      borderColor: isCorrect ? 'var(--correct)' : undefined,
                      boxShadow: isCorrect ? '0 0 0 1px var(--correct)' : undefined,
                      background: isCorrect ? 'var(--correct-bg)' : undefined
                    }}
                  />

                  <label 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      cursor: 'pointer',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: isCorrect ? 'var(--correct-bg)' : 'var(--input-bg)',
                      border: `1px solid ${isCorrect ? 'var(--correct)' : 'var(--panel-border)'}`,
                      color: isCorrect ? 'var(--correct)' : 'var(--text-secondary)',
                      fontSize: 13,
                      fontWeight: 600,
                      userSelect: 'none',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <input
                      type="radio"
                      name={`correct-${qIndex}`}
                      checked={isCorrect}
                      onChange={() => updateQuestion(qIndex, { correctOption: letter })}
                      style={{ accentColor: 'var(--correct)', width: 16, height: 16 }}
                    />
                    {isCorrect ? 'Correct' : 'Mark'}
                  </label>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <button 
        className="btn btn-ghost btn-block" 
        onClick={addQuestion} 
        style={{ marginBottom: 24, borderStyle: 'dashed', padding: '16px' }}
      >
        <PlusCircle size={18} /> Add Another Question
      </button>

      {error && (
        <div className="error-text" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Sticky Bottom Launch Button */}
      <div style={{ position: 'sticky', bottom: 20, zIndex: 50 }}>
        <button 
          className="btn btn-primary btn-block btn-lg" 
          onClick={handleCreate} 
          disabled={creating}
          style={{ boxShadow: 'var(--shadow-lg), 0 0 25px var(--accent-glow)' }}
        >
          {creating ? 'Creating Room & Lobby…' : `Launch Game Room (${questions.length} Questions)`} 
          <ArrowRight size={20} />
        </button>
      </div>

      {/* Custom Modal Overlay */}
      {modalConfig.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginTop: 0, fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 12 }}>
              {modalConfig.title}
            </h3>
            {modalConfig.type === 'prompt' && (
              <input
                className="base-input"
                autoFocus
                value={modalConfig.value}
                onChange={(e) => setModalConfig({ ...modalConfig, value: e.target.value })}
                placeholder="Enter title…"
                style={{ marginBottom: 18 }}
              />
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              {modalConfig.type !== 'alert' && (
                <button 
                  className="btn btn-ghost" 
                  onClick={() => setModalConfig({ isOpen: false, type: '', title: '', value: '', onConfirm: null })}
                >
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
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HostCreate
