import { describe, expect, it } from 'vitest'
import { createGame, type GameState } from '../game'
import { DEFAULT_RULES } from '../rules'
import { tileDanger } from '../safety'

/** 種類 k の牌の id（i 枚目） */
const tile = (k: number, i = 0) => k * 4 + i

function setup(): GameState {
  const s = createGame(DEFAULT_RULES, 1)
  // 手牌・河をいったん空にして、テスト用に組み立てる
  for (const p of s.players) {
    p.hand = []
    p.discards = []
    p.melds = []
  }
  s.players[1].riichi = true
  return s
}

const discard = (s: GameState, seat: number, k: number, i = 0) => {
  s.players[seat].discards.push({ tile: tile(k, i), tsumogiri: false, riichi: false, calledBy: null, seq: s.discardSeq++ })
}

describe('危険度の理由', () => {
  it('現物', () => {
    const s = setup()
    discard(s, 1, 13) // 5筒
    const d = tileDanger(s, 0, 13)
    expect(d.label).toBe('現物')
    expect(d.terms).toEqual(['現物'])
    expect(d.reasons[0]).toContain('ロンされません')
  })

  it('スジ：4萬が通っていれば1萬・7萬は比較的安全', () => {
    const s = setup()
    discard(s, 1, 3) // 4萬
    const one = tileDanger(s, 0, 0)
    expect(one.terms).toEqual(['スジ'])
    expect(one.reasons[0]).toContain('スジ：4萬が捨てられている')
    expect(one.reasons[0]).toContain('2-3萬の形で1・4萬待ち')
    expect(one.score).toBeLessThanOrEqual(15)
    const seven = tileDanger(s, 0, 6)
    expect(seven.terms).toEqual(['スジ'])
    expect(seven.reasons[0]).toContain('5-6萬の形で4・7萬待ち')
  })

  it('片スジは「まだ当たる」と説明される', () => {
    const s = setup()
    discard(s, 1, 9 + 1) // 2筒
    const five = tileDanger(s, 0, 9 + 4) // 5筒
    expect(five.terms).toEqual(['スジ'])
    expect(five.reasons.join('')).toContain('の可能性は残っている')
    expect(five.score).toBeGreaterThan(35)
  })

  it('カベ：3萬が4枚見えていれば1萬は両面待ちに当たらない', () => {
    const s = setup()
    for (let i = 0; i < 4; i++) discard(s, 2, 2, i) // 3萬×4（対面の河）
    const one = tileDanger(s, 0, 0)
    expect(one.terms).toEqual(['カベ'])
    expect(one.reasons[0]).toContain('カベ：3萬が4枚とも見えている')
    expect(one.score).toBeLessThanOrEqual(15)
    // 4萬は片側だけ消える
    const four = tileDanger(s, 0, 3)
    expect(four.terms).toEqual(['カベ'])
    expect(four.score).toBeGreaterThan(35)
  })

  it('無スジの真ん中の牌は危険', () => {
    const s = setup()
    const d = tileDanger(s, 0, 4) // 5萬
    expect(d.label).toBe('危険')
    expect(d.terms).toEqual(['スジ', 'カベ'])
    expect(d.reasons[0]).toContain('スジもカベもない')
  })

  it('字牌は見えている枚数で説明が変わる', () => {
    const s = setup()
    expect(tileDanger(s, 0, 27).reasons[0]).toContain('まだ1枚も見えていません')
    discard(s, 2, 27, 0)
    discard(s, 2, 27, 1)
    discard(s, 3, 27, 2)
    expect(tileDanger(s, 0, 27).reasons[0]).toContain('すでに3枚見えている')
  })
})
