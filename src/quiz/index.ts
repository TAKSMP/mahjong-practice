// 定石クイズ 100 問の問題集

import { CATEGORIES, CATEGORY_BY_ID, PATTERNS, PATTERN_BY_ID } from './patterns'
import { CALLS } from './questions/calls'
import { DEFENSE } from './questions/defense'
import { EFFICIENCY } from './questions/efficiency'
import { SCORING } from './questions/scoring'
import { STRATEGY } from './questions/strategy'
import { WAITS } from './questions/waits'
import type { CategoryId, Pattern, Question, QuestionData } from './types'

const RAW: Question[] = [...EFFICIENCY, ...WAITS, ...DEFENSE, ...CALLS, ...SCORING, ...STRATEGY]

/** 型ごとに連番を振って id にする（例: A3-2）。並び順は 分野 → 型 → 出題順 */
function build(): QuestionData[] {
  const order = new Map(PATTERNS.map((p, i) => [p.id, i]))
  const sorted = RAW.map((q, i) => ({ q, i })).sort((a, b) => (order.get(a.q.pattern) ?? 999) - (order.get(b.q.pattern) ?? 999) || a.i - b.i)
  const count: Record<string, number> = {}
  return sorted.map(({ q }) => {
    count[q.pattern] = (count[q.pattern] ?? 0) + 1
    return { ...q, id: `${q.pattern}-${count[q.pattern]}` } as QuestionData
  })
}

export const QUESTIONS: QuestionData[] = build()
export const QUESTION_BY_ID: Record<string, QuestionData> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]))

export function questionsOfPattern(patternId: string): QuestionData[] {
  return QUESTIONS.filter((q) => q.pattern === patternId)
}

export function questionsOfCategory(cat: CategoryId): QuestionData[] {
  return QUESTIONS.filter((q) => PATTERN_BY_ID[q.pattern]?.cat === cat)
}

export function patternsOfCategory(cat: CategoryId): Pattern[] {
  return PATTERNS.filter((p) => p.cat === cat)
}

export { CATEGORIES, CATEGORY_BY_ID, PATTERNS, PATTERN_BY_ID }
