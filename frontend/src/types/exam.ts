export type Question = {
  question: string
  options: string[]
  correct_answer: string
}

export type ExamResult = {
  questions: Question[]
  num_questions: number
  suggested: boolean
}
