// 定石クイズの小さな道具：牌の読み取り（赤5つき）、採点

import { parseKinds, type Kind } from '../engine/tiles'
import type { ChoiceQ, DiscardQ, SafeQ, ScoreQ, WaitQ } from './types'

export interface QTile {
  kind: Kind
  /** 赤ドラ（'0m' '0p' '0s' の表記） */
  red: boolean
}

const HONORS = '東南西北白發中'

/** "234m0p東" のような文字列を、赤5を区別して読み取る */
export function parseTiles(s: string): QTile[] {
  const out: QTile[] = []
  let digits = ''
  for (const ch of s) {
    if (ch >= '0' && ch <= '9') {
      digits += ch
      continue
    }
    const si = 'mps'.indexOf(ch)
    if (si >= 0) {
      for (const d of digits) {
        const n = Number(d)
        out.push({ kind: si * 9 + (n === 0 ? 5 : n) - 1, red: n === 0 })
      }
      digits = ''
      continue
    }
    if (ch === 'z') {
      for (const d of digits) out.push({ kind: 27 + Number(d) - 1, red: false })
      digits = ''
      continue
    }
    const hi = HONORS.indexOf(ch)
    if (hi >= 0) out.push({ kind: 27 + hi, red: false })
  }
  return out
}

/** 手牌の並べ方：理牌（萬→筒→索→字）して、最後の1枚（ツモ牌）はそのまま右端に置く */
export function arrangeHand(s: string): QTile[] {
  const list = parseTiles(s)
  const cmp = (a: QTile, b: QTile) => a.kind - b.kind || Number(b.red) - Number(a.red)
  if (list.length % 3 === 2) {
    const draw = list.pop()!
    return [...list.sort(cmp), draw]
  }
  return list.sort(cmp)
}

export type Grade = 'ok' | 'accept' | 'ng'

/** 手牌の中の1枚を選ぶ問題の採点。赤と普通の同じ牌がどちらも手にあるときだけ、赤かどうかを区別する */
export function gradePick(q: DiscardQ | SafeQ, handIndex: number): Grade {
  const hand = arrangeHand(q.hand)
  const pick = hand[handIndex]
  const same = hand.filter((t) => t.kind === pick.kind)
  const split = same.some((t) => t.red) && same.some((t) => !t.red)
  const match = (s: string | undefined) =>
    parseTiles(s ?? '').some((a) => a.kind === pick.kind && (!split || a.red === pick.red))
  if (match(q.answers)) return 'ok'
  if (match(q.accept)) return 'accept'
  return 'ng'
}

/** 待ち当ての採点：選んだ牌が、待ちと完全に一致したら正解 */
export function gradeWait(q: WaitQ, picked: Kind[]): Grade {
  const ans = new Set(parseKinds(q.answers))
  const got = new Set(picked)
  if (ans.size !== got.size) return 'ng'
  for (const k of ans) if (!got.has(k)) return 'ng'
  return 'ok'
}

export function gradeChoice(q: ChoiceQ | ScoreQ, idx: number): Grade {
  return idx === q.answer ? 'ok' : 'ng'
}

export const GRADE_OK = (g: Grade) => g !== 'ng'

/** シャンテン数の表示 */
export function shantenText(n: number): string {
  if (n < 0) return '和了'
  if (n === 0) return 'テンパイ'
  return `${n}シャンテン`
}

export const WIND_JP = ['東', '南', '西', '北']
/** 場風・自風の言い方（東場＝トンバ、南家＝ナンチャ） */
export const WIND_BA = ['トンバ', 'ナンバ']
export const WIND_CHA = ['トンチャ', 'ナンチャ', 'シャーチャ', 'ペーチャ']
