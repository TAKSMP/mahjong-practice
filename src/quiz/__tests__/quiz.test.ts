import { describe, expect, it } from 'vitest'
import { analyzeDiscards, analyzeSafety, analyzeScore, analyzeWait, bestEfficiency, shantenOfHand } from '../analyze'
import { CATEGORIES, PATTERNS, QUESTIONS, PATTERN_BY_ID } from '../index'
import { kindLabel, kindsToCounts, parseKinds } from '../../engine/tiles'
import type { QuestionData } from '../types'

/** 問題に出てくる牌をすべて集めて、同じ牌が5枚以上ないか調べる */
function tilesOf(q: QuestionData): string[] {
  const out: string[] = []
  if (q.sit?.dora) out.push(q.sit.dora)
  for (const r of q.show ?? []) out.push(r.tiles)
  for (const m of 'melds' in q ? (q.melds ?? []) : []) out.push(m.k)
  switch (q.type) {
    case 'discard':
      out.push(q.hand)
      break
    case 'wait':
      out.push(q.hand)
      break
    case 'safe':
      out.push(q.hand, q.river, q.seen ?? '')
      break
    case 'score':
      out.push(q.win.closed, q.win.dora ?? '')
      for (const m of q.win.melds ?? []) out.push(m.k)
      break
    case 'choice':
      break
  }
  return out
}

const kinds = (s: string) => new Set(parseKinds(s))
const label = (ks: Iterable<number>) => [...ks].map(kindLabel).sort().join(',')

describe('問題集の全体', () => {
  it('100問あり、idが重複しない', () => {
    expect(QUESTIONS.length).toBe(100)
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(100)
  })

  it('すべての問題が、存在する型に属している', () => {
    for (const q of QUESTIONS) expect(PATTERN_BY_ID[q.pattern], q.id).toBeTruthy()
  })

  it('すべての型に問題が1問以上ある', () => {
    for (const p of PATTERNS) expect(QUESTIONS.some((q) => q.pattern === p.id), p.id).toBe(true)
  })

  it('すべての分野に問題がある', () => {
    for (const c of CATEGORIES) expect(QUESTIONS.some((q) => PATTERN_BY_ID[q.pattern].cat === c.id), c.id).toBe(true)
  })

  it('文章が入っている', () => {
    for (const q of QUESTIONS) {
      expect(q.prompt.length, q.id).toBeGreaterThan(2)
      expect(q.why.length, q.id).toBeGreaterThan(10)
    }
  })

  it('同じ牌が5枚以上出てくる問題がない', () => {
    for (const q of QUESTIONS) {
      const c = kindsToCounts(tilesOf(q).flatMap((s) => parseKinds(s)))
      c.forEach((n, k) => expect(n, `${q.id} ${kindLabel(k)}`).toBeLessThanOrEqual(4))
    }
  })
})

describe('何切る：正解がエンジンの計算と合っている', () => {
  for (const q of QUESTIONS) {
    if (q.type !== 'discard') continue
    it(q.id, () => {
      const mc = q.melds?.length ?? 0
      expect(parseKinds(q.hand).length, `${q.id} 手牌の枚数`).toBe(14 - mc * 3)
      const rows = analyzeDiscards(q)
      const ans = kinds(q.answers)
      const acc = kinds(q.accept ?? '')
      const handKinds = kinds(q.hand)
      for (const k of [...ans, ...acc]) expect(handKinds.has(k), `${q.id} 手牌にない牌 ${kindLabel(k)}`).toBe(true)
      expect(ans.size, q.id).toBeGreaterThan(0)
      if (q.check === 'eff') {
        const best = new Set(bestEfficiency(rows))
        for (const k of [...ans, ...acc]) expect(best.has(k), `${q.id}: ${kindLabel(k)} は最大の受け入れではない（最善: ${label(best)}）`).toBe(true)
      } else if (q.check === 'shanten') {
        for (const k of ans) expect(rows.find((r) => r.kind === k)!.shanten, q.id).toBe(rows[0].shanten)
      }
    })
  }
})

describe('待ち：正解がエンジンの計算と合っている', () => {
  for (const q of QUESTIONS) {
    if (q.type !== 'wait') continue
    it(q.id, () => {
      const mc = q.melds?.length ?? 0
      expect(parseKinds(q.hand).length, `${q.id} 手牌の枚数`).toBe(13 - mc * 3)
      const { waits } = analyzeWait(q)
      expect(label(waits.map((w) => w.kind)), q.id).toBe(label(kinds(q.answers)))
      const opts = kinds(q.options)
      for (const w of waits) expect(opts.has(w.kind), `${q.id} 選択肢にない待ち ${kindLabel(w.kind)}`).toBe(true)
      expect(opts.size, q.id).toBeGreaterThanOrEqual(4)
    })
  }
})

describe('安全牌：正解がもっとも安全な牌になっている', () => {
  for (const q of QUESTIONS) {
    if (q.type !== 'safe') continue
    it(q.id, () => {
      expect(parseKinds(q.hand).length, q.id).toBe(14)
      const rows = analyzeSafety(q)
      const min = rows[0].risk
      const safest = new Set(rows.filter((r) => r.risk === min).map((r) => r.kind))
      for (const k of [...kinds(q.answers), ...kinds(q.accept ?? '')]) {
        expect(safest.has(k), `${q.id}: ${kindLabel(k)} は最も安全ではない（最も安全: ${label(safest)}）`).toBe(true)
      }
      expect(kinds(q.answers).size, q.id).toBeGreaterThan(0)
    })
  }
})

describe('点数：選択肢の正解がエンジンの計算と合っている', () => {
  for (const q of QUESTIONS) {
    if (q.type !== 'score') continue
    it(q.id, () => {
      const info = analyzeScore(q)
      expect(info, `${q.id} 和了形ではない／役がない`).not.toBeNull()
      expect(info!.answer, q.id).toBe(q.expect)
      // 赤ドラ（0の牌）の数と、aka の数が合っている
      const reds = (q.win.closed + (q.win.melds ?? []).map((m) => m.k).join('')).split('').filter((c) => c === '0').length
      expect(q.win.aka ?? 0, `${q.id} 赤の数`).toBe(reds)
      expect(q.options[q.answer], q.id).toBe(q.expect)
      expect(new Set(q.options).size, q.id).toBe(q.options.length)
    })
  }
})

describe('選択問題：裏づけの数字が合っている', () => {
  for (const q of QUESTIONS) {
    if (q.type !== 'choice') continue
    it(q.id, () => {
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(2)
      expect(new Set(q.options).size, q.id).toBe(q.options.length)
      expect(q.answer, q.id).toBeGreaterThanOrEqual(0)
      expect(q.answer, q.id).toBeLessThan(q.options.length)
      for (const f of q.facts ?? []) {
        expect(shantenOfHand(f.hand, f.melds ?? 0), `${q.id} ${f.label}`).toBe(f.expect)
      }
      const v = q.verify
      if (v?.kind === 'furiten') {
        expect(analyzeWait({ hand: v.hand, river: v.river }).furiten, q.id).toBe(v.expect)
      } else if (v?.kind === 'remaining') {
        const w = analyzeWait({ hand: v.hand, show: [{ label: '', tiles: v.visible }] })
        expect(w.waits.reduce((a, x) => a + x.remaining, 0), q.id).toBe(v.expect)
      } else if (v?.kind === 'danger') {
        const rows = analyzeSafety({ river: v.river, hand: v.hand, seen: v.seen })
        const cand = parseKinds(v.candidates)
        const risk = (k: number) => rows.find((r) => r.kind === k)!.risk
        const maxRisk = Math.max(...cand.map(risk))
        expect(cand.filter((k) => risk(k) === maxRisk).map(kindLabel), q.id).toEqual([kindLabel(parseKinds(v.highest)[0])])
        expect(q.options.length, q.id).toBe(cand.length)
        expect(cand.indexOf(parseKinds(v.highest)[0]), q.id).toBe(q.answer)
      }
    })
  }
})

describe('採点と進み具合', () => {
  it('手牌を理牌して、最後の1枚（ツモ牌）はそのまま右端に置く', async () => {
    const { arrangeHand } = await import('../util')
    const s = arrangeHand('3m1p5m2p9m').map((t) => kindLabel(t.kind)).join(' ')
    expect(s).toBe('3萬 5萬 1筒 2筒 9萬')
    // 3枚（ツモ牌なし）は全部並べ替える。同じ牌なら赤が先
    const t = arrangeHand('5p6p0p').map((x) => `${x.kind}${x.red ? 'r' : ''}`)
    expect(t).toEqual(['13r', '13', '14'])
  })

  it('赤と普通の同じ牌が手にあるときだけ、赤かどうかを区別して採点する', async () => {
    const { gradePick } = await import('../util')
    const base = { type: 'discard', pattern: 'A7', prompt: 'x', why: 'xxxxxxxxxxxx', check: 'none' } as const
    // 赤5筒と普通の5筒の両方がある：普通の5筒を切るのが正解
    const q = { ...base, hand: '2m3m4m0p5p6p7p8p9p1s2s3s4s5s', answers: '5p' }
    // arrangeHand は最後の1枚をそのままにする：手牌は 2m3m4m 0p 5p 6p 7p 8p 9p 1s 2s 3s 4s | 5s
    expect(gradePick(q, 3)).toBe('ng') // 赤5筒
    expect(gradePick(q, 4)).toBe('ok') // 普通の5筒
    // 赤だけを持っているときは、赤でも正解
    const q2 = { ...base, hand: '2m3m4m0p6p7p8p9p1s2s3s4s5s6s', answers: '5p' }
    expect(gradePick(q2, 3)).toBe('ok')
  })

  it('待ち当ては、完全に一致したときだけ正解', async () => {
    const { gradeWait } = await import('../util')
    const q = QUESTIONS.find((x) => x.id === 'B1-1')!
    if (q.type !== 'wait') throw new Error('B1-1 is not a wait question')
    expect(gradeWait(q, parseKinds('3m6m'))).toBe('ok')
    expect(gradeWait(q, parseKinds('3m'))).toBe('ng')
    expect(gradeWait(q, parseKinds('3m6m9m'))).toBe('ng')
  })

  it('進み具合：2回続けて正解で「覚えた」、間違えると連続がもどる', async () => {
    const { EMPTY_QUIZ, isMastered, markOf, recordAnswer, summarize, weakIds } = await import('../progress')
    let p = structuredClone(EMPTY_QUIZ)
    expect(markOf(p, 'A1-1')).toBe('new')
    p = recordAnswer(p, 'A1-1', true, 1)
    expect(isMastered(p.q['A1-1'])).toBe(false)
    expect(markOf(p, 'A1-1')).toBe('ok')
    p = recordAnswer(p, 'A1-1', true, 2)
    expect(isMastered(p.q['A1-1'])).toBe(true)
    expect(markOf(p, 'A1-1')).toBe('mastered')
    p = recordAnswer(p, 'A1-1', false, 3)
    expect(p.q['A1-1'].streak).toBe(0)
    expect(markOf(p, 'A1-1')).toBe('ng')
    p = recordAnswer(p, 'A1-2', false, 4)
    p = recordAnswer(p, 'A1-3', true, 5)
    expect(weakIds(p, ['A1-1', 'A1-2', 'A1-3', 'A2-1']).sort()).toEqual(['A1-1', 'A1-2'])
    const s = summarize(p, ['A1-1', 'A1-2', 'A1-3', 'A2-1'])
    expect(s).toMatchObject({ total: 4, answered: 3, mastered: 0, attempts: 5, correct: 3 })
  })
})

describe('型の数', () => {
  it('分野ごとの問題数と型の数', () => {
    expect(PATTERNS.length).toBe(40)
    const count = (c: string) => QUESTIONS.filter((q) => PATTERN_BY_ID[q.pattern].cat === c).length
    expect(['A', 'B', 'C', 'D', 'E', 'F'].map(count)).toEqual([26, 16, 18, 14, 14, 12])
  })
})
