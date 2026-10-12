import { describe, expect, it } from 'vitest'
import { shanten, shantenNormal, waitingKinds, ukeire } from '../shanten'
import { kindsToCounts, parseKinds, kindShort } from '../tiles'

const c = (s: string) => kindsToCounts(parseKinds(s))

describe('shanten', () => {
  it('和了形は -1', () => {
    expect(shanten(c('123m456p789s11122z'))).toBe(-1)
    expect(shanten(c('11223344556677z'))).toBe(-1) // 七対子
    expect(shanten(c('19m19p19s12345677z'))).toBe(-1) // 国士
  })
  it('テンパイは 0', () => {
    expect(shanten(c('123m456p789s1112z'))).toBe(0)
    expect(shanten(c('23m456p789s11122z'))).toBe(0)
  })
  it('一般形', () => {
    expect(shantenNormal(c('123m456p78s1357z'))).toBe(3)
    expect(shantenNormal(c('159m159p159s1234z'))).toBe(8)
    expect(shantenNormal(c('1112345678999m'))).toBe(0)
  })
  it('副露あり', () => {
    expect(shanten(c('123m45p6s'), 2)).toBe(1)
    expect(shanten(c('123m45p66s'), 2)).toBe(0)
    expect(shanten(c('1m'), 4)).toBe(0)
  })
  it('九蓮の待ちは9種', () => {
    expect(waitingKinds(c('1112345678999m')).map(kindShort).join('')).toBe('1m2m3m4m5m6m7m8m9m')
  })
  it('受け入れ', () => {
    const vis = new Array(34).fill(0)
    const r = ukeire(c('23m456p789s11122z'), 0, vis)
    expect(r.shanten).toBe(0)
    expect(r.tiles.map((t) => kindShort(t.kind))).toEqual(['1m', '4m'])
    expect(r.total).toBe(8)
  })
})

// 素朴な（遅いが確実な）一般形シャンテン数
function bruteNormal(counts: number[], melds: number): number {
  let best = 8
  const c = counts.slice()
  const rec = (i: number, m: number, t: number, p: number) => {
    while (i < 34 && c[i] === 0) i++
    if (i >= 34) {
      const mm = m + melds
      const v = 8 - 2 * mm - Math.min(t, Math.max(0, 4 - mm)) - p
      if (v < best) best = v
      return
    }
    const num = i < 27 ? i % 9 : -1
    if (c[i] >= 3) { c[i] -= 3; rec(i, m + 1, t, p); c[i] += 3 }
    if (num >= 0 && num <= 6 && c[i + 1] && c[i + 2]) { c[i]--; c[i + 1]--; c[i + 2]--; rec(i, m + 1, t, p); c[i]++; c[i + 1]++; c[i + 2]++ }
    if (c[i] >= 2) {
      c[i] -= 2
      if (!p) rec(i, m, t, 1)
      rec(i, m, t + 1, p)
      c[i] += 2
    }
    if (num >= 0 && num <= 7 && c[i + 1]) { c[i]--; c[i + 1]--; rec(i, m, t + 1, p); c[i]++; c[i + 1]++ }
    if (num >= 0 && num <= 6 && c[i + 2]) { c[i]--; c[i + 2]--; rec(i, m, t + 1, p); c[i]++; c[i + 2]++ }
    c[i]--; rec(i, m, t, p); c[i]++
  }
  rec(0, 0, 0, 0)
  return best
}

describe('キャッシュ付き計算と素朴な計算の一致', () => {
  it('ランダムな手 3000通り', () => {
    let seed = 12345
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    for (let n = 0; n < 3000; n++) {
      const melds = Math.floor(rnd() * 3)
      const size = (n % 2 === 0 ? 13 : 14) - melds * 3
      const wall = Array.from({ length: 136 }, (_, i) => i >> 2)
      for (let i = wall.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1))
        ;[wall[i], wall[j]] = [wall[j], wall[i]]
      }
      const counts = new Array(34).fill(0)
      for (const k of wall.slice(0, size)) counts[k]++
      expect(shantenNormal(counts, melds)).toBe(bruteNormal(counts, melds))
    }
  })
  it('字牌の多い手（キャッシュ衝突の回帰テスト）', () => {
    const h = c('346m56788p79s東南北')
    expect(shantenNormal(h)).toBe(bruteNormal(h, 0))
    expect(shanten(h)).toBe(3)
  })
})
