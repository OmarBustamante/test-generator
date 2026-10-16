import { useState } from 'react'
import Upload from './components/Upload'
import type { ExamResult } from './types/exam'

function App() {
  const [exam, setExam] = useState<ExamResult | null>(null)

  return (
    <div>
      <h1>Test Generator</h1>

      {!exam && (
        <Upload onExamGenerated={setExam} />
      )}

      {exam && (
        <div>
          {/* Exam component goes here */}
          <p>{exam.num_questions} preguntas generadas</p>
          <button onClick={() => setExam(null)}>Generar otro examen</button>
        </div>
      )}
    </div>
  )
}

export default App
