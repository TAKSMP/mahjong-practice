// 危険度（放銃リスク）の推定
// リーチ者（と、3副露以上の相手）に対して、各牌がどれくらい危ないかを
// 「現物・スジ・壁・字牌の見え方」から推定する。

import { doraIndicators, isOpen, type GameState } from './game'
import { doraFromIndicator, isHonor, isDragon, kindLabel, kindOf, numOf, type Kind } from './tiles'

export interface Threat {
  seat: number
  /** リーチ = 1.0、3副露以上 = 0.6 */
  weight: number
  reason: 'riichi' | 'open'
}

export function threats(s: GameState, viewer: number): Threat[] {
  const res: Threat[] = []
  s.players.forEach((p, seat) => {
    if (seat === viewer) return
    if (p.riichi) res.push({ seat, weight: 1, reason: 'riichi' })
    else if (isOpen(p) && p.melds.length >= 3) res.push({ seat, weight: 0.6, reason: 'open' })
  })
  return res
}

/** target に対して安全が確定している牌の種類（現物） */
export function genbutsu(s: GameState, target: number): Set<Kind> {
  const p = s.players[target]
  const set = new Set<Kind>()
  for (const d of p.discards) set.add(kindOf(d.tile))
  if (p.riichi && p.riichiIndex >= 0) {
    const rseq = p.discards[p.riichiIndex].seq
    for (const q of s.players) for (const d of q.discards) if (d.seq > rseq) set.add(kindOf(d.tile))
  }
  return set
}

export interface Danger {
  /** 0〜100（0 = 現物） */
  score: number
  label: '現物' | 'ほぼ安全' | '比較的安全' | 'やや危険' | '危険'
  reasons: string[]
}

export function dangerLabel(score: number): Danger['label'] {
  if (score <= 0) return '現物'
  if (score <= 15) return 'ほぼ安全'
  if (score <= 35) return '比較的安全'
  if (score <= 60) return 'やや危険'
  return '危険'
}

/** viewer から見えている枚数（自分の手牌も含む） */
function seenCounts(s: GameState, viewer: number): number[] {
  const c = new Array(34).fill(0)
  for (const p of s.players) {
    for (const d of p.discards) if (d.calledBy === null) c[kindOf(d.tile)]++
    for (const m of p.melds) for (const t of m.tiles) c[kindOf(t)]++
  }
  for (const t of s.players[viewer].hand) c[kindOf(t)]++
  for (const t of doraIndicators(s)) c[kindOf(t)]++
  return c
}

function dangerVs(s: GameState, k: Kind, target: number, seen: number[]): Danger {
  const safe = genbutsu(s, target)
  if (safe.has(k)) return { score: 0, label: '現物', reasons: [`${s.players[target].name}の現物`] }
  const reasons: string[] = []
  const doras = doraIndicators(s).map((t) => doraFromIndicator(kindOf(t)))
  let score: number
  if (isHonor(k)) {
    const v = seen[k]
    if (v >= 3) {
      score = 5
      reasons.push(`字牌で${v}枚見えている（単騎待ちしかない）`)
    } else if (v === 2) {
      score = 15
      reasons.push('字牌で2枚見えている')
    } else {
      const yakuhai = isDragon(k) || k === 27 + s.roundWind || k === 27 + ((target - s.dealer + 4) % 4)
      score = v === 1 ? 25 : 35
      if (yakuhai) score += 5
      reasons.push(v === 1 ? '字牌（1枚見え）' : '字牌（まだ見えていない）')
    }
  } else {
    const n = numOf(k)
    const base = k - (n - 1)
    const isSafe = (num: number) => safe.has(base + num - 1)
    const blocked = (num: number) => seen[base + num - 1] >= 4
    // 両面待ちの形：下側 (n-2,n-1) → n と n-3 待ち、上側 (n+1,n+2) → n と n+3 待ち
    let open = 0
    const sujiNote: string[] = []
    const kabeNote: string[] = []
    if (n - 2 >= 1 && n - 3 >= 1) {
      if (isSafe(n - 3)) sujiNote.push(kindLabel(base + n - 4))
      else if (blocked(n - 1) || blocked(n - 2)) kabeNote.push(kindLabel(base + (blocked(n - 1) ? n - 2 : n - 3)))
      else open++
    }
    if (n + 3 <= 9) {
      if (isSafe(n + 3)) sujiNote.push(kindLabel(base + n + 2))
      else if (blocked(n + 1) || blocked(n + 2)) kabeNote.push(kindLabel(base + (blocked(n + 1) ? n : n + 1)))
      else open++
    }
    const terminal = n === 1 || n === 9
    const nearTerminal = n === 2 || n === 8
    if (open === 0) {
      score = terminal ? 8 : nearTerminal ? 15 : 22
      if (sujiNote.length) reasons.push(`スジ（${sujiNote.join('・')}が通っている）`)
      if (kabeNote.length) reasons.push(`壁（${kabeNote.join('・')}が4枚見え）`)
      if (!sujiNote.length && !kabeNote.length) reasons.push('両面待ちでは当たらない')
    } else if (open === 1) {
      score = terminal ? 40 : nearTerminal ? 50 : 55
      reasons.push(sujiNote.length ? `片スジ（${sujiNote.join('・')}が通っている）` : '無スジ')
    } else {
      score = 72
      reasons.push('無スジの真ん中の牌（両面待ちに2通りで当たる）')
    }
    // 残り枚数が少ないほどシャンポン・単騎の可能性が下がる
    if (seen[k] >= 3) score -= 5
  }
  const doraCount = doras.filter((d) => d === k).length
  if (doraCount > 0) {
    score += 10
    reasons.push('ドラ（当たると高くなりやすい）')
  }
  score = Math.max(1, Math.min(100, score))
  return { score, label: dangerLabel(score), reasons }
}

/** すべての脅威に対する危険度（一番危ない相手の値） */
export function tileDanger(s: GameState, viewer: number, k: Kind, ths = threats(s, viewer)): Danger & { target: number | null } {
  if (ths.length === 0) return { score: 0, label: '現物', reasons: [], target: null }
  const seen = seenCounts(s, viewer)
  let worst: (Danger & { target: number | null }) | null = null
  for (const t of ths) {
    const d = dangerVs(s, k, t.seat, seen)
    const weighted = { ...d, score: Math.round(d.score * t.weight), target: t.seat }
    weighted.label = dangerLabel(weighted.score)
    if (d.score === 0) weighted.label = '現物'
    if (!worst || weighted.score > worst.score) worst = weighted
  }
  // 複数のリーチ者すべてに現物なら現物
  return worst!
}
