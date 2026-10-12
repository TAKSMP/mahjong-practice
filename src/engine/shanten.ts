// シャンテン数・受け入れ（有効牌）の計算
// 一般形は「スーツ（萬・筒・索・字）ごとに、取りうる (面子数, 搭子数) の組をキャッシュ」
// してから組み合わせる方式なので、何百回呼んでも軽い。

import { KIND_COUNT, YAOCHU_KINDS, type Kind } from './tiles'

interface SuitResult {
  /** 雀頭を取らない場合の (面子, 搭子) の組 */
  noHead: [number, number][]
  /** 雀頭を1つ取った場合の (面子, 搭子) の組 */
  withHead: [number, number][]
}

// 数牌（9種）と字牌（7種）でキーの意味が違うので、キャッシュを分ける
const suitCache = new Map<number, SuitResult>()
const honorCache = new Map<number, SuitResult>()

function pareto(set: Set<number>): [number, number][] {
  const list = [...set].map((v) => [v >> 4, v & 15] as [number, number])
  return list.filter(
    ([m, t]) => !list.some(([m2, t2]) => (m2 >= m && t2 >= t && (m2 > m || t2 > t))),
  )
}

function analyzeSuit(c: number[], honor: boolean): SuitResult {
  const n = c.length
  const cache = honor ? honorCache : suitCache
  let key = 0
  for (let i = 0; i < n; i++) key = key * 5 + c[i]
  const hit = cache.get(key)
  if (hit) return hit

  const noHead = new Set<number>()
  const withHead = new Set<number>()
  const rec = (i: number, m: number, t: number, head: boolean) => {
    while (i < n && c[i] === 0) i++
    if (i >= n) {
      ;(head ? withHead : noHead).add(m * 16 + t)
      return
    }
    if (c[i] >= 3) {
      c[i] -= 3
      rec(i, m + 1, t, head)
      c[i] += 3
    }
    if (!honor && i + 2 < n && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--, c[i + 1]--, c[i + 2]--
      rec(i, m + 1, t, head)
      c[i]++, c[i + 1]++, c[i + 2]++
    }
    if (c[i] >= 2) {
      c[i] -= 2
      if (!head) rec(i, m, t, true)
      rec(i, m, t + 1, head)
      c[i] += 2
    }
    if (!honor && i + 1 < n && c[i + 1] > 0) {
      c[i]--, c[i + 1]--
      rec(i, m, t + 1, head)
      c[i]++, c[i + 1]++
    }
    if (!honor && i + 2 < n && c[i + 2] > 0) {
      c[i]--, c[i + 2]--
      rec(i, m, t + 1, head)
      c[i]++, c[i + 2]++
    }
    // 孤立牌として扱う
    c[i]--
    rec(i, m, t, head)
    c[i]++
  }
  rec(0, 0, 0, false)
  const res = { noHead: pareto(noHead), withHead: pareto(withHead) }
  cache.set(key, res)
  return res
}

/** 一般形（4面子1雀頭）のシャンテン数。meldCount = 副露（暗槓含む）の数 */
export function shantenNormal(counts: number[], meldCount = 0): number {
  const groups: SuitResult[] = [
    analyzeSuit(counts.slice(0, 9), false),
    analyzeSuit(counts.slice(9, 18), false),
    analyzeSuit(counts.slice(18, 27), false),
    analyzeSuit(counts.slice(27, 34), true),
  ]
  let best = -1
  // headGroup = -1: 雀頭なし / 0..3: そのグループから雀頭
  for (let headGroup = -1; headGroup < 4; headGroup++) {
    if (headGroup >= 0 && groups[headGroup].withHead.length === 0) continue
    const lists = groups.map((g, i) => (i === headGroup ? g.withHead : g.noHead))
    for (const [m0, t0] of lists[0])
      for (const [m1, t1] of lists[1])
        for (const [m2, t2] of lists[2])
          for (const [m3, t3] of lists[3]) {
            const m = m0 + m1 + m2 + m3 + meldCount
            const t = t0 + t1 + t2 + t3
            const v = 2 * m + Math.min(t, Math.max(0, 4 - m)) + (headGroup >= 0 ? 1 : 0)
            if (v > best) best = v
          }
  }
  return 8 - best
}

export function shantenChiitoi(counts: number[]): number {
  let pairs = 0
  let kinds = 0
  for (let k = 0; k < KIND_COUNT; k++) {
    if (counts[k] >= 1) kinds++
    if (counts[k] >= 2) pairs++
  }
  return 6 - pairs + Math.max(0, 7 - kinds)
}

export function shantenKokushi(counts: number[]): number {
  let kinds = 0
  let pair = 0
  for (const k of YAOCHU_KINDS) {
    if (counts[k] >= 1) kinds++
    if (counts[k] >= 2) pair = 1
  }
  return 13 - kinds - pair
}

/** 全形のうち最小のシャンテン数。-1 = 和了形 */
export function shanten(counts: number[], meldCount = 0): number {
  let s = shantenNormal(counts, meldCount)
  if (meldCount === 0) {
    s = Math.min(s, shantenChiitoi(counts), shantenKokushi(counts))
  }
  return s
}

export interface ShantenDetail {
  normal: number
  chiitoi: number
  kokushi: number
  best: number
}

export function shantenDetail(counts: number[], meldCount = 0): ShantenDetail {
  const normal = shantenNormal(counts, meldCount)
  const chiitoi = meldCount === 0 ? shantenChiitoi(counts) : 99
  const kokushi = meldCount === 0 ? shantenKokushi(counts) : 99
  return { normal, chiitoi, kokushi, best: Math.min(normal, chiitoi, kokushi) }
}

/** 13枚（副露分を除く）の手で和了になる牌の種類（待ち）。手の中で4枚使っている牌は除く */
export function waitingKinds(counts: number[], meldCount = 0): Kind[] {
  const out: Kind[] = []
  for (let k = 0; k < KIND_COUNT; k++) {
    if (counts[k] >= 4) continue
    counts[k]++
    if (shanten(counts, meldCount) === -1) out.push(k)
    counts[k]--
  }
  return out
}

export interface UkeireTile {
  kind: Kind
  /** 見えていない残り枚数（自分の手牌・河・副露・ドラ表示牌を除く） */
  remaining: number
}

/**
 * 13枚（副露分を除く）の手について、シャンテン数を進める牌の一覧。
 * visible[k] = 自分の手以外で見えている枚数
 */
export function ukeire(
  counts: number[],
  meldCount: number,
  visible: number[],
  base?: number,
): { shanten: number; tiles: UkeireTile[]; total: number } {
  const cur = base ?? shanten(counts, meldCount)
  const tiles: UkeireTile[] = []
  let total = 0
  for (let k = 0; k < KIND_COUNT; k++) {
    if (counts[k] >= 4) continue
    counts[k]++
    const s = shanten(counts, meldCount)
    counts[k]--
    if (s < cur) {
      const remaining = Math.max(0, 4 - counts[k] - visible[k])
      tiles.push({ kind: k, remaining })
      total += remaining
    }
  }
  return { shanten: cur, tiles, total }
}
