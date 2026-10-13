// CPU の思考

import { evaluateDiscards, recommend } from './analysis'
import {
  getTurnOptions,
  isOpen,
  type CallAction,
  type CallOptions,
  type GameState,
  type TurnAction,
} from './game'
import { threats } from './safety'
import { shanten } from './shanten'
import { isDragon, isHonor, isYaochu, kindOf, suitOf, toCounts, type Kind, type Tile } from './tiles'

export type CpuLevel = 'weak' | 'normal' | 'strong'

/** 状態から決まる疑似乱数（「待った」でやり直しても同じ判断になる） */
function rand(s: GameState, seat: number, salt: number): number {
  let x = (s.roundNo * 7919 + s.discardSeq * 104729 + seat * 31 + salt * 17 + s.startDealer * 3) | 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

const isYakuhaiKind = (s: GameState, seat: number, k: Kind) =>
  isDragon(k) || k === 27 + s.roundWind || k === 27 + ((seat - s.dealer + 4) % 4)

export function cpuTurnAction(s: GameState, seat: number, level: CpuLevel): TurnAction {
  const p = s.players[seat]
  const opts = getTurnOptions(s, seat)
  if (opts.tsumo) return { type: 'tsumo' }
  if (opts.kyuushu) {
    const kinds = new Set(p.hand.map(kindOf).filter(isYaochu)).size
    if (level === 'weak' || kinds < 11) return { type: 'kyuushu' }
  }
  if (p.riichi) {
    if (opts.ankan.length > 0 && level !== 'weak') return { type: 'ankan', kind: opts.ankan[0] }
    return { type: 'discard', tile: p.drawn! }
  }
  const ths = threats(s, seat)
  const counts = toCounts(p.hand)
  const cur = shanten(counts, p.melds.length)
  if (level !== 'weak' && !ths.some((t) => t.reason === 'riichi')) {
    for (const k of opts.ankan) {
      const c = counts.slice()
      c[k] = 0
      if (shanten(c, p.melds.length + 1) <= cur) return { type: 'ankan', kind: k }
    }
    for (const k of opts.kakan) {
      const c = counts.slice()
      c[k]--
      if (shanten(c, p.melds.length) <= cur) return { type: 'kakan', kind: k }
    }
  }

  const evals = evaluateDiscards(s, seat, level !== 'weak')
  const legal = evals.filter((e) => !e.forbidden)
  let choice = legal.slice().sort((a, b) => b.value - a.value)[0]
  if (level === 'weak') {
    const sorted = legal.slice().sort((a, b) => b.value - a.value)
    const r = rand(s, seat, 1)
    if (r < 0.3 && sorted.length > 2) choice = sorted[1 + Math.floor(rand(s, seat, 2) * 2)]
  } else {
    const rec = recommend(s, seat, evals)
    if (level === 'strong') choice = rec.best
    else if (rec.mode === 'defend' && rec.attackBest.shanten >= 2) choice = rec.best
    else choice = rec.attackBest
  }

  // リーチ判断
  const canRiichi = opts.riichiTiles.some((t) => kindOf(t) === choice.kind)
  if (canRiichi && choice.shanten === 0 && choice.ukeireTotal > 0) {
    let riichi = true
    if (level === 'strong' && choice.waits.length > 0) {
      const allDama = choice.waits.every((w) => w.dama && w.damaPoints >= 8000)
      if (allDama) riichi = false
    }
    return { type: 'discard', tile: choice.tile, riichi }
  }
  return { type: 'discard', tile: choice.tile }
}

/** 鳴いた後に役が見込めるか（ざっくり） */
function yakuPathAfterCall(s: GameState, seat: number, called: Kind, used: Tile[], type: 'pon' | 'chi'): boolean {
  const p = s.players[seat]
  if (type === 'pon' && isYakuhaiKind(s, seat, called)) return true
  const meldKinds = p.melds.flatMap((m) => m.tiles.map(kindOf))
  if (p.melds.some((m) => m.type !== 'chi' && isYakuhaiKind(s, seat, kindOf(m.tiles[0])))) return true
  const after = p.hand.filter((t) => !used.includes(t)).map(kindOf)
  const newMeld = type === 'pon' ? [called, called, called] : [...used.map(kindOf), called]
  const allMeld = [...meldKinds, ...newMeld]
  // 役牌の対子を持っている（後でポンできる見込み）
  const counts = new Map<Kind, number>()
  for (const k of after) counts.set(k, (counts.get(k) ?? 0) + 1)
  for (const [k, n] of counts) if (n >= 2 && isYakuhaiKind(s, seat, k)) return true
  // タンヤオ
  if (s.rules.kuitan && allMeld.every((k) => !isYaochu(k)) && after.filter(isYaochu).length <= 1) return true
  // 混一色・清一色
  const suits = new Set(allMeld.filter((k) => !isHonor(k)).map(suitOf))
  if (suits.size === 1) {
    const [suit] = [...suits]
    const off = after.filter((k) => !isHonor(k) && suitOf(k) !== suit).length
    if (off <= 1) return true
  }
  // 対々和
  if (type === 'pon' && p.melds.every((m) => m.type !== 'chi')) {
    const pairs = [...counts.values()].filter((n) => n >= 2).length
    if (pairs >= 3) return true
  }
  return false
}

function bestShantenAfterCall(s: GameState, seat: number, used: Tile[], forbidden: Kind[]): number {
  const p = s.players[seat]
  const after = p.hand.filter((t) => !used.includes(t))
  const c = toCounts(after)
  let best = 99
  for (let k = 0; k < 34; k++) {
    if (c[k] === 0 || forbidden.includes(k)) continue
    c[k]--
    best = Math.min(best, shanten(c, p.melds.length + 1))
    c[k]++
  }
  return best
}

/** aggressive = true のときは、相手のリーチがあっても和了のために鳴く（攻めの方針の助言用） */
export function cpuCallAction(s: GameState, seat: number, opts: CallOptions, level: CpuLevel, aggressive = false): CallAction {
  if (opts.ron) return { type: 'ron' }
  const p = s.players[seat]
  if (p.riichi) return { type: 'pass' }
  const ph = s.phase
  if (ph.type !== 'response') return { type: 'pass' }
  const k = kindOf(ph.tile)
  const cur = shanten(toCounts(p.hand), p.melds.length)
  const riichiThreat = threats(s, seat).some((t) => t.reason === 'riichi')
  if (riichiThreat && level !== 'weak' && cur >= 1 && !aggressive) return { type: 'pass' }
  const closedTenpai = !isOpen(p) && cur === 0
  if (closedTenpai) return { type: 'pass' }

  let bestAction: CallAction = { type: 'pass' }
  let bestSh = cur
  for (const v of opts.pon) {
    const yakuhai = isYakuhaiKind(s, seat, k)
    const sh = bestShantenAfterCall(s, seat, v, [k])
    const ok = yakuhai ? sh <= cur : sh < cur && yakuPathAfterCall(s, seat, k, v, 'pon')
    const weakOk = level === 'weak' && sh < cur && rand(s, seat, 3) < 0.4
    if ((ok || weakOk) && (sh < bestSh || bestAction.type === 'pass')) {
      bestAction = { type: 'pon', tiles: v }
      bestSh = sh
    }
  }
  for (const v of opts.chi) {
    const forb = [k]
    const sh = bestShantenAfterCall(s, seat, v, forb)
    const ok = sh < cur && yakuPathAfterCall(s, seat, k, v, 'chi')
    const weakOk = level === 'weak' && sh < cur && rand(s, seat, 4) < 0.3
    if ((ok || weakOk) && sh < bestSh) {
      bestAction = { type: 'chi', tiles: v }
      bestSh = sh
    }
  }
  // 門前で手が早い（1シャンテン以内）なら、役牌以外は鳴かずにリーチを目指す
  if (bestAction.type !== 'pass' && !isOpen(p) && cur <= 1 && level === 'strong' && !isYakuhaiKind(s, seat, k)) {
    return { type: 'pass' }
  }
  return bestAction
}
