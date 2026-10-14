import { describe, expect, it } from 'vitest'
import { createGame, type GameState } from '../game'
import { handStatus } from '../handInfo'
import { DEFAULT_RULES } from '../rules'
import { parseKinds, type Kind } from '../tiles'

function setup(hand: string, seat = 1): GameState {
  const s = createGame(DEFAULT_RULES, 1)
  const used = new Array(34).fill(0)
  const take = (k: Kind) => k * 4 + used[k]++
  const p = s.players[seat]
  p.hand = parseKinds(hand).map(take)
  p.drawn = null
  p.melds = []
  p.discards = []
  p.riichi = false
  p.furitenTemp = false
  p.furitenRiichi = false
  return s
}

describe('相手の手牌の状態', () => {
  it('テンパイと待ち', () => {
    const s = setup('234m567p345s66m77p')
    const st = handStatus(s, 1)
    expect(st.tenpai).toBe(true)
    expect(st.furiten).toBe(false)
    expect(st.text).toContain('テンパイ')
    expect(st.text).toContain('ローワン')
    expect(st.text).toContain('チーピン')
  })

  it('シャンテン数', () => {
    const s = setup('1357m2468p1357s東')
    const st = handStatus(s, 1)
    expect(st.tenpai).toBe(false)
    expect(st.text).toMatch(/^\d+シャンテン$/)
  })

  it('待ちの牌を自分で捨てていればフリテン', () => {
    const s = setup('234m567p345s66m77p')
    s.players[1].discards.push({ tile: 5 * 4 + 3, tsumogiri: false, riichi: false, calledBy: null, seq: 1 }) // 6萬
    expect(handStatus(s, 1).furiten).toBe(true)
  })

  it('ツモった牌（14枚目）は、手牌に数えない', () => {
    const s = setup('234m567p345s66m77p')
    const p = s.players[1]
    const extra = 0 * 4 + 3 // 1萬
    p.hand.push(extra)
    p.drawn = extra
    const st = handStatus(s, 1)
    expect(st.text).toContain('テンパイ')
  })

  it('リーチ中の表示', () => {
    const s = setup('234m567p345s66m77p')
    s.players[1].riichi = true
    expect(handStatus(s, 1).riichi).toBe(true)
  })
})
