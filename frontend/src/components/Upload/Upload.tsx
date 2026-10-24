import { useState, useRef, type ChangeEvent, type DragEvent } from 'react'
import type { ExamResult } from '../../types/exam'
import './Upload.css'

type UploadStatus = 'idle' | 'analyzing' | 'ready' | 'generating' | 'error'
type Source = 'file' | 'url'

type Props = {
  onExamGenerated: (exam: ExamResult) => void
}

type Analysis = {
  word_count: number
  suggested_questions: number
}

type SourcePayload =
  | { file_content: string; file_type: string }
  | { url: string }

const ACCEPTED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'
const MIN_QUESTIONS = 1
const MAX_QUESTIONS = 30

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const Upload = ({ onExamGenerated }: Props) => {
  const [source, setSource] = useState<Source>('file')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState<string>('')
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [error, setError] = useState<string>('')
  const [isDragging, setIsDragging] = useState(false)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [numQuestions, setNumQuestions] = useState<number>(0)
  const payloadRef = useRef<SourcePayload | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function analyze(payload: SourcePayload) {
    setError('')
    setStatus('analyzing')
    payloadRef.current = payload

    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to analyze the content.')

      setAnalysis(data)
      setNumQuestions(data.suggested_questions)
      setStatus('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.')
      setStatus('error')
    }
  }

  async function selectFile(selected: File) {
    if (!ACCEPTED_TYPES[selected.type]) {
      setError('Only PDF, DOCX, or TXT files are accepted.')
      return
    }
    setFile(selected)
    const fileContent = await fileToBase64(selected)
    analyze({ file_content: fileContent, file_type: ACCEPTED_TYPES[selected.type] })
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) selectFile(e.target.files[0])
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files?.[0]) selectFile(e.dataTransfer.files[0])
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleUrlAnalyze() {
    const trimmed = url.trim()
    if (!trimmed) {
      setError('Please enter a URL.')
      return
    }
    analyze({ url: trimmed })
  }

  function handleReset() {
    setFile(null)
    setUrl('')
    setStatus('idle')
    setError('')
    setAnalysis(null)
    setNumQuestions(0)
    payloadRef.current = null
    if (inputRef.current) inputRef.current.value = ''
  }

  function switchSource(next: Source) {
    if (next === source) return
    setSource(next)
    handleReset()
  }

  function handleQuestionsChange(e: ChangeEvent<HTMLInputElement>) {
    const value = parseInt(e.target.value, 10)
    setNumQuestions(isNaN(value) ? 0 : value)
  }

  async function handleGenerate() {
    if (!payloadRef.current) return

    const clamped = Math.min(Math.max(numQuestions, MIN_QUESTIONS), MAX_QUESTIONS)

    setStatus('generating')
    setError('')

    try {
      const res = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payloadRef.current,
          num_questions: clamped,
          num_options: 4,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate the exam.')

      onExamGenerated(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.')
      setStatus('error')
    }
  }

  const isValidCount = numQuestions >= MIN_QUESTIONS && numQuestions <= MAX_QUESTIONS
  const hasSource = file !== null || url.trim() !== ''

  return (
    <div className="upload-container">

      <div className="upload-tabs">
        <button
          type="button"
          className={`upload-tab ${source === 'file' ? 'upload-tab--active' : ''}`}
          onClick={() => switchSource('file')}
        >
          Upload file
        </button>
        <button
          type="button"
          className={`upload-tab ${source === 'url' ? 'upload-tab--active' : ''}`}
          onClick={() => switchSource('url')}
        >
          From URL
        </button>
      </div>

      {source === 'file' && (
        <>
          {!file && (
            <div
              className={`upload-dropzone ${isDragging ? 'upload-dropzone--dragging' : ''}`}
              role="button"
              tabIndex={0}
              aria-label="File upload area. Click or drag a file."
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleInputChange}
                style={{ display: 'none' }}
                aria-hidden="true"
              />
              <p className="upload-dropzone__hint">Drag your file here or click to select</p>
              <p className="upload-dropzone__types">PDF · DOCX · TXT</p>
            </div>
          )}

          {file && (
            <div className="upload-file-info">
              <p className="upload-file-info__name">{file.name}</p>
              <p className="upload-file-info__meta">
                {(file.size / 1024).toFixed(1)} KB · {ACCEPTED_TYPES[file.type].toUpperCase()}
              </p>
            </div>
          )}
        </>
      )}

      {source === 'url' && status !== 'ready' && status !== 'generating' && (
        <div className="upload-url">
          <label className="upload-config__label" htmlFor="source-url">
            Web page URL
          </label>
          <input
            id="source-url"
            type="url"
            placeholder="https://example.com/article"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUrlAnalyze()}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={handleUrlAnalyze}
            disabled={status === 'analyzing'}
          >
            Analyze page
          </button>
        </div>
      )}

      {source === 'url' && (status === 'ready' || status === 'generating') && (
        <div className="upload-file-info">
          <p className="upload-file-info__name">Web page</p>
          <p className="upload-file-info__meta">{url}</p>
        </div>
      )}

      {status === 'analyzing' && (
        <p className="upload-generating" aria-live="polite">
          {source === 'url' ? 'Fetching and analyzing page...' : 'Analyzing document...'}
        </p>
      )}

      {status === 'ready' && analysis && (
        <div className="upload-config">
          <p className="upload-config__suggestion">
            Content with <strong>{analysis.word_count}</strong> words.
            We suggest <strong>{analysis.suggested_questions}</strong> questions.
          </p>
          <label className="upload-config__label" htmlFor="num-questions">
            Number of questions to generate
          </label>
          <input
            id="num-questions"
            type="number"
            min={MIN_QUESTIONS}
            max={MAX_QUESTIONS}
            value={numQuestions || ''}
            onChange={handleQuestionsChange}
            className="upload-config__input"
          />
          {!isValidCount && (
            <p className="upload-error">
              Choose between {MIN_QUESTIONS} and {MAX_QUESTIONS} questions.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="upload-error" role="alert">{error}</p>
      )}

      {status === 'generating' && (
        <p className="upload-generating" aria-live="polite">Generating exam...</p>
      )}

      {hasSource && (status === 'ready' || status === 'error') && (
        <div className="upload-actions">
          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={!isValidCount || status === 'error'}
          >
            Generate exam
          </button>
          <button className="btn-secondary" onClick={handleReset}>
            {source === 'url' ? 'Change URL' : 'Change file'}
          </button>
        </div>
      )}

    </div>
  )
}

export default Upload
