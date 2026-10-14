// 定石クイズの進み具合（ブラウザに保存する）

export interface QRecord {
  /** 正解した回数 */
  c: number
  /** 間違えた回数 */
  w: number
  /** 連続で正解している回数（間違えると0に戻る） */
  streak: number
  /** 直近の結果 1=正解 0=不正解 */
  last: 0 | 1
  /** 最後に答えた時刻 */
  t: number
}

export interface QuizProgress {
  v: 1
  q: Record<string, QRecord>
}

export const EMPTY_QUIZ: QuizProgress = { v: 1, q: {} }

const KEY = 'mj-practice:quiz'

export function loadQuizProgress(): QuizProgress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { v: 1, q: {} }
    const p = JSON.parse(raw) as Partial<QuizProgress>
    if (p && p.v === 1 && p.q && typeof p.q === 'object') return { v: 1, q: p.q }
  } catch {
    // 読み込めないときは、はじめからにする
  }
  return { v: 1, q: {} }
}

export function saveQuizProgress(p: QuizProgress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // 保存できない環境でも遊べるようにする
  }
}

/** 1問の結果を記録した、新しい進み具合を返す */
export function recordAnswer(p: QuizProgress, id: string, correct: boolean, now = Date.now()): QuizProgress {
  const old = p.q[id] ?? { c: 0, w: 0, streak: 0, last: 0 as const, t: 0 }
  const rec: QRecord = correct
    ? { c: old.c + 1, w: old.w, streak: old.streak + 1, last: 1, t: now }
    : { c: old.c, w: old.w + 1, streak: 0, last: 0, t: now }
  return { v: 1, q: { ...p.q, [id]: rec } }
}

/** 2回連続で正解したら「覚えた」とする */
export const MASTER_STREAK = 2
export const isMastered = (r: QRecord | undefined) => !!r && r.streak >= MASTER_STREAK

export interface QuizSummary {
  total: number
  answered: number
  mastered: number
  /** 答えた回数の合計 */
  attempts: number
  correct: number
}

export function summarize(p: QuizProgress, ids: string[]): QuizSummary {
  let answered = 0
  let mastered = 0
  let attempts = 0
  let correct = 0
  for (const id of ids) {
    const r = p.q[id]
    if (!r) continue
    answered++
    if (isMastered(r)) mastered++
    attempts += r.c + r.w
    correct += r.c
  }
  return { total: ids.length, answered, mastered, attempts, correct }
}

/** 復習が必要な問題：一度でも間違えて、まだ覚えていない（直近が不正解、または連続正解が足りない） */
export function weakIds(p: QuizProgress, ids: string[]): string[] {
  return ids.filter((id) => {
    const r = p.q[id]
    return !!r && r.w > 0 && !isMastered(r)
  })
}

export type Mark = 'new' | 'ng' | 'ok' | 'mastered'

/** 問題の状態を表す印（一覧の色分け用） */
export function markOf(p: QuizProgress, id: string): Mark {
  const r = p.q[id]
  if (!r) return 'new'
  if (isMastered(r)) return 'mastered'
  return r.last === 1 ? 'ok' : 'ng'
}
