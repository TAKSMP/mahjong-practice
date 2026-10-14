import { describe, expect, it } from 'vitest'
import { beforeHints, callAdvice, discardFeedback, evalKey } from '../advisor'
import { createGame, type CallOptions, type GameState } from '../game'
import { DEFAULT_RULES } from '../rules'
import { kindOf, parseKinds, type Kind, type Tile } from '../tiles'

const M6 = 5 // 6萬
const S5 = 22 // 5索
const HAKU = 31

/** 自分の手牌（14枚）を作り、相手の河（捨て牌）を指定する */
function setup(hand: string, opp: { riichi?: boolean; discards: Record<number, Kind[]> }): GameState {
  const s = createGame(DEFAULT_RULES, 1)
  s.dealer = 0
  s.roundWind = 0
  const used = new Array(34).fill(0)
  const take = (k: Kind): Tile => k * 4 + used[k]++
  const me = s.players[0]
  me.hand = parseKinds(hand).map(take)
  me.drawn = me.hand[me.hand.length - 1]
  me.discards = []
  me.melds = []
  let seq = 1
  for (const seat of [1, 2, 3]) {
    const p = s.players[seat]
    p.melds = []
    p.riichi = false
    p.discards = (opp.discards[seat] ?? []).map((k) => ({ tile: take(k), tsumogiri: false, riichi: false, calledBy: null, seq: seq++ }))
  }
  if (opp.riichi) {
    s.players[1].riichi = true
    s.players[1].riichiIndex = 0
  }
  s.discardSeq = seq
  s.phase = { type: 'action', afterCall: false }
  s.turn = 0
  return s
}

/** 5索を切ればテンパイ（6筒・9筒待ち）。6萬は雀頭なので、切るとテンパイが崩れる */
const HAND = '234m567p345s66m78p5s'

describe('自分の方針と助言', () => {
  it('リーチを受けているとき：自動と攻めは手を進める牌、守りは現物', () => {
    const s = setup(HAND, { riichi: true, discards: { 1: [M6] } })
    const auto = beforeHints(s, 0, 'auto')
    const attack = beforeHints(s, 0, 'attack')
    const defend = beforeHints(s, 0, 'defend')
    expect(auto.rec.best.kind).toBe(S5)
    expect(attack.rec.best.kind).toBe(S5)
    expect(attack.rec.mode).toBe('attack')
    // 守り：現物の6萬を切る（テンパイは崩れるが、放銃しない事を優先）
    expect(defend.rec.best.kind).toBe(M6)
    expect(defend.rec.mode).toBe('defend')
    expect(defend.rec.best.danger.label).toBe('現物')
    expect(defend.headline).toContain('ローワン')
    expect(defend.headline).toContain('守る')
  })

  it('守りの方針では、手牌の上の表示が危険度になり、危ない牌は×になる', () => {
    const s = setup(HAND, { riichi: true, discards: { 1: [M6] } })
    const defend = beforeHints(s, 0, 'defend')
    const t6m = [...defend.tiles.values()].find((t) => t.eval.kind === M6)!
    const t5s = [...defend.tiles.values()].find((t) => t.eval.kind === S5)!
    expect(t6m.badge).toBe('現')
    expect(t6m.tag).toBe('best')
    expect(t5s.tag).toBe('bad')
    expect(['危', '注']).toContain(t5s.badge)
    // 攻めでは、有効牌の枚数が出る
    const attack = beforeHints(s, 0, 'attack')
    const a5s = [...attack.tiles.values()].find((t) => t.eval.kind === S5)!
    expect(a5s.badge).toMatch(/^\d+$/)
  })

  it('誰もリーチしていなくても、守りの方針なら全員に安全な牌を選ぶ', () => {
    // 6萬は3人全員の現物。白・東は誰も切っていない字牌
    const s = setup('234m567p345s77p6m白東', { discards: { 1: [M6], 2: [M6], 3: [M6] } })
    // 自動（リーチなし）は手を進める：余り牌の字牌を切る
    expect([27, HAKU]).toContain(beforeHints(s, 0, 'auto').rec.best.kind)
    const defend = beforeHints(s, 0, 'defend')
    expect(defend.rec.best.kind).toBe(M6)
    expect(defend.rec.best.danger.label).toBe('現物')
    expect(defend.rec.reason).toContain('現物があるので')
  })

  it('誰もリーチしておらず現物もないときは、危険度は目安だと伝える', () => {
    const s = setup('234m567p345s77p6m白東', { discards: {} })
    const defend = beforeHints(s, 0, 'defend')
    expect(defend.rec.mode).toBe('defend')
    expect(defend.rec.reason).toContain('誰もリーチしていない')
  })

  it('守りの方針では、テンパイでもリーチをすすめない', () => {
    const s = setup('234m567p345s66m78p白', { discards: { 1: [M6] } })
    const auto = beforeHints(s, 0, 'auto')
    expect(auto.actionAdvice.join('')).toContain('リーチできます')
    const defend = beforeHints(s, 0, 'defend')
    expect(defend.actionAdvice.join('')).toContain('リーチはおすすめしません')
  })

  it('打った直後の指摘：守りなら、危険な牌は「危険な一打」', () => {
    const s = setup(HAND, { riichi: true, discards: { 1: [M6] } })
    const t5s = s.players[0].hand.find((t) => kindOf(t) === S5)!
    const t6m = s.players[0].hand.find((t) => kindOf(t) === M6)!
    const bad = discardFeedback(s, 0, t5s, false, 'defend')
    expect(bad.verdict).toBe('bad')
    expect(bad.title).toBe('危険な一打')
    expect(bad.lines.join('')).toContain('現物')
    const good = discardFeedback(s, 0, t6m, false, 'defend')
    expect(good.verdict).toBe('best')
    expect(good.title).toBe('ナイス！安全な一打')
    // 同じ5索でも、攻めの方針なら最善の一打
    expect(discardFeedback(s, 0, t5s, false, 'attack').verdict).toBe('best')
    void evalKey
  })

  it('鳴きの助言：守りなら、いつもスルー', () => {
    const s = setup('234m567p345s66m78p5s', { discards: {} })
    const t = 4 * 4 + 3 // 5萬
    s.phase = { type: 'response', tile: t, from: 3, kakan: false, options: [null, null, null, null], responses: [null, null, null, null] }
    const opts: CallOptions = { ron: false, ronResult: null, pon: [[s.players[0].hand[0], s.players[0].hand[1]]], chi: [], minkan: null }
    const d = callAdvice(s, 0, opts, 'defend')
    expect(d.recommended.type).toBe('pass')
    expect(d.lines.join('')).toContain('守りの方針')
  })
})
