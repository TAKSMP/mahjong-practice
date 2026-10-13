import { describe, expect, it } from 'vitest'
import { estimateAims, type AimRow } from '../aim'
import { createGame, type GameState, type Meld } from '../game'
import { DEFAULT_RULES } from '../rules'
import { parseKinds, type Kind } from '../tiles'

/** 手牌（例: '234m567p'）と副露から、テスト用の対局状態を作る。自分は南家（seat 0 は親から数えて…）に関係なく東場 */
function makeState(
  hand: string,
  opt: { melds?: { type: Meld['type']; kinds: Kind[] }[]; live?: number; rules?: Partial<typeof DEFAULT_RULES> } = {},
): GameState {
  const s = createGame({ ...DEFAULT_RULES, ...opt.rules }, 1)
  s.dealer = 0
  s.roundWind = 0
  const used = new Array(34).fill(0)
  const take = (k: Kind) => k * 4 + used[k]++
  const p = s.players[0]
  p.hand = parseKinds(hand).map(take)
  p.discards = []
  p.melds = (opt.melds ?? []).map((m) => ({ type: m.type, tiles: m.kinds.map(take) }))
  p.drawn = p.hand.length % 3 === 2 ? p.hand[p.hand.length - 1] : null
  for (const q of s.players.slice(1)) {
    q.discards = []
    q.melds = []
  }
  s.drawIndex = 122 - (opt.live ?? 50)
  s.doraRevealed = 1
  return s
}

const row = (rows: AimRow[], key: string) => rows.find((r) => r.key === key)

describe('狙える役の一覧', () => {
  it('テンパイの断么九は高い見込みになる', () => {
    const s = makeState('234m567p345s66m77p', { live: 50 })
    const { rows } = estimateAims(s, 0, 150)
    const t = row(rows, 'tanyao')!
    expect(t.dist).toBe(0)
    expect(t.prob!).toBeGreaterThan(0.5)
    expect(t.prob!).toBeLessThanOrEqual(1)
    // 立直もテンパイなので同じくらい高い
    expect(row(rows, 'riichi')!.dist).toBe(0)
    // 待ちは 6萬（残り2）・4筒（残り4）・7筒（残り1）
    expect(t.needed.map((n) => n.kind).sort((a, b) => a - b)).toEqual([5, 12, 15])
    expect(t.neededTotal).toBe(7)
  })

  it('么九牌だらけの手では断么九は出ない', () => {
    const s = makeState('19m19p19s1234567z', { live: 50 })
    const { rows } = estimateAims(s, 0, 60)
    expect(row(rows, 'tanyao')).toBeUndefined()
    expect(row(rows, 'kokushi')!.dist).toBe(0)
  })

  it('役牌の対子があれば役牌が出て、ポンも見込みに入る', () => {
    const s = makeState('123m456p789s55m中中', { live: 50 })
    const { rows } = estimateAims(s, 0, 150)
    const r = row(rows, 'yakuhai-33')!
    expect(r.label).toBe('役牌 中')
    expect(r.dist).toBe(0)
    expect(r.prob!).toBeGreaterThan(0.3)
    // 発や白は持っていないので、遠い（出ても低い）
    const w = row(rows, 'yakuhai-32')
    if (w) expect(w.prob!).toBeLessThan(r.prob!)
  })

  it('東場の東家は「東」がダブ東（2翻）になる', () => {
    const s = makeState('123m456p789s55m東東', { live: 50 })
    const { rows } = estimateAims(s, 0, 60)
    const r = row(rows, 'yakuhai-27')!
    expect(r.label).toContain('ダブ東')
    expect(r.han).toBe(2)
  })

  it('三色同順', () => {
    const s = makeState('234m234p23s456s99m', { live: 50 })
    const { rows } = estimateAims(s, 0, 100)
    const r = row(rows, 'sanshoku')!
    expect(r.dist).toBe(0)
    expect(r.lines.join('')).toContain('234')
    expect(r.prob!).toBeGreaterThan(0.2)
  })

  it('完成している手は見込み100%', () => {
    const s = makeState('234m567p345s66m77p6m', { live: 50 })
    // 14枚目の 6m で 66m を刻子にしても形にならないので、完成形を別に用意する
    const t = makeState('234m567p345s666m77p', { live: 50 })
    const { rows } = estimateAims(t, 0, 20)
    expect(t.players[0].hand.length).toBe(14)
    expect(row(rows, 'tanyao')!.dist).toBe(-1)
    expect(row(rows, 'tanyao')!.prob).toBe(1)
    void s
  })

  it('鳴いている手には門前だけの役は出ない', () => {
    const s = makeState('234m567p55s', { melds: [{ type: 'pon', kinds: [4, 4, 4] }, { type: 'chi', kinds: [19, 20, 21] }], live: 50 })
    const { rows } = estimateAims(s, 0, 60)
    expect(row(rows, 'riichi')).toBeUndefined()
    expect(row(rows, 'pinfu')).toBeUndefined()
    expect(row(rows, 'chiitoi')).toBeUndefined()
    expect(row(rows, 'tanyao')).toBeDefined()
    expect(row(rows, 'tanyao')!.hanNow).toBe(1)
  })

  it('喰いタンなしのルールでは、鳴いたら断么九は出ない', () => {
    const s = makeState('234m567p55s', {
      melds: [{ type: 'pon', kinds: [4, 4, 4] }, { type: 'chi', kinds: [19, 20, 21] }],
      live: 50,
      rules: { kuitan: false },
    })
    const { rows } = estimateAims(s, 0, 40)
    expect(row(rows, 'tanyao')).toBeUndefined()
  })

  it('七対子：6対子＋1枚', () => {
    const s = makeState('1122m3344p5566s7z', { live: 50 })
    const { rows } = estimateAims(s, 0, 150)
    const r = row(rows, 'chiitoi')!
    expect(r.dist).toBe(0)
    expect(r.prob!).toBeGreaterThan(0.1)
    expect(r.prob!).toBeLessThan(0.7)
  })

  it('残りの山が少ないほど、見込みは下がる', () => {
    const base = '234m567p345s66m88p'
    const early = row(estimateAims(makeState(base, { live: 60 }), 0, 150).rows, 'tanyao')!
    const late = row(estimateAims(makeState(base, { live: 8 }), 0, 150).rows, 'tanyao')!
    expect(late.prob!).toBeLessThan(early.prob!)
  })

  it('見込みはいつも 0〜1 で、同じ手なら同じ結果になる', () => {
    const s = makeState('1234m5678p99s東南西', { live: 40 })
    const a = estimateAims(s, 0, 80)
    const b = estimateAims(s, 0, 80)
    for (const r of a.rows) {
      expect(r.prob!).toBeGreaterThanOrEqual(0)
      expect(r.prob!).toBeLessThanOrEqual(1)
      expect(row(b.rows, r.key)!.prob).toBe(r.prob)
    }
  })
})
