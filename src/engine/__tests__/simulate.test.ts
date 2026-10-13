import { describe, expect, it } from 'vitest'
import { autoStep } from '../controller'
import { checkTileConservation, createGame, nextRound } from '../game'
import { DEFAULT_RULES, RULE_PRESETS } from '../rules'
import type { CpuLevel } from '../ai'
import { beforeHints, discardFeedback } from '../advisor'
import { estimateAims } from '../aim'

function playGame(seed: number, level: CpuLevel, rules = DEFAULT_RULES, checkHints = false, checkAim = false) {
  const s = createGame(rules, seed)
  let steps = 0
  const stats = { rounds: 0, wins: 0, draws: 0, aborts: 0, yakuman: 0, calls: 0 }
  while (true) {
    if (checkHints && s.phase.type === 'action' && steps % 7 === 0 && !s.players[s.turn].riichi) {
      const seat = s.turn
      const h = beforeHints(s, seat)
      const legal = [...h.tiles.values()].filter((t) => !t.eval.forbidden)
      const minSh = Math.min(...legal.map((t) => t.eval.shanten))
      // 14枚のシャンテン数 = 1枚切った後の最小シャンテン数
      expect(Math.max(h.currentShanten, 0)).toBe(minSh)
      const fb = discardFeedback(s, seat, legal[0].eval.tile, false)
      expect(fb.lines.length).toBeGreaterThan(0)
    }
    if (checkAim && s.phase.type === 'action' && steps % 9 === 0) {
      // 鳴き・立直・カンなど、いろいろな局面で「狙える役」を計算しても壊れない
      const snap = estimateAims(s, s.turn, 6)
      for (const row of snap.rows) {
        expect(row.prob).not.toBeNull()
        expect(row.prob!).toBeGreaterThanOrEqual(0)
        expect(row.prob!).toBeLessThanOrEqual(1)
        expect(row.dist).toBeGreaterThanOrEqual(-1)
      }
    }
    const r = autoStep(s, level, [])
    steps++
    if (steps > 200000) throw new Error('too many steps')
    if (s.phase.type !== 'roundEnd' && s.phase.type !== 'gameEnd') {
      checkTileConservation(s)
    }
    if (r === 'roundEnd') {
      stats.rounds++
      const res = s.roundResult!
      if (res.type === 'win') stats.wins++
      else if (res.type === 'draw') stats.draws++
      else stats.aborts++
      if (res.wins.some((w) => w.result.yakuman > 0)) stats.yakuman++
      const total = s.players.reduce((a, p) => a + p.score, 0) + s.riichiSticks * 1000
      expect(total).toBe(rules.startPoints * 4)
      // 和了者の点数の整合性
      for (const w of res.wins) {
        expect(w.result.yaku.length).toBeGreaterThan(0)
        expect(w.hand.length + w.melds.length * 3).toBe(14)
      }
      nextRound(s)
      continue
    }
    if (r === 'gameEnd') break
  }
  const f = s.final!
  expect(f.points.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 5)
  return stats
}

describe('CPU同士の対局シミュレーション', () => {
  it('ふつう × 40半荘', () => {
    const total = { rounds: 0, wins: 0, draws: 0, aborts: 0, yakuman: 0, calls: 0 }
    for (let i = 0; i < 40; i++) {
      const st = playGame(1000 + i, 'normal')
      for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += st[k]
    }
    console.log('normal', total)
    expect(total.rounds).toBeGreaterThan(200)
  }, 120000)
  it('つよい／よわい／各プリセット', () => {
    for (let i = 0; i < 10; i++) playGame(2000 + i, 'strong', DEFAULT_RULES, i < 3, i < 4)
    for (let i = 0; i < 10; i++) playGame(3000 + i, 'weak')
    for (const p of RULE_PRESETS) for (let i = 0; i < 5; i++) playGame(4000 + i, 'normal', p.rules)
  }, 120000)
})
