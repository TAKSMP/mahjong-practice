// 打牌の評価（CPUの思考と、あなたへのヒントの両方で使う）

import { buildWinInput, doraIndicators, isOpen, visibleCounts, type GameState } from './game'
import { allThreats, threats, tileDanger, type Danger, type Threat } from './safety'
import { shanten, ukeire, type UkeireTile } from './shanten'
import {
  doraFromIndicator,
  isDragon,
  isHonor,
  isTerminal,
  kindOf,
  numOf,
  suitOf,
  toCounts,
  type Kind,
  type Tile,
} from './tiles'
import { calcPayment, evaluateWin, type WinResult } from './yaku'

export interface WaitInfo {
  kind: Kind
  remaining: number
  /** ダマ（リーチなし）でロンしたときの評価。役がなければ null */
  dama: WinResult | null
  /** リーチしてロンしたときの評価（門前のみ） */
  riichi: WinResult | null
  /** ダマでロンしたときの点数（役なしなら 0） */
  damaPoints: number
  riichiPoints: number
}

export interface DiscardEval {
  tile: Tile
  kind: Kind
  forbidden: boolean
  shanten: number
  ukeire: UkeireTile[]
  /** 有効牌の残り枚数の合計 */
  ukeireTotal: number
  /** テンパイなら待ちの詳細 */
  waits: WaitInfo[]
  /** 役のある待ちの残り枚数（鳴いている手で重要） */
  yakuWaitTotal: number
  danger: Danger & { target: number | null }
  isDora: boolean
  isRed: boolean
  /** 牌効率＋ちょっとした価値判断の点数（大きいほど切るのに向いている） */
  value: number
}

/** 赤ではない、その種類の牌 id（点数計算のダミー用） */
function plainTileOf(s: GameState, k: Kind): Tile {
  for (let i = 0; i < 4; i++) if (!s.redTiles.includes(k * 4 + i)) return k * 4 + i
  return k * 4
}

/** 切った後の手（13枚）で、各待ちの点数を見積もる */
export function waitDetails(s: GameState, seat: number, hand13: Tile[], waitTiles: UkeireTile[]): WaitInfo[] {
  const p = s.players[seat]
  const saved = p.hand
  const savedDrawn = p.drawn
  p.hand = hand13
  p.drawn = null
  const isDealer = seat === s.dealer
  const closed = !isOpen(p)
  const res = waitTiles.map((w) => {
    const t = plainTileOf(s, w.kind)
    const dama = evaluateWin(buildWinInput(s, seat, t, false, { ignoreSituational: true, riichiOverride: p.riichi, noUra: true }))
    const riichi = closed && !p.riichi ? evaluateWin(buildWinInput(s, seat, t, false, { ignoreSituational: true, riichiOverride: true, noUra: true })) : dama
    return {
      kind: w.kind,
      remaining: w.remaining,
      dama,
      riichi,
      damaPoints: dama ? calcPayment(dama.base, isDealer, false, 0).ron! : 0,
      riichiPoints: riichi ? calcPayment(riichi.base, isDealer, false, 0).ron! : 0,
    }
  })
  p.hand = saved
  p.drawn = savedDrawn
  return res
}

function tieBreak(s: GameState, seat: number, t: Tile, counts: number[], doras: Kind[]): number {
  const k = kindOf(t)
  const p = s.players[seat]
  let v = 0
  const isYakuhai = isDragon(k) || k === 27 + s.roundWind || k === 27 + ((seat - s.dealer + 4) % 4)
  if (isHonor(k)) {
    if (counts[k] === 1) v += isYakuhai ? 18 : 30
    else v -= isYakuhai ? 25 : 8
  } else {
    const n = numOf(k)
    let near = 0
    for (let d = -2; d <= 2; d++) {
      if (d === 0) continue
      const m = n + d
      if (m < 1 || m > 9) continue
      near += counts[k + d]
    }
    if (counts[k] >= 2) v -= 10
    if (near === 0 && counts[k] === 1) v += isTerminal(k) ? 22 : 15
    if (isTerminal(k)) v += 6
    else if (n === 2 || n === 8) v += 3
  }
  if (doras.includes(k)) v -= 35
  if (s.redTiles.includes(t)) v -= 30
  // 鳴いている手：役の方向に合わせる
  if (isOpen(p)) {
    const meldKinds = p.melds.flatMap((m) => m.tiles.map(kindOf))
    const hasYakuhaiMeld = p.melds.some((m) => {
      const mk = kindOf(m.tiles[0])
      return m.type !== 'chi' && (isDragon(mk) || mk === 27 + s.roundWind || mk === 27 + ((seat - s.dealer + 4) % 4))
    })
    if (!hasYakuhaiMeld) {
      const tanyaoPath = s.rules.kuitan && meldKinds.every((mk) => !isHonor(mk) && !isTerminal(mk))
      if (tanyaoPath && (isHonor(k) || isTerminal(k))) v += 40
      const suits = new Set(meldKinds.filter((mk) => !isHonor(mk)).map(suitOf))
      if (!tanyaoPath && suits.size === 1) {
        const [suit] = [...suits]
        if (!isHonor(k) && suitOf(k) !== suit) v += 40
      }
    }
  }
  return v
}

/** 手牌の各牌について「切ったらどうなるか」を評価する */
/** 自分の方針：自動（状況で攻め・守りを切り替え）／攻め（和了優先）／守り（放銃回避に専念） */
export type Policy = 'auto' | 'attack' | 'defend'

export function evaluateDiscards(s: GameState, seat: number, withDanger = true, policy: Policy = 'auto'): DiscardEval[] {
  const p = s.players[seat]
  const counts = toCounts(p.hand)
  const visible = visibleCounts(s, seat)
  const doras = doraIndicators(s).map((t) => doraFromIndicator(kindOf(t)))
  const ths = withDanger ? (policy === 'defend' ? allThreats(s, seat) : threats(s, seat)) : []
  const open = isOpen(p)
  const seen = new Set<string>()
  const res: DiscardEval[] = []
  // ツモ牌を先に見る（同じ種類ならツモ切りを代表にする）
  const order = p.drawn !== null && p.hand.includes(p.drawn) ? [p.drawn, ...p.hand.filter((t) => t !== p.drawn)] : p.hand
  for (const t of order) {
    const k = kindOf(t)
    const red = s.redTiles.includes(t)
    const key = `${k}:${red}`
    if (seen.has(key)) continue
    seen.add(key)
    counts[k]--
    const sh = shanten(counts, p.melds.length)
    const uk = ukeire(counts, p.melds.length, visible, sh)
    counts[k]++
    let waits: WaitInfo[] = []
    let yakuWaitTotal = uk.total
    if (sh === 0) {
      const hand13 = p.hand.slice()
      hand13.splice(hand13.indexOf(t), 1)
      waits = waitDetails(s, seat, hand13, uk.tiles)
      yakuWaitTotal = waits.reduce((a, w) => a + ((open ? w.dama : w.riichi ?? w.dama) ? w.remaining : 0), 0)
    }
    const forbidden = p.kuikae.includes(k) || (p.riichi && t !== p.drawn)
    // ↑ 代表の牌がツモ牌と同じ種類・同じ赤なら、ツモ牌が代表になっている
    const danger = ths.length > 0 ? tileDanger(s, seat, k, ths) : { score: 0, label: '現物' as const, reasons: [], terms: [], target: null }
    const eff = open ? yakuWaitTotal : uk.total
    let value = -sh * 10000 + eff * 100 + tieBreak(s, seat, t, counts, doras)
    if (sh === 0 && waits.length > 0) {
      // テンパイの選択では、待ちの広さに加えて打点も少し考える
      const avg = waits.reduce((a, w) => a + w.remaining * (open ? w.damaPoints : w.riichiPoints), 0) / Math.max(1, eff)
      value += Math.min(avg / 100, 80)
    }
    res.push({
      tile: t,
      kind: k,
      forbidden,
      shanten: sh,
      ukeire: uk.tiles,
      ukeireTotal: uk.total,
      waits,
      yakuWaitTotal,
      danger,
      isDora: doras.includes(k),
      isRed: red,
      value,
    })
  }
  return res
}

export interface Recommendation {
  best: DiscardEval
  /** 牌効率だけで選んだ場合の最善 */
  attackBest: DiscardEval
  mode: 'attack' | 'defend' | 'balance'
  threats: Threat[]
  reason: string
}

export function recommend(s: GameState, seat: number, evals?: DiscardEval[], policy: Policy = 'auto'): Recommendation {
  evals = evals ?? evaluateDiscards(s, seat, true, policy)
  const legal = evals.filter((e) => !e.forbidden)
  const pool = legal.length > 0 ? legal : evals
  const byValue = pool.slice().sort((a, b) => b.value - a.value)
  const attackBest = byValue[0]
  const ths = policy === 'defend' ? allThreats(s, seat) : threats(s, seat)
  const riichiThreat = ths.some((t) => t.reason === 'riichi')
  // 自分で決めた方針：攻め＝いつも和了を最優先／守り＝放銃しない事を最優先
  if (policy === 'attack') {
    return {
      best: attackBest,
      attackBest,
      mode: 'attack',
      threats: threats(s, seat),
      reason: riichiThreat ? '相手のリーチを受けていますが、和了を目指す方針です。危険な牌は色で確認して、押す牌を選びましょう。' : '',
    }
  }
  if (policy === 'defend') {
    const safest = pool.slice().sort((a, b) => a.danger.score - b.danger.score || b.value - a.value)[0]
    const reason = riichiThreat
      ? '守りの方針です。リーチを受けているので、放銃しにくい牌（現物・スジ・カベ）を最優先で切ります。'
      : safest.danger.score === 0
        ? '守りの方針です。現物があるので、安全に切れます。'
        : '守りの方針です。誰もリーチしていないので、危険度は目安（現物・スジ・カベ・字牌の見え方から）です。'
    return { best: safest, attackBest, mode: 'defend', threats: ths, reason }
  }
  if (!riichiThreat || s.players[seat].riichi) {
    return { best: attackBest, attackBest, mode: 'attack', threats: ths, reason: '' }
  }
  const safest = pool.slice().sort((a, b) => a.danger.score - b.danger.score || b.value - a.value)[0]
  const sh = attackBest.shanten
  if (sh >= 2) {
    return {
      best: safest,
      attackBest,
      mode: 'defend',
      threats: ths,
      reason: 'リーチを受けていて、まだ2シャンテン以上。和了りは遠いので、安全な牌で守るのがおすすめです。',
    }
  }
  if (sh === 1) {
    const keep = pool.filter((e) => e.shanten === 1).sort((a, b) => a.danger.score - b.danger.score || b.value - a.value)
    const cand = keep[0]
    if (cand && cand.danger.score <= 35) {
      return {
        best: cand,
        attackBest,
        mode: 'balance',
        threats: ths,
        reason: '1シャンテンなので、比較的安全な牌で手を進めながら様子を見ましょう（回し打ち）。',
      }
    }
    return {
      best: safest,
      attackBest,
      mode: 'defend',
      threats: ths,
      reason: 'リーチを受けていて1シャンテン。手を進める牌が危ないので、安全な牌で守るのがおすすめです。',
    }
  }
  // テンパイ
  const tenpaiOpts = pool.filter((e) => e.shanten === 0 && e.yakuWaitTotal > 0)
  if (tenpaiOpts.length > 0) {
    const b = tenpaiOpts.sort((a, c) => b2(c) - b2(a))[0]
    return { best: b, attackBest, mode: 'attack', threats: ths, reason: 'テンパイしているので、勝負（押し）も十分ありです。' }
  }
  return { best: safest, attackBest, mode: 'defend', threats: ths, reason: '役がないテンパイなので、無理せず守りましょう。' }
}

const b2 = (e: DiscardEval) => e.value - e.danger.score * 3
