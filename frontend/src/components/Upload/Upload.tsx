import { useState, useRef, type ChangeEvent, type DragEvent } from 'react'
import type { ExamResult } from '../../types/exam'
import './Upload.css'

type UploadStatus = 'idle' | 'generating' | 'error'

type Props = {
  onExamGenerated: (exam: ExamResult) => void
}

const ACCEPTED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
}

const API_URL = 'http://localhost:3000/generate'

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
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [error, setError] = useState<string>('')
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── File selection ────────────────────────────────────────────────────
  function selectFile(selected: File) {
    if (!ACCEPTED_TYPES[selected.type]) {
      setError('Solo se aceptan archivos PDF, DOCX o TXT.')
      return
    }
    setError('')
    setStatus('idle')
    setFile(selected)
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

  function handleReset() {
    setFile(null)
    setStatus('idle')
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  // ── Generate exam ─────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!file) return

    setStatus('generating')
    setError('')

    try {
      const fileType = ACCEPTED_TYPES[file.type]
      const fileContent = await fileToBase64(file)

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_content: fileContent,
          file_type: fileType,
          num_options: 4,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al generar el examen.')
      }

      // Notify parent — Upload's job is done
      onExamGenerated(data)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.')
      setStatus('error')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="upload-container">

      {/* Drop zone — only shown when no file is selected */}
      {!file && (
        <div
          className={`upload-dropzone ${isDragging ? 'upload-dropzone--dragging' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Área para subir archivo. Haz clic o arrastra un archivo."
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
          <p className="upload-dropzone__hint">Arrastra tu archivo aquí o haz clic para seleccionar</p>
          <p className="upload-dropzone__types">PDF · DOCX · TXT</p>
        </div>
      )}

      {/* File info */}
      {file && (
        <div className="upload-file-info">
          <p className="upload-file-info__name">{file.name}</p>
          <p className="upload-file-info__meta">
            {(file.size / 1024).toFixed(1)} KB · {ACCEPTED_TYPES[file.type].toUpperCase()}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="upload-error" role="alert">{error}</p>
      )}

      {/* Generating state */}
      {status === 'generating' && (
        <p className="upload-generating" aria-live="polite">Generando examen...</p>
      )}

      {/* Actions */}
      {file && status !== 'generating' && (
        <div className="upload-actions">
          <button className="btn-primary" onClick={handleGenerate}>
            Generar examen
          </button>
          <button className="btn-secondary" onClick={handleReset}>
            Cambiar archivo
          </button>
        </div>
      )}

    </div>
  )
}

export default Upload
