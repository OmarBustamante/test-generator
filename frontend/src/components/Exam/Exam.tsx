import { useState } from 'react'
import './Exam.css'
import type { ExamResult } from '../../types/exam'

// "A" → 0, "B" → 1, "C" → 2, etc.
const letterToIndex = (letter: string): number =>
    letter.toUpperCase().charCodeAt(0) - 65

const Exam = ({ exam, onReset }: { exam: ExamResult; onReset: () => void }) => {

    const [results, setResults] = useState<(number | null)[]>(
        Array(exam.questions.length).fill(null)
    )
    const [checked, setChecked] = useState(false)

    const selectAnswer = (questionIndex: number, optionIndex: number) => {
        if (checked) return  // lock answers after checking
        setResults(prev => {
            const updated = [...prev]
            updated[questionIndex] = optionIndex
            return updated
        })
    }

    const checkAnswers = () => setChecked(true)

    // Returns the CSS modifier class for each option button
    const getOptionClass = (questionIndex: number, optionIndex: number): string => {
        if (!checked) {
            // Before checking — only highlight selected
            return results[questionIndex] === optionIndex ? 'question-option--selected' : ''
        }

        const correctIndex = letterToIndex(exam.questions[questionIndex].correct_answer)
        const selectedIndex = results[questionIndex]

        if (optionIndex === correctIndex && selectedIndex === correctIndex) {
            return 'question-option--correct'       // selected AND correct → green
        }
        if (optionIndex === selectedIndex && selectedIndex !== correctIndex) {
            return 'question-option--incorrect'     // selected but wrong → red
        }
        if (optionIndex === correctIndex && selectedIndex !== correctIndex) {
            return 'question-option--reveal'        // correct answer when user got it wrong → yellow
        }
        return ''
    }

    const score = checked
        ? results.filter((selected, i) =>
            selected === letterToIndex(exam.questions[i].correct_answer)
          ).length
        : null

    return (
        <div className='exam-container'>

            <div className='exam-header'>
                <p className='kicker'>Generated exam</p>
                <hr className='rule' />
                <p className='exam-header__meta'>{exam.num_questions} questions</p>
            </div>

            {exam.questions.map((item, index) => (
                <div key={index} className='question-container'>
                    <h3 className='question-text'>
                        <span className='question-number'>{index + 1}.</span> {item.question}
                    </h3>
                    <div className='options-container'>
                        {item.options.map((option, value) => (
                            <button
                                key={value}
                                type="button"
                                className={`question-option ${getOptionClass(index, value)}`}
                                onClick={() => selectAnswer(index, value)}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                </div>
            ))}

            <div className='exam-footer'>
                {!checked && (
                    <button
                        type="button"
                        className='btn-primary'
                        onClick={checkAnswers}
                    >
                        Check answers
                    </button>
                )}

                {checked && score !== null && (
                    <div className='exam-score'>
                        <p className='exam-score__text'>
                            You got <strong>{score}</strong> out of <strong>{exam.num_questions}</strong> correct
                        </p>
                        <button type="button" className='btn-secondary' onClick={onReset}>
                            Generate another exam
                        </button>
                    </div>
                )}
            </div>

        </div>
    )
}

export default Exam