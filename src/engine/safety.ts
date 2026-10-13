// 危険度（放銃リスク）の推定
// リーチ者（と、3副露以上の相手）に対して、各牌がどれくらい危ないかを
// 「現物・スジ・壁・字牌の見え方」から推定する。

import { doraIndicators, isOpen, type GameState } from './game'
import { doraFromIndicator, isHonor, isDragon, kindOf, numOf, type Kind } from './tiles'

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
  /** 初心者向けの理由（1行ずつ、具体的な牌の名前で説明する） */
  reasons: string[]
  /** 理由に出てくる用語（解説を開くためのタグ） */
  terms: ('現物' | 'スジ' | 'カベ')[]
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
  const name = s.players[target].name
  const safe = genbutsu(s, target)
  if (safe.has(k)) {
    return {
      score: 0,
      label: '現物',
      reasons: [`現物：${name}がすでに捨てた牌（リーチ後に他の人が捨てて通った牌も同じ）なので、${name}にはロンされません`],
      terms: ['現物'],
    }
  }
  const reasons: string[] = []
  const terms: Danger['terms'] = []
  const doras = doraIndicators(s).map((t) => doraFromIndicator(kindOf(t)))
  let score: number
  if (isHonor(k)) {
    const v = seen[k]
    if (v >= 3) {
      score = 5
      reasons.push(`字牌：すでに${v}枚見えているので残りは${4 - v}枚。当たるのは単騎待ちくらいです`)
    } else if (v === 2) {
      score = 15
      reasons.push('字牌：すでに2枚見えているので残りは2枚。当たるのはシャンポン待ちか単騎待ちだけです')
    } else {
      const yakuhai = isDragon(k) || k === 27 + s.roundWind || k === 27 + ((target - s.dealer + 4) % 4)
      score = v === 1 ? 25 : 35
      if (yakuhai) score += 5
      reasons.push(
        v === 1
          ? '字牌：1枚見えています。字牌はスジもカベもなく、シャンポン待ち・単騎待ちで当たります'
          : '字牌：まだ1枚も見えていません。字牌はスジもカベもなく、シャンポン待ち・単騎待ちで当たります',
      )
      if (yakuhai) reasons.push('役牌（この人にとっての）なので、さらに持っていて待つ人が多めです')
      if (v <= 1) terms.push('スジ', 'カベ')
    }
  } else {
    const n = numOf(k)
    const base = k - (n - 1)
    const S = ['萬', '筒', '索'][Math.floor(k / 9)]
    const isSafe = (num: number) => safe.has(base + num - 1)
    const blocked = (num: number) => seen[base + num - 1] >= 4
    // 両面待ちの形：下側 (n-2,n-1) を持っていると n-3 と n を待つ。上側 (n+1,n+2) を持っていると n と n+3 を待つ。
    const lowShape = `${n - 2}-${n - 1}${S}の形で${n - 3}・${n}${S}待ち`
    const upShape = `${n + 1}-${n + 2}${S}の形で${n}・${n + 3}${S}待ち`
    let open = 0
    let remain = ''
    let suji = 0
    let kabe = 0
    if (n - 3 >= 1) {
      if (isSafe(n - 3)) {
        suji++
        reasons.push(`スジ：${n - 3}${S}が捨てられている（通っている）ので、「${lowShape}」はありえません`)
      } else if (blocked(n - 1) || blocked(n - 2)) {
        kabe++
        const w = blocked(n - 1) ? n - 1 : n - 2
        reasons.push(`カベ：${w}${S}が4枚とも見えているので、「${lowShape}」はありえません`)
      } else {
        open++
        remain = lowShape
      }
    }
    if (n + 3 <= 9) {
      if (isSafe(n + 3)) {
        suji++
        reasons.push(`スジ：${n + 3}${S}が捨てられている（通っている）ので、「${upShape}」はありえません`)
      } else if (blocked(n + 1) || blocked(n + 2)) {
        kabe++
        const w = blocked(n + 1) ? n + 1 : n + 2
        reasons.push(`カベ：${w}${S}が4枚とも見えているので、「${upShape}」はありえません`)
      } else {
        open++
        remain = remain ? `${remain}」か「${upShape}` : upShape
      }
    }
    if (suji) terms.push('スジ')
    if (kabe) terms.push('カベ')
    // スジもカベも使えない牌：その意味を知りたい人のために解説を開けるようにする
    if (suji + kabe === 0) terms.push('スジ', 'カベ')
    const terminal = n === 1 || n === 9
    const nearTerminal = n === 2 || n === 8
    if (open === 0) {
      score = terminal ? 8 : nearTerminal ? 15 : 22
      reasons.push('両面待ちでは当たらない形です（辺張・嵌張・シャンポン・単騎では当たる可能性が残ります）')
    } else if (open === 1) {
      score = terminal ? 40 : nearTerminal ? 50 : 55
      if (suji + kabe > 0) reasons.push(`ただし「${remain}」の可能性は残っているので、まだ安全とは言えません`)
      else reasons.push(`スジもカベもありません。「${remain}」で当たります`)
    } else {
      score = 72
      reasons.push(`スジもカベもない真ん中の牌です。「${remain}」の2通りで当たります`)
    }
    // 残り枚数が少ないほどシャンポン・単騎の可能性が下がる
    if (seen[k] >= 3) score -= 5
  }
  const doraCount = doras.filter((d) => d === k).length
  if (doraCount > 0) {
    score += 10
    reasons.push('ドラです。当たると点数が高くなります')
  }
  score = Math.max(1, Math.min(100, score))
  return { score, label: dangerLabel(score), reasons, terms }
}

/** すべての脅威に対する危険度（一番危ない相手の値） */
export function tileDanger(s: GameState, viewer: number, k: Kind, ths = threats(s, viewer)): Danger & { target: number | null } {
  if (ths.length === 0) return { score: 0, label: '現物', reasons: [], terms: [], target: null }
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
