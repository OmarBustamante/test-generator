import { useState } from 'react'
import Upload from './components/Upload/Upload'
import type { ExamResult } from './types/exam'
import Exam from './components/Exam/Exam'
import './App.css'

function App() {
  const [exam, setExam] = useState<ExamResult | null>(null)

  return (
    <div className='app-container'>
      <h1>Test Generator</h1>

      {!exam && (
        <Upload onExamGenerated={setExam} />
      )}

      {exam && (
        <Exam exam={exam} onReset={() => setExam(null)} />
      )}
    </div>
  )
}

export default App
